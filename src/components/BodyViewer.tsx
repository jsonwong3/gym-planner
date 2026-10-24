import { Suspense, use, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Bvh, OrbitControls, useCursor, useGLTF, useProgress } from '@react-three/drei'
import { Box3, Color, MOUSE, SRGBColorSpace, TOUCH, Vector3, Vector4 } from 'three'
import type * as THREE from 'three'
import { MUSCLE_PARTS, SKIN } from '../data/bodyParts'
import type { MusclePartInstance, Shape } from '../data/bodyParts'
import { MUSCLE_IDS, TARGETS, displayTarget, groupOf, isGroup, muscleFromMeshName } from '../data/muscles'
import type { MuscleId, Target } from '../data/muscles'
import { UNTRAINED, formatSets, heatColor, levelOf } from '../heat'
import { getIdMap, makeTagSource, swatch } from '../idMap'
import type { IdMap, TagSource } from '../idMap'
import { attachLasso, texelsInLasso } from '../lasso'
import { useStore } from '../store'
import { useHeat } from '../useHeat'
import TagPanel from './TagPanel'

const CAMERA_START: [number, number, number] = [0, 0.4, 5.4]

/** What the camera orbits round: roughly the body's centre. */
const ORBIT_TARGET: [number, number, number] = [0, 0.2, 0]

/** Orbit bindings. While lassoing, left-drag / one finger draws, so orbiting moves to right-drag / two fingers. */
const ORBIT_INPUT = {
  mouseButtons: { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN },
  touches: { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN },
}
const LASSO_INPUT = {
  // Unbound (undefined) leaves the button to the lasso; OrbitControls ignores it.
  mouseButtons: { LEFT: undefined, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE },
  touches: { ONE: undefined, TWO: TOUCH.DOLLY_ROTATE },
}

/** A tap selects; a drag (orbit) should not. R3F reports pointer travel as `delta` (px). */
const isDrag = (e: ThreeEvent<MouseEvent>) => e.delta > 6

function Geometry({ shape }: { shape: Shape }) {
  switch (shape.kind) {
    case 'capsule':
      return <capsuleGeometry args={[shape.radius, shape.length, 6, 16]} />
    case 'sphere':
      return <sphereGeometry args={[shape.radius, 28, 28]} />
    case 'box':
      return <boxGeometry args={shape.size} />
  }
}

/**
 * Material for a muscle. `heat` is null in normal mode (selection colours),
 * otherwise 0 = untrained and 0.08-1 = how hard the plan works the muscle.
 */
function look(heat: number | null, selected: boolean, hovered: boolean) {
  if (heat === null) {
    return {
      color: selected ? '#ffc857' : hovered ? '#ff7a59' : '#b8433f',
      emissive: selected ? '#ff9f1c' : '#ff4d2e',
      emissiveIntensity: selected ? 0.55 : hovered ? 0.35 : 0,
    }
  }
  const lit = heat > 0
  const base = lit ? heatColor(heat) : UNTRAINED
  return {
    color: base,
    emissive: lit ? base : '#8aa0c0',
    // Hot muscles glow a little on their own; hover/selection add on top.
    emissiveIntensity: (lit ? 0.25 + 0.3 * heat : 0) + (hovered ? 0.25 : 0) + (selected ? 0.5 : 0),
  }
}

/**
 * `target` is what this mesh currently stands for: its muscle, or the whole
 * group (e.g. all three deltoid heads) until the user drills into it.
 */
