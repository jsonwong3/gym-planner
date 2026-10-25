import {
  Camera,
  Color,
  DataTexture,
  DoubleSide,
  FloatType,
  Mesh,
  NearestFilter,
  RedFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  WebGLRenderTarget,
} from 'three'
import type { BufferGeometry, WebGLRenderer } from 'three'
import { MUSCLE_CODES, MUSCLE_IDS, RETIRED_CODES } from './data/muscles'
import type { MuscleId } from './data/muscles'

/**
 * Muscle ID map for the GLB, so one un-split mesh can still tell muscles
 * apart: one byte per texel of the model's base-colour texture, 0 = not a
 * muscle, otherwise a MUSCLE_CODES value. Taps look up the hit UV in it and the
 * shader in BodyViewer tints by it.
 *
 * Saved as a PNG (code in the red channel) at `public/models/body-ids.png`.
 * Codes are fixed per muscle, so the muscle list can change without scrambling saved maps.
 */
export const ID_MAP_URL = '/models/body-ids.png'
/**
 * The ID map's resolution, fixed rather than taken from the model's texture so
 * the texture can be swapped (e.g. the grey one, which is only 256px) without
 * losing tags. It's the size every saved map was tagged at; changing it means re-tagging.
 */
export const ID_MAP_SIZE = 1024
/** Work in progress, so a refresh mid-tagging loses nothing. Wins over the saved PNG. */
const DRAFT_KEY = 'muscle-explorer:id-map-draft:v2'
const UNDO_LIMIT = 20

/**
 * Drafts saved before the muscles were regrouped used the old 42-muscle list's
 * codes. This translates them (index = old code - 1) into the codes that list
 * became (MUSCLE_CODES / RETIRED_CODES; names below are what each code was
 * then). Split muscles land on one part to be re-tagged; 0 = untagged.
 */
const V1_DRAFT_KEY = 'muscle-explorer:id-map-draft'
const V1_CODES = [
  0, // sternocleidomastoid
  0, // splenius
  4, // delt_front
  5, // delt_side
  6, // delt_rear
  7, // supraspinatus -> traps_upper
  12, // triceps -> triceps_lateral (re-tag the other heads)
  13, // biceps -> bicep
  13, // brachialis -> bicep
  40, // brachioradialis
  33, // wrist flexors -> forearm_flexors
  16, // forearm_extensors
  33, // pronators -> forearm_flexors
  16, // supinators -> forearm_extensors
  32, // lats
  7, // traps_upper
  8, // traps_middle
  38, // traps_lower
  7, // levator scapulae -> traps_upper
  8, // rhomboids -> traps_middle
  39, // infraspinatus
  0, // subscapularis
  2, // pec_lower
  1, // pec_upper
  2, // pec minor -> pec_lower
  3, // serratus
  17, // abs
  17, // transverse abdominis -> abs
  18, // obliques
  10, // quadratus lumborum -> erector_spinae
  10, // erector_spinae
  19, // glute_max
  20, // hip abductors -> glute_med
  21, // hip_flexors
  19, // deep rotators -> glute_max
  23, // quadriceps -> quads_outer
  25, // hamstrings
  26, // adductors
  27, // gastrocnemius
  28, // soleus
  0, // tibialis anterior
  0, // popliteus
]
const fromV1 = (code: number) => V1_CODES[code - 1] ?? 0

export const codeOf = (muscle: MuscleId) => MUSCLE_CODES[muscle]
const MUSCLE_BY_CODE = new Map(MUSCLE_IDS.map((m) => [MUSCLE_CODES[m], m]))
export const muscleOfCode = (code: number): MuscleId | null => MUSCLE_BY_CODE.get(code) ?? null
/** Highest code in use or retired; anything above it in a loaded map is treated as untagged. */
export const MAX_CODE = Math.max(...Object.values(MUSCLE_CODES), ...Object.keys(RETIRED_CODES).map(Number))

/** A distinct colour per muscle code (golden-angle hues), 0-255 RGB. Used in tag mode and the PNG. */
export function swatch(code: number): [number, number, number] {
  const h = (code * 137.508) % 360
  const s = 0.7
  const l = 0.55
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }
  return [f(0), f(8), f(4)]
}

