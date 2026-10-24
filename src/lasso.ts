import { Matrix4, Mesh, Scene, ShaderMaterial, FloatType, NearestFilter, WebGLRenderTarget, Color } from 'three'
import type { Camera, Side, WebGLRenderer } from 'three'

/** Screen point in CSS px, relative to the canvas's top-left. */
export type Point = [number, number]

/** Ignore pointer jitter: only record a lasso point once the pointer has moved this far (px). */
const MIN_STEP = 3
/**
 * How far behind the visible surface (world units, body ~3.5 tall) a texel
 * may sit and still count as visible. Absorbs depth interpolation error
 * without reaching through to the far side of a limb.
 */
const DEPTH_SLACK = 0.03

/**
 * Lets the user draw a lasso on `canvas` with the primary button or one
 * finger, drawn as an SVG overlay. A second finger cancels it, so two-finger
 * orbit/zoom still works. Returns a cleanup function.
 */
export function attachLasso(canvas: HTMLCanvasElement, onDone: (points: Point[]) => void): () => void {
  const host = canvas.parentElement!
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'lasso')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  svg.appendChild(path)
  host.appendChild(svg)

  let points: Point[] | null = null
  let pointerId = -1
  const at = (e: PointerEvent): Point => {
    const r = canvas.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }
  const draw = () => path.setAttribute('d', points ? `M${points.map((p) => p.join(',')).join('L')}Z` : '')
  const stop = () => {
    points = null
    pointerId = -1
    draw()
  }

  const down = (e: PointerEvent) => {
    if (points) return stop() // a second finger: they want to orbit, not lasso
    // Ctrl/Cmd-drag pans the camera instead (see GLBBody).
    if (e.button !== 0 || !e.isPrimary || e.ctrlKey || e.metaKey) return
    points = [at(e)]
    pointerId = e.pointerId
    canvas.setPointerCapture(e.pointerId)
  }
  const move = (e: PointerEvent) => {
    if (!points || e.pointerId !== pointerId) return
    const p = at(e)
    const last = points[points.length - 1]
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < MIN_STEP) return
    points.push(p)
    draw()
  }
  const up = (e: PointerEvent) => {
    if (!points || e.pointerId !== pointerId) return
    const done = points
    stop()
    if (done.length >= 3) onDone(done)
  }

  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', stop)
  return () => {
    canvas.removeEventListener('pointerdown', down)
    canvas.removeEventListener('pointermove', move)
    canvas.removeEventListener('pointerup', up)
    canvas.removeEventListener('pointercancel', stop)
    svg.remove()
  }
}

/** The polygon rasterised at canvas size: 1 where a pixel is inside it. */
function polygonMask(points: Point[], width: number, height: number): Uint8Array {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.beginPath()
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  ctx.fill()
  const rgba = ctx.getImageData(0, 0, width, height).data
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < mask.length; i++) mask[i] = rgba[i * 4 + 3] > 127 ? 1 : 0
  return mask
}

/**
 * Distance from the camera (view-space depth) of the nearest surface at each
 * pixel, 0 where there's none. Rows run bottom-up, as WebGL reads them.
 */
function depthPass(gl: WebGLRenderer, camera: Camera, mesh: Mesh, side: Side, width: number, height: number): Float32Array {
  const target = new WebGLRenderTarget(width, height, { type: FloatType, minFilter: NearestFilter, magFilter: NearestFilter })
  const material = new ShaderMaterial({
    vertexShader:
      'varying float vDepth;\nvoid main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vDepth;\nvoid main() { gl_FragColor = vec4(vDepth, 0.0, 0.0, 1.0); }',
    side,
  })
  const proxy = new Mesh(mesh.geometry, material)
  proxy.matrixAutoUpdate = false
  proxy.matrix.copy(mesh.matrixWorld)
  proxy.frustumCulled = false
  const scene = new Scene()
  scene.add(proxy)

  const prevTarget = gl.getRenderTarget()
  const prevClear = gl.getClearColor(new Color())
  const prevAlpha = gl.getClearAlpha()
  const out = new Float32Array(width * height * 4)
  try {
    gl.setRenderTarget(target)
    gl.setClearColor(0x000000, 0)
    gl.clear()
    gl.render(scene, camera)
    gl.readRenderTargetPixels(target, 0, 0, width, height, out)
  } finally {
    gl.setRenderTarget(prevTarget)
    gl.setClearColor(prevClear, prevAlpha)
    target.dispose()
    material.dispose()
  }
  const depth = new Float32Array(width * height)
  for (let i = 0; i < depth.length; i++) depth[i] = out[i * 4]
  return depth
}

/**
 * Which texels lie inside the lasso and face the camera unobstructed: each
 * texel's baked model-space position is projected to the screen, tested
 * against the polygon, then against a depth pass so the far side of the
 * body (or a muscle behind an arm) isn't tagged by accident.
 */
export function texelsInLasso(opts: {
  gl: WebGLRenderer
  camera: Camera
  mesh: Mesh
  /** Baked per-texel model-space positions, RGBA (a = 1 where there's surface). */
  positions: Float32Array
  points: Point[]
  /** Canvas size in CSS px (the space `points` are in). */
  width: number
  height: number
}): Uint8Array {
  const { gl, camera, mesh, positions, points, width, height } = opts
  const w = Math.round(width)
  const h = Math.round(height)
  const material = mesh.material as { side: Side }
  camera.updateMatrixWorld()
  mesh.updateWorldMatrix(true, false)
  const mask = polygonMask(points, w, h)
  const depth = depthPass(gl, camera, mesh, material.side, w, h)

  // Model space straight to clip space; for a perspective camera clip w is view depth, same as the depth pass.
  const e = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(mesh.matrixWorld)
    .elements
  const selected = new Uint8Array(positions.length / 4)
  for (let i = 0; i < selected.length; i++) {
    if (positions[i * 4 + 3] === 0) continue
    const x = positions[i * 4]
    const y = positions[i * 4 + 1]
    const z = positions[i * 4 + 2]
    const cw = e[3] * x + e[7] * y + e[11] * z + e[15]
    if (cw <= 0) continue
    const sx = Math.floor(((e[0] * x + e[4] * y + e[8] * z + e[12]) / cw + 1) * 0.5 * w)
    const sy = Math.floor((1 - (e[1] * x + e[5] * y + e[9] * z + e[13]) / cw) * 0.5 * h)
    if (sx < 0 || sy < 0 || sx >= w || sy >= h || !mask[sy * w + sx]) continue
    const surface = depth[(h - 1 - sy) * w + sx]
    // 0 = the texel projects just off the rendered silhouette; it's on the visible edge.
    if (surface === 0 || cw <= surface + DEPTH_SLACK) selected[i] = 1
  }
  return selected
}