function MusclePart({ part, target, heat }: { part: MusclePartInstance; target: Target; heat: number | null }) {
  const selected = useStore((s) => s.selected === target)
  const hovered = useStore((s) => s.hovered === target)
  const select = useStore((s) => s.select)
  const hover = useStore((s) => s.hover)
  const drillDown = useStore((s) => s.drillDown)
  const m = look(heat, selected, hovered)

  return (
    <mesh
      name={part.name}
      position={part.position}
      scale={part.scale}
      rotation={part.rotation}
      onPointerOver={(e) => {
        e.stopPropagation()
        hover(target)
      }}
      onPointerOut={() => hover(null)}
      onClick={(e) => {
        e.stopPropagation()
        if (isDrag(e)) return
        select(target)
      }}
      onContextMenu={(e) => {
        e.stopPropagation()
        e.nativeEvent.preventDefault()
        // Same lookup you'll use with a real GLB: mesh name -> muscle.
        const muscle = muscleFromMeshName(e.object.name)
        if (muscle) drillDown(muscle)
      }}
    >
      <Geometry shape={part.shape} />
      <meshStandardMaterial
        color={m.color}
        emissive={m.emissive}
        emissiveIntensity={m.emissiveIntensity}
        roughness={0.55}
        metalness={0.05}
      />
    </mesh>
  )
}

/**
 * Non-muscle body pieces. They have handlers on purpose: that makes them
 * part of the raycast, so you can't click "through" the torso to a muscle
 * on the far side. Tapping bare skin clears the selection.
 */
function SkinMesh({ piece }: { piece: (typeof SKIN)[number] }) {
  const select = useStore((s) => s.select)
  return (
    <mesh
      name={piece.name}
      position={piece.position}
      scale={piece.scale}
      rotation={piece.rotation}
      onPointerOver={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        if (!isDrag(e)) select(null)
      }}
    >
      <Geometry shape={piece.shape} />
      <meshStandardMaterial color="#2c3542" roughness={0.8} />
    </mesh>
  )
}

function Body() {
  const hovered = useStore((s) => s.hovered)
  const heatmapOn = useStore((s) => s.tab === 'heatmap')
  const expanded = useStore((s) => s.expanded)
  const result = useHeat()
  useCursor(!!hovered)
  return (
    <group>
      {SKIN.map((p) => (
        <SkinMesh key={p.name} piece={p} />
      ))}
      {MUSCLE_PARTS.map((p) => {
        const target = displayTarget(p.muscle, expanded)
        return <MusclePart key={p.name} part={p} target={target} heat={heatmapOn ? levelOf(result, target) : null} />
      })}
    </group>
  )
}

const MODEL_URL = '/models/body.glb'
/** Placeholder body's height and foot level, so the GLB fits the same camera framing. */
const BODY_HEIGHT = 3.5
const BODY_FEET_Y = -1.53

/** Uniforms the GLB's patched material reads; arrays are indexed by muscle code (0 = untagged). */
interface IdUniforms {
  uIdMap: { value: THREE.Texture }
  /** rgb = tint colour (linear), a = how much it replaces the texture. */
  uTint: { value: Vector4[] }
  /** Added emissive light. */
  uGlow: { value: Color[] }
}

/**
 * Teaches the model's own material to tint each muscle by looking up the ID
 * map at the fragment's UV, so highlighting and the heatmap work on one mesh.
 */