/** How far (in 3D) a tag fill may spread from the tapped point, as a fraction of the model's height. */
const FILL_REACH = 0.12

/** What a flood fill does with a neighbouring texel. */
const enum Flood {
  Skip,
  /** Tag it, but don't spread from it. */
  Take,
  /** Tag it and spread to its neighbours. */
  Grow,
}

/** What the tag tools read, built once on first use (see `makeTagSource`). */
export interface TagSource {
  /** Base-colour texture, RGBA. */
  pixels: Uint8ClampedArray
  /** Model-space position under each texel, RGBA (a = 1 where there's surface), or null if it couldn't be baked. */
  positions: Float32Array | null
  /** Fill tool's max 3D distance from the tapped point, in model units. */
  reach: number
  /**
   * Max 3D distance between two neighbouring texels for them to count as
   * touching on the body. Further apart means a UV seam: neighbours in the
   * texture, different places on the model.
   */
  step: number
}

/** Clean-up: patches at or under these sizes (texels) count as lasso mistakes. */
const SPECK_MAX = 40
const HOLE_MAX = 400
/** Clean-up closes untagged gaps up to this many texels wide with tags on both sides. */
const GAP_MAX = 3
/** Most gap-closing rounds per clean-up; real maps settle in a handful. */
const GAP_ROUNDS = 10
/** `TagSource.step` as a fraction of the model's height; a few texels' worth on a 1024 map. */
const SEAM_STEP = 0.01

/** What a clean-up changed, in texels, for reporting back. */
export interface CleanUpResult {
  specks: number
  holes: number
  gaps: number
}

export class IdMap {
  readonly ids: Uint8Array
  /** Sampled by the GLB's shader; nearest filtering so codes never blend. */
  readonly texture: DataTexture
  /** Last muscle a fill or lasso tagged (erasing doesn't count), so downloads can be named after it. */
  lastTagged: MuscleId | null = null
  private undoStack: Uint8Array[] = []
  private saveTimer = 0

  constructor(
    readonly width: number,
    readonly height: number,
    ids?: Uint8Array,
  ) {
    this.ids = ids ?? new Uint8Array(width * height)
    this.texture = new DataTexture(this.ids, width, height, RedFormat, UnsignedByteType)
    this.texture.minFilter = NearestFilter
    this.texture.magFilter = NearestFilter
    this.texture.unpackAlignment = 1
    this.texture.needsUpdate = true
  }

  /** glTF textures aren't flipped, so v = 0 is the image's top row, same as `ids`. */
  private index(u: number, v: number) {
    const x = Math.min(this.width - 1, Math.floor((u - Math.floor(u)) * this.width))
    const y = Math.min(this.height - 1, Math.floor((v - Math.floor(v)) * this.height))
    return y * this.width + x
  }

  at(u: number, v: number): MuscleId | null {
    return muscleOfCode(this.ids[this.index(u, v)])
  }

  /**
   * Tags the patch of similar colour around (u, v). Compares against the
   * tapped colour rather than each neighbour, so gradients don't let the fill
   * creep across the body. UV islands from far-apart body parts can sit side
   * by side in the texture, so the fill also stops `FILL_REACH` away (in 3D)
   * from the tapped point.
   */
  fill(u: number, v: number, muscle: MuscleId, source: TagSource, tolerance: number) {
    const { pixels, positions, reach } = source
    const seed = this.index(u, v)
    const [r, g, b] = [pixels[seed * 4], pixels[seed * 4 + 1], pixels[seed * 4 + 2]]
    const tol2 = tolerance * tolerance
    const [sx, sy, sz] = positions ? [positions[seed * 4], positions[seed * 4 + 1], positions[seed * 4 + 2]] : [0, 0, 0]
    const checkReach = !!positions && positions[seed * 4 + 3] > 0
    const reach2 = reach * reach
    this.lastTagged = muscle
    this.flood(seed, codeOf(muscle), (i) => {
      const dr = pixels[i * 4] - r
      const dg = pixels[i * 4 + 1] - g
      const db = pixels[i * 4 + 2] - b
      if (dr * dr + dg * dg + db * db > tol2) return Flood.Skip
      if (!checkReach) return Flood.Grow
      // Gutter texel (no surface behind it): tag it so island edges don't show
      // untagged seams under nearest sampling, but never spread through it.
      if (positions![i * 4 + 3] === 0) return Flood.Take
      const dx = positions![i * 4] - sx
      const dy = positions![i * 4 + 1] - sy
      const dz = positions![i * 4 + 2] - sz
      return dx * dx + dy * dy + dz * dz <= reach2 ? Flood.Grow : Flood.Skip
    })
  }