function patchMaterial(material: THREE.MeshStandardMaterial, uniforms: IdUniforms) {
  const n = MUSCLE_IDS.length + 1
  // Tripo's metalness map reads as full metal, which renders black without an environment map.
  material.metalness = 0
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader =
      'varying vec2 vIdUv;\n' + shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n\tvIdUv = uv;')
    shader.fragmentShader =
      `uniform sampler2D uIdMap;\nuniform vec4 uTint[${n}];\nuniform vec3 uGlow[${n}];\nvarying vec2 vIdUv;\n` +
      shader.fragmentShader
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
	int muscleCode = int( texture2D( uIdMap, vIdUv ).r * 255.0 + 0.5 );
	diffuseColor.rgb = mix( diffuseColor.rgb, uTint[ muscleCode ].rgb, uTint[ muscleCode ].a );`,
        )
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += uGlow[ muscleCode ];')
  }
  material.customProgramCacheKey = () => 'muscle-id-map'
  material.needsUpdate = true
}

/** Which muscle a hit on the GLB landed on: a split mesh's name if it has one, else the ID map. */
function muscleAt(e: ThreeEvent<PointerEvent | MouseEvent>, idMap: IdMap): MuscleId | null {
  return muscleFromMeshName(e.object.name) ?? (e.uv ? idMap.at(e.uv.x, e.uv.y) : null)
}

/** The model's main textured mesh (Tripo exports a single one). */
function findSkinnedMesh(scene: THREE.Object3D): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  let found: THREE.Mesh | null = null
  scene.traverse((o) => {
    if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh
  })
  if (!found) throw new Error(`${MODEL_URL} has no meshes`)
  return found
}

/**
 * The real model. Muscles come from the ID map (tagged in tag mode) or from
 * mesh names once it's split in Blender; anything else behaves like skin:
 * it blocks the raycast and tapping it clears the selection.
 */
function GLBBody() {
  const { scene } = useGLTF(MODEL_URL)
  const mesh = useMemo(() => findSkinnedMesh(scene), [scene])
  // GLTFLoader decodes to an ImageBitmap (or an <img> on older Safari); both can be drawn to a canvas.
  const image = mesh.material.map?.image as (ImageBitmap | HTMLImageElement) | undefined
  if (!image) throw new Error(`${MODEL_URL} has no base-colour texture to tag`)
  const idMap = use(getIdMap(image.width, image.height))

  const select = useStore((s) => s.select)
  const hover = useStore((s) => s.hover)
  const drillDown = useStore((s) => s.drillDown)
  const bumpIdMap = useStore((s) => s.bumpIdMap)
  const hovered = useStore((s) => s.hovered)
  const selected = useStore((s) => s.selected)
  const expanded = useStore((s) => s.expanded)
  const heatmapOn = useStore((s) => s.tab === 'heatmap')
  const tagging = useStore((s) => s.tagging)
  const tagMuscle = useStore((s) => s.tagMuscle)
  const lassoOn = useStore((s) => s.tagging && s.tagTool !== 'fill')
  const heat = useHeat()
  useCursor(!!hovered || tagging)

  const uniforms = useMemo<IdUniforms>(
    () => ({
      uIdMap: { value: idMap.texture },
      // Explicit zeros: a bare Vector4() has w = 1, which would paint everything black.
      uTint: { value: Array.from({ length: MUSCLE_IDS.length + 1 }, () => new Vector4(0, 0, 0, 0)) },
      uGlow: { value: Array.from({ length: MUSCLE_IDS.length + 1 }, () => new Color(0, 0, 0)) },
    }),
    [idMap],
  )
  useEffect(() => patchMaterial(mesh.material, uniforms), [mesh, uniforms])
  // Lets the tag panel (outside the canvas) know the map is ready to read.
  useEffect(bumpIdMap, [idMap, bumpIdMap])

  // Same colours as the placeholder's `look()`; untouched muscles keep the model's texture.
  useEffect(() => {
    MUSCLE_IDS.forEach((muscle, i) => {
      const tint = uniforms.uTint.value[i + 1]
      const glow = uniforms.uGlow.value[i + 1]
      if (tagging) {
        const c = new Color().setRGB(...(swatch(i + 1).map((x) => x / 255) as [number, number, number]), SRGBColorSpace)
        const active = muscle === tagMuscle
        tint.set(c.r, c.g, c.b, active ? 0.9 : 0.6)
        glow.copy(c).multiplyScalar(active ? 0.4 : 0)
        return
      }
      const target = displayTarget(muscle, expanded)
      const level = heatmapOn ? levelOf(heat, target) : null
      const isSelected = selected === target
      const isHovered = hovered === target
      if (level === null && !isSelected && !isHovered) {
        tint.set(0, 0, 0, 0)
        glow.setRGB(0, 0, 0)
        return
      }
      const m = look(level, isSelected, isHovered)
      const c = new Color(m.color)
      tint.set(c.r, c.g, c.b, level === null ? 0.65 : 0.85)
      glow.set(m.emissive).multiplyScalar(m.emissiveIntensity)
    })
  }, [uniforms, tagging, tagMuscle, expanded, heatmapOn, heat, selected, hovered])

  // Tag tool inputs; built on first use in tag mode, not on every load.
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const tagSource = useRef<TagSource | null>(null)
  const getTagSource = () => (tagSource.current ??= makeTagSource(gl, mesh.geometry, image))

  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null

  // Ctrl/Cmd + left-drag pans while lassoing. OrbitControls pans when a modifier
  // is held on a button bound to ROTATE, so bind left to ROTATE for just that
  // press; this capture listener runs before OrbitControls' own.
  useEffect(() => {
    if (!lassoOn || !controls) return
    const el = gl.domElement
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      controls.mouseButtons = { ...controls.mouseButtons, LEFT: e.ctrlKey || e.metaKey ? MOUSE.ROTATE : undefined }
    }
    el.addEventListener('pointerdown', down, { capture: true })
    return () => {
      el.removeEventListener('pointerdown', down, { capture: true })
      // Pan only exists while lassoing; recentre so the normal view isn't stuck off to one side.
      const offset = new Vector3(...ORBIT_TARGET).sub(controls.target)
      controls.target.add(offset)
      camera.position.add(offset)
      controls.update()
    }
  }, [lassoOn, controls, gl, camera])

  useEffect(() => {
    if (!lassoOn) return
    return attachLasso(gl.domElement, (points) => {
      const { positions } = getTagSource()
      if (!positions) return
      const { tagTool, tagMuscle } = useStore.getState()
      const { clientWidth: width, clientHeight: height } = gl.domElement
      const picked = texelsInLasso({ gl, camera, mesh, positions, points, width, height })
      if (idMap.assign(picked, tagTool === 'erase' ? null : tagMuscle, positions)) bumpIdMap()
    })
  }, [lassoOn, gl, camera, mesh, idMap, bumpIdMap])

  const onTap = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (isDrag(e)) return
    const { tagging, tagTool, tagMuscle, tagTolerance } = useStore.getState()
    if (!tagging) {
      const muscle = muscleAt(e, idMap)
      select(muscle ? displayTarget(muscle, useStore.getState().expanded) : null)
      return
    }
    // The lasso tools act on drag (see attachLasso); only the fill tool uses taps.
    if (tagTool !== 'fill' || !e.uv) return
    idMap.fill(e.uv.x, e.uv.y, tagMuscle, getTagSource(), tagTolerance)
    bumpIdMap()
  }

  // Exporters use arbitrary units and origins: scale to the placeholder's height, feet on its floor.
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(scene)
    const centre = box.getCenter(new Vector3())
    const scale = BODY_HEIGHT / box.getSize(new Vector3()).y
    return { scale, position: [-centre.x * scale, BODY_FEET_Y - box.min.y * scale, -centre.z * scale] as const }
  }, [scene])

  return (
    // Without a BVH, raycasting a ~2M-triangle mesh on every pointer move stutters.
    <Bvh firstHitOnly>
      <primitive
        object={scene}
        scale={fit.scale}
        position={fit.position}
        // One mesh holds every muscle, so hover has to follow the pointer, not just enter/leave.
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          const muscle = muscleAt(e, idMap)
          // Tag mode names the exact muscle under the pointer, never its group.
          hover(muscle && !tagging ? displayTarget(muscle, expanded) : muscle)
        }}
        onPointerOut={() => hover(null)}
        onClick={onTap}
        onContextMenu={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          e.nativeEvent.preventDefault()
          // Right-drag orbits while lassoing; only a still right-click picks or drills.
          if (isDrag(e)) return
          const muscle = muscleAt(e, idMap)
          if (!muscle) return
          // In tag mode right-click is an eyedropper, handy for touching up a muscle.
          if (tagging) useStore.getState().setTagMuscle(muscle)
          else drillDown(muscle)
        }}
      />
    </Bvh>
  )
}

interface ControlsLike {
  target: THREE.Vector3
  mouseButtons: { LEFT?: MOUSE; MIDDLE?: MOUSE; RIGHT?: MOUSE }
  update: () => void
}

/** Smoothly orbits the camera to the azimuth requested by the Front/Back/Left/Right buttons. */
function CameraRig() {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null
  const nonce = useStore((s) => s.view.nonce)
  const goal = useRef<number | null>(null)

  useEffect(() => {
    if (nonce === 0) return
    const { azimuth, reset } = useStore.getState().view
    if (!reset || !controls) {
      goal.current = azimuth
      return
    }
    goal.current = null
    controls.target.set(...ORBIT_TARGET)
    camera.position.set(...CAMERA_START)
    controls.update()
  }, [nonce, controls, camera])

  useFrame(() => {
    if (goal.current === null || !controls) return
    const t = controls.target
    const dx = camera.position.x - t.x
    const dz = camera.position.z - t.z
    const radius = Math.hypot(dx, dz)
    let az = Math.atan2(dx, dz)
    const diff = Math.atan2(Math.sin(goal.current - az), Math.cos(goal.current - az))
    if (Math.abs(diff) < 0.002) {
      goal.current = null
      return
    }
    az += diff * 0.12
    camera.position.x = t.x + radius * Math.sin(az)
    camera.position.z = t.z + radius * Math.cos(az)
    controls.update()
  })

  return null
}

/** Muscle name, plus its weighted sets while the heatmap is showing. */
function useMuscleLabel(id: Target | null) {
  const heatmapOn = useStore((s) => s.tab === 'heatmap')
  const heat = useHeat()
  if (!id) return null
  return heatmapOn ? `${TARGETS[id].label} · ${formatSets(heat.load[id])} sets` : TARGETS[id].label
}

/** What right-clicking the hovered target would do, if anything. */
function drillHint(id: Target | null): string | null {
  if (!id) return null
  if (isGroup(id)) return 'Right-click for parts'
  return groupOf(id) ? 'Right-click to regroup' : null
}

/**
 * Hovered muscle's name, following the pointer. Positioned by writing the
 * style directly so pointer moves don't re-render React.
 */
function CursorLabel() {
  const ref = useRef<HTMLDivElement>(null)
  const hovered = useStore((s) => s.hovered)
  const label = useMuscleLabel(hovered)
  const tagging = useStore((s) => s.tagging)
  const hint = tagging ? (hovered ? 'Right-click to pick' : null) : drillHint(hovered)

  useEffect(() => {
    const el = ref.current
    const viewer = el?.parentElement
    if (!el || !viewer) return
    const move = (e: PointerEvent) => {
      const r = viewer.getBoundingClientRect()
      el.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 18}px)`
    }
    viewer.addEventListener('pointermove', move)
    return () => viewer.removeEventListener('pointermove', move)
  }, [])

  return (
    <div ref={ref} className={`cursor-label ${label ? 'on' : ''}`} aria-hidden>
      {label}
      {hint && <small>{hint}</small>}
    </div>
  )
}

function Hud() {
  const heatmapOn = useStore((s) => s.tab === 'heatmap')
  const tagging = useStore((s) => s.tagging)
  const lassoOn = useStore((s) => s.tagTool !== 'fill')
  const label = useMuscleLabel(useStore((s) => s.hovered ?? s.selected))
  return (
    <>
      <div className={`hud-label ${label ? 'on' : ''}`}>{label}</div>
      <div className="hud-hint">
        {tagging
          ? lassoOn
            ? 'Draw round an area to tag it · right-drag to rotate · Ctrl-drag to move · Ctrl+Z to undo'
            : 'Tap a colour patch to tag it · drag to rotate · right-click to pick a muscle'
          : heatmapOn
          ? 'Colour = weighted sets · tap a muscle for the breakdown'
          : 'Drag to rotate · scroll to zoom · tap a muscle · right-click for detail'}
      </div>
    </>
  )
}

/** Shown over the canvas while the GLB downloads (drei's `<Html>` as a Suspense fallback crashes on unmount). */
function ModelLoading() {
  const { active, progress } = useProgress()
  return active ? <div className="model-loading">Loading model… {Math.round(progress)}%</div> : null
}

function ViewControls() {
  const snapView = useStore((s) => s.snapView)
  const resetView = useStore((s) => s.resetView)
  const autoRotate = useStore((s) => s.autoRotate)
  const toggle = useStore((s) => s.toggleAutoRotate)
  const drilled = useStore((s) => s.expanded.length > 0)
  const resetDrillDown = useStore((s) => s.resetDrillDown)
  const glb = useStore((s) => s.model === 'glb')
  const toggleModel = useStore((s) => s.toggleModel)
  const tagging = useStore((s) => s.tagging)
  const toggleTagging = useStore((s) => s.toggleTagging)
  return (
    <div className="view-controls" role="group" aria-label="Camera view">
      {drilled && (
        <button className="reset-detail" onClick={resetDrillDown} title="Merge split muscles back into groups">
          ↺ Regroup
        </button>
      )}
      <button onClick={resetView} title="Centre the body and reset zoom">
        Reset
      </button>
      <button onClick={() => snapView(0)}>Front</button>
      <button onClick={() => snapView(Math.PI / 2)}>Left</button>
      <button onClick={() => snapView(Math.PI)}>Back</button>
      <button onClick={() => snapView(-Math.PI / 2)}>Right</button>
      <button className={autoRotate ? 'active' : ''} onClick={toggle} aria-pressed={autoRotate}>
        Spin
      </button>
      <button className={glb ? 'active' : ''} onClick={toggleModel} aria-pressed={glb} title="Show the model from public/models/body.glb">
        GLB
      </button>
      {glb && (
        <button className={tagging ? 'active' : ''} onClick={toggleTagging} aria-pressed={tagging} title="Paint which part of the model is which muscle">
          Tag
        </button>
      )}
    </div>
  )
}