  /**
   * Sets every texel flagged in `selected` to `muscle` (null untags). Gutter
   * texels touching them follow along: they have no surface of their own, but
   * nearest sampling at island edges reads them, and would show as seams.
   * Returns false (and records no undo step) if nothing was selected.
   */
  assign(selected: Uint8Array, muscle: MuscleId | null, positions: Float32Array): boolean {
    if (!selected.includes(1)) return false
    this.snapshot()
    const code = muscle ? codeOf(muscle) : 0
    if (muscle) this.lastTagged = muscle
    const { width, height, ids } = this
    for (let i = 0; i < selected.length; i++) {
      if (!selected[i]) continue
      ids[i] = code
      const x = i % width
      const y = (i - x) / width
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const n = ny * width + nx
          if (positions[n * 4 + 3] === 0) ids[n] = code
        }
      }
    }
    this.changed()
    return true
  }

  clear() {
    this.snapshot()
    this.ids.fill(0)
    this.changed()
  }

  /**
   * Tidies hand-lassoed tags in three passes, recorded as one undo step:
   * 1. specks: small islands of a muscle (stray lasso pixels) take whatever
   *    surrounds them, untagged included;
   * 2. gaps: untagged slivers up to GAP_MAX wide with tags on both sides
   *    (two muscles, or a crack in one) are closed. Open edges stay;
   * 3. holes: small untagged patches enclosed by tags are filled, each texel
   *    with its nearest muscle when several surround it.
   * Texels only count as neighbours if they touch on the body (`TagSource.step`),
   * so nothing leaks across UV seams. Returns null, recording no undo step,
   * if there was nothing to clean.
   */
  cleanUp(source: TagSource): CleanUpResult | null {
    const { width } = this
    const n = this.ids.length
    const ids = this.ids.slice()
    const pos = source.positions
    const isSurface = (i: number) => !pos || pos[i * 4 + 3] > 0
    const near = (i: number, j: number, max2: number) => {
      if (!pos) return true
      const dx = pos[i * 4] - pos[j * 4]
      const dy = pos[i * 4 + 1] - pos[j * 4 + 1]
      const dz = pos[i * 4 + 2] - pos[j * 4 + 2]
      return dx * dx + dy * dy + dz * dz <= max2
    }
    const step2 = source.step * source.step
    /** 4-neighbours in the texture, -1 off the edge. */
    const around = (i: number) => {
      const x = i % width
      return [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i >= width ? i - width : -1, i < n - width ? i + width : -1]
    }
    const touches = (i: number, j: number) => j >= 0 && isSurface(j) && near(i, j, step2)

    const seen = new Uint8Array(n)
    const comp: number[] = []
    /**
     * Fills `comp` with the touching patch of `label` around `seed`, tallying
     * the labels just outside it. `open` means it runs into a seam or island
     * edge, so it may carry on elsewhere on the body.
     */
    const patch = (seed: number, label: number) => {
      comp.length = 0
      const border = new Map<number, number>()
      let open = false
      const stack = [seed]
      seen[seed] = 1
      while (stack.length) {
        const i = stack.pop()!
        comp.push(i)
        for (const j of around(i)) {
          if (!touches(i, j)) {
            open = true
          } else if (ids[j] === label) {
            if (!seen[j]) {
              seen[j] = 1
              stack.push(j)
            }
          } else {
            border.set(ids[j], (border.get(ids[j]) ?? 0) + 1)
          }
        }
      }
      return { border, open }
    }

    const result: CleanUpResult = { specks: 0, holes: 0, gaps: 0 }

    // 1. Specks
    const removeSpecks = () => {
      seen.fill(0)
      for (let i = 0; i < n; i++) {
        if (seen[i] || !ids[i] || !isSurface(i)) continue
        const { border } = patch(i, ids[i])
        if (comp.length > SPECK_MAX || border.size === 0) continue
        const [[into]] = [...border].sort((a, b) => b[1] - a[1])
        for (const j of comp) ids[j] = into
        result.specks += comp.length
      }
    }
    removeSpecks()

    // 2. Gaps: an untagged texel with tags on both sides along a straight line across or down, at most
    // GAP_MAX + 1 steps apart in total, takes the nearer one. A texel in a corner where two muscles meet beside
    // skin has skin on one side of both lines, so it's left alone. Distance-only rules (or diagonal lines, which
    // cut across the corner) fill it, which makes the next texel a corner, creeping further every run. Diagonal
    // gaps are still caught: across or down they're only ~1.4x wider.
    const AXES = [
      [1, 0],
      [0, 1],
    ]
    /** First tag walking from j along (dx, dy), and how many steps away; [0, 0] if none in reach or the walk leaves the body. */
    const walk = (j: number, dx: number, dy: number): [number, number] => {
      let x = j % width
      let y = (j - x) / width
      let prev = j
      for (let t = 1; t <= GAP_MAX + 1; t++) {
        x += dx
        y += dy
        if (x < 0 || y < 0 || x >= width || y >= this.height) return [0, 0]
        const k = y * width + x
        if (!touches(prev, k)) return [0, 0]
        if (ids[k]) return [ids[k], t]
        prev = k
      }
      return [0, 0]
    }
    // Repeat until nothing changes: one round's fills can shorten a neighbouring line to within reach, and
    // a second click shouldn't find more to do. Capped in case of a pathological map.
    for (let round = 0; round < GAP_ROUNDS; round++) {
      const fill: Array<[number, number]> = []
      for (let j = 0; j < n; j++) {
        if (ids[j] || !isSurface(j)) continue
        for (const [dx, dy] of AXES) {
          const [a, ta] = walk(j, dx, dy)
          if (!a) continue
          const [b, tb] = walk(j, -dx, -dy)
          if (b && ta + tb <= GAP_MAX + 1) {
            fill.push([j, ta <= tb ? a : b])
            break
          }
        }
      }
      if (!fill.length) break
      for (const [j, label] of fill) ids[j] = label
      result.gaps += fill.length
    }

    // 3. Holes (after gaps, so a gap that sealed one off gets it filled in the same run)
    seen.fill(0)
    for (let i = 0; i < n; i++) {
      if (seen[i] || ids[i] || !isSurface(i)) continue
      const { border, open } = patch(i, 0)
      if (open || comp.length > HOLE_MAX || border.size === 0) continue
      result.holes += comp.length
      // Grow the surrounding muscles in from the edge, so with several around it each texel takes the nearest.
      const hole = new Set(comp)
      const queue: number[] = []
      for (const j of comp) {
        const k = around(j).find((k) => touches(j, k) && !hole.has(k))
        if (k !== undefined) {
          ids[j] = ids[k]
          queue.push(j)
        }
      }
      for (let q = 0; q < queue.length; q++) {
        for (const k of around(queue[q])) {
          if (hole.has(k) && !ids[k]) {
            ids[k] = ids[queue[q]]
            queue.push(k)
          }
        }
      }
    }

    // Gap and hole fills can split off a sliver of their own; sweep once more so a second click finds nothing.
    removeSpecks()

    const changed: number[] = []
    for (let i = 0; i < n; i++) if (ids[i] !== this.ids[i]) changed.push(i)
    if (!changed.length) return null
    // Gutter texels bordering a change follow it, as in `assign`, so island edges don't show seams.
    if (pos) {
      for (const i of changed) {
        for (const j of around(i)) if (j >= 0 && pos[j * 4 + 3] === 0) ids[j] = ids[i]
      }
    }
    this.snapshot()
    this.ids.set(ids)
    this.changed()
    return result
  }

  get canUndo() {
    return this.undoStack.length > 0
  }

  undo() {
    const prev = this.undoStack.pop()
    if (!prev) return
    this.ids.set(prev)
    this.changed()
  }

  /** Pixel count per muscle code (retired ones included), index 0 = untagged. */
  counts(): Uint32Array {
    const counts = new Uint32Array(MAX_CODE + 1)
    for (const c of this.ids) counts[c]++
    return counts
  }

  /**
   * Red = muscle code (what's read back); green/blue from `swatch()` so the file is viewable.
   * With `only`, every other muscle is left out, giving that muscle's mask on its own.
   */
  toPng(only?: MuscleId): Promise<Blob> {
    const keep = only ? codeOf(only) : null
    const canvas = document.createElement('canvas')
    canvas.width = this.width
    canvas.height = this.height
    const ctx = canvas.getContext('2d')!
    const img = ctx.createImageData(this.width, this.height)
    for (let i = 0; i < this.ids.length; i++) {
      const code = keep === null || this.ids[i] === keep ? this.ids[i] : 0
      const [, g, b] = code ? swatch(code) : [0, 0, 0]
      img.data.set([code, g, b, 255], i * 4)
    }
    ctx.putImageData(img, 0, 0)
    return new Promise((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encode failed'))), 'image/png'),
    )
  }

  private flood(seed: number, code: number, test: (i: number) => Flood) {
    this.snapshot()
    const { width, height } = this
    const seen = new Uint8Array(width * height)
    const stack = [seed]
    seen[seed] = 1
    while (stack.length) {
      const i = stack.pop()!
      this.ids[i] = code
      const x = i % width
      const y = (i - x) / width
      for (const n of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1]) {
        if (n < 0 || seen[n]) continue
        const result = test(n)
        if (result === Flood.Skip) continue
        seen[n] = 1
        if (result === Flood.Grow) stack.push(n)
        else this.ids[n] = code
      }
    }
    this.changed()
  }

  private snapshot() {
    this.undoStack.push(this.ids.slice())
    if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift()
  }

  private changed() {
    this.texture.needsUpdate = true
    clearTimeout(this.saveTimer)
    this.saveTimer = window.setTimeout(() => void this.saveDraft(), 500)
  }

  /** False if storage refused it. */
  async saveDraft(): Promise<boolean> {
    const blob = await this.toPng()
    const url = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
    try {
      localStorage.setItem(DRAFT_KEY, url)
      return true
    } catch {
      // Private mode or quota: tagging still works, it just won't survive a refresh.
      return false
    }
  }
}