export default function BodyViewer() {
  const autoRotate = useStore((s) => s.autoRotate)
  const select = useStore((s) => s.select)
  const glb = useStore((s) => s.model === 'glb')
  const tagging = useStore((s) => s.tagging)
  const lassoOn = useStore((s) => s.tagging && s.tagTool !== 'fill' && s.model === 'glb')

  return (
    // Right-click drills into muscles, so the browser menu would only get in the way.
    <div className="viewer" onContextMenu={(e) => e.preventDefault()}>
      <Canvas
        camera={{ position: CAMERA_START, fov: 38 }}
        dpr={[1, 2]}
        onPointerMissed={() => select(null)}
      >
        <color attach="background" args={['#0f131a']} />
        <ambientLight intensity={0.7} />
        <hemisphereLight args={['#bcd4ff', '#1b1b1b', 0.7]} />
        <directionalLight position={[3, 4, 5]} intensity={1.7} />
        <directionalLight position={[-3, 2, -5]} intensity={1.1} />

        {glb ? (
          <Suspense fallback={null}>
            <GLBBody />
          </Suspense>
        ) : (
          <Body />
        )}
        <CameraRig />
        <OrbitControls
          makeDefault
          enablePan={lassoOn}
          // Close enough to lasso small muscles; zooming toward the cursor (tag mode) gets you to them.
          minDistance={glb ? 0.4 : 2.5}
          zoomToCursor={lassoOn}
          maxDistance={8}
          target={ORBIT_TARGET}
          autoRotate={autoRotate}
          autoRotateSpeed={1.4}
          {...(lassoOn ? LASSO_INPUT : ORBIT_INPUT)}
        />
      </Canvas>
      <Hud />
      <CursorLabel />
      <ViewControls />
      {glb && <ModelLoading />}
      {glb && tagging && <TagPanel />}
    </div>
  )
}