/** RGBA pixels of an image (e.g. a texture's `image`), for flood-filling. */
/** RGBA pixels of an image, scaled to `width` x `height` (its own size by default). */
export function readPixels(
  image: CanvasImageSource & { width: number; height: number },
  width = image.width,
  height = image.height,
): Uint8ClampedArray {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0, width, height)
  return ctx.getImageData(0, 0, width, height).data
}

/**
 * Renders the mesh flattened into UV space, writing each fragment's
 * model-space position, so every texel knows where on the body it lies.
 * Null if the GPU can't render to float targets.
 */
function bakePositions(gl: WebGLRenderer, geometry: BufferGeometry, width: number, height: number): Float32Array | null {
  const target = new WebGLRenderTarget(width, height, {
    type: FloatType,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    depthBuffer: false,
  })
  const material = new ShaderMaterial({
    // v = 0 lands on the target's first row, which is also `ids` row 0.
    vertexShader: 'varying vec3 vPos;\nvoid main() { vPos = position; gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0); }',
    fragmentShader: 'varying vec3 vPos;\nvoid main() { gl_FragColor = vec4(vPos, 1.0); }',
    side: DoubleSide,
  })
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  const scene = new Scene()
  scene.add(mesh)

  const prevTarget = gl.getRenderTarget()
  const prevClear = gl.getClearColor(new Color())
  const prevAlpha = gl.getClearAlpha()
  const out = new Float32Array(width * height * 4)
  try {
    gl.setRenderTarget(target)
    gl.setClearColor(0x000000, 0)
    gl.clear()
    gl.render(scene, new Camera())
    gl.readRenderTargetPixels(target, 0, 0, width, height, out)
    return out
  } catch (err) {
    console.warn('Could not bake texel positions; lasso is unavailable and fills ignore distance', err)
    return null
  } finally {
    gl.setRenderTarget(prevTarget)
    gl.setClearColor(prevClear, prevAlpha)
    target.dispose()
    material.dispose()
  }
}

/** Built at the ID map's size, texel for texel; the texture is scaled to match if it's a different size. */
export function makeTagSource(
  gl: WebGLRenderer,
  geometry: BufferGeometry,
  image: CanvasImageSource & { width: number; height: number },
  idMap: IdMap,
): TagSource {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox!
  const height = box.max.y - box.min.y
  return {
    pixels: readPixels(image, idMap.width, idMap.height),
    positions: bakePositions(gl, geometry, idMap.width, idMap.height),
    reach: FILL_REACH * height,
    step: SEAM_STEP * height,
  }
}

let sourceFactory: (() => TagSource) | null = null

/**
 * Building the tag source needs the renderer and mesh, which only the 3D
 * scene has. It registers a builder here so tools outside the canvas (the tag
 * panel's Clean up) can get the same lazily built source. Returns an unregister.
 */
export function provideTagSource(factory: () => TagSource): () => void {
  sourceFactory = factory
  return () => {
    if (sourceFactory === factory) sourceFactory = null
  }
}

/** The tag source, built on first use; null until the GLB is on screen. */
export const currentTagSource = (): TagSource | null => sourceFactory?.() ?? null

async function decode(
  blob: Blob,
  width: number,
  height: number,
  translate?: (code: number) => number,
): Promise<Uint8Array | null> {
  const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })
  if (bitmap.width !== width || bitmap.height !== height) {
    console.warn(`ID map is ${bitmap.width}x${bitmap.height}, texture is ${width}x${height}; ignoring it`)
    return null
  }
  const rgba = readPixels(bitmap)
  const ids = new Uint8Array(width * height)
  for (let i = 0; i < ids.length; i++) {
    const code = translate ? translate(rgba[i * 4]) : rgba[i * 4]
    ids[i] = code <= MAX_CODE ? code : 0
  }
  return ids
}

const readStorage = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    // Storage blocked: fall through to the saved file.
    return null
  }
}

async function load(width: number, height: number): Promise<IdMap> {
  const draft = readStorage(DRAFT_KEY)
  const v1Draft = draft ? null : readStorage(V1_DRAFT_KEY)
  const sources = [
    ...(draft ? [{ url: draft }] : []),
    ...(v1Draft ? [{ url: v1Draft, translate: fromV1 }] : []),
    { url: ID_MAP_URL },
  ]
  for (const { url, translate } of sources) {
    try {
      const res = await fetch(url)
      // Vite answers missing files with index.html, so check it really is an image.
      if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) continue
      const ids = await decode(await res.blob(), width, height, translate)
      if (!ids) continue
      const map = new IdMap(width, height, ids)
      // Re-save a translated draft under the new key; only then is the old one safe to drop.
      if (translate) void map.saveDraft().then((saved) => saved && localStorage.removeItem(V1_DRAFT_KEY))
      return map
    } catch {
      // Missing or unreadable: try the next source.
    }
  }
  return new IdMap(width, height)
}

let loading: Promise<IdMap> | null = null
let loaded: IdMap | null = null

/** Loads once (draft, else the saved PNG, else empty); stable promise for React's `use()`. */
export function getIdMap(): Promise<IdMap> {
  loading ??= load(ID_MAP_SIZE, ID_MAP_SIZE).then((map) => (loaded = map))
  return loading
}

/** The ID map if it has finished loading, for UI outside the 3D scene. */
export const currentIdMap = () => loaded
