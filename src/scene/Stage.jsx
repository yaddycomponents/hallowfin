import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Color, MathUtils, Vector3 } from 'three'
import { Doll } from './Doll'
import { Field } from './Field'
import { Arena } from './Arena'
import { Guard } from './Guard'
import { NumberFloor } from './NumberFloor'

// Where the camera stands in each phase: back at the start line while names
// spin, walking up the field once someone is called, closest at red light.
const SHOTS = {
  lobby: { pos: [0, 2.2, 6], look: [0, 3.6, -18] },
  // picking: up high, looking down on the player floor
  pick: { pos: [0, 12.5, 3.5], look: [0, 0, -10.6] },
  picked: { pos: [0, 1.7, -1], look: [0, 4.2, -18] },
  question: { pos: [0.5, 1.7, -5], look: [0, 3.6, -18] },
  redlight: { pos: [0, 2.2, -8], look: [0, 4.6, -18] },
  survived: { pos: [0, 1.8, -5], look: [0, 4.2, -18] },
  eliminated: { pos: [-0.6, 1.8, -13], look: [2.8, 1.9, -19.6] },
  dare: { pos: [0, 1.8, -3], look: [0, 3.4, -18] },
  end: { pos: [0, 2.6, 6], look: [0, 3.6, -18] },
}

// guards stand in a line either side of the doll, by the tree; when someone
// fails the one beside the tree shoots at you: just right of the camera, so
// the rifle reads side-on rather than end-on, and points away from the doll
const GUARDS = [
  { at: [3.2, 0, -19.6], mask: 'circle', shooter: true },
  { at: [-3.2, 0, -19.6], mask: 'square' },
  { at: [5.8, 0, -20.8], mask: 'square' },
  { at: [-5.8, 0, -20.8], mask: 'circle' },
]
const VICTIM_AT = [2.4, 1.6, -11]
const WATCH_AT = [0, 1.5, -6] // the others just watch the field
const FIRING = new Set(['eliminated', 'dare'])

const FACING = new Set(['redlight', 'survived', 'eliminated', 'dare'])
const RED = new Set(['redlight', 'eliminated'])

function Rig({ phase }) {
  const look = useRef(new Vector3(0, 2.6, -18))
  const shotAt = useRef(-9)
  const p = new Vector3()
  // the shot: half a second of hard camera shake when the guard fires
  useEffect(() => {
    const hit = () => { shotAt.current = performance.now() / 1000 }
    addEventListener('guard-shot', hit)
    return () => removeEventListener('guard-shot', hit)
  }, [])
  useFrame(({ camera, clock }, dt) => {
    const kick = Math.max(0, 1 - (performance.now() / 1000 - shotAt.current) / 0.5) ** 2 * 0.18
    const s = SHOTS[phase] ?? SHOTS.pick
    camera.position.lerp(p.set(...s.pos), 1 - Math.exp(-dt * 1.6))
    // a slow handheld drift so the frame never sits dead still
    camera.position.x += Math.sin(clock.elapsedTime * 0.4) * 0.002
    look.current.lerp(p.set(...s.look), 1 - Math.exp(-dt * 2))
    camera.lookAt(look.current)
    if (kick) camera.rotation.z += (Math.random() - 0.5) * kick, camera.position.y += (Math.random() - 0.5) * kick
  })
  return null
}

function Lights({ red: isRed }) {
  const sun = useRef()
  const fill = useRef()
  const warm = new Color('#fff1d6')
  const red = new Color('#ff3b4e')
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 6)
    const target = isRed ? red : warm
    sun.current.color.lerp(target, k)
    fill.current.color.lerp(target, k)
    sun.current.intensity = MathUtils.lerp(sun.current.intensity, isRed ? 2.2 : 3, k)
  })
  return (
    <>
      <hemisphereLight ref={fill} args={['#fff1d6', '#7a5a34', 1.1]} />
      <directionalLight
        ref={sun}
        position={[8, 18, 6]}
        intensity={3}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0004}
      />
      {/* from the tree's side, so her face is lit when she turns round */}
      <directionalLight position={[-6, 10, -34]} intensity={1.4} color="#ffe6cc" />
    </>
  )
}

// watching: red light mid-question, she has turned round to look
// roster: { names, numbers, status, current } for the player wall
export function Stage({ phase, watching = false, roster }) {
  const red = RED.has(phase) || watching
  return (
    <Canvas className="stage" shadows="percentage" dpr={[1, 2]} camera={{ fov: 42, position: [0, 2.2, 6], near: 0.1, far: 200 }}>
      <color attach="background" args={['#a9d6f2']} />
      <fog attach="fog" args={['#cfe6f3', 30, 70]} />
      <Rig phase={phase} />
      <Lights red={red} />
      <Suspense fallback={null}>
        <Field inArena />
        <Arena />
        {/* her back to the players; she faces down the field toward the tree */}
        <Doll position={[0, 0, -19]} rotation-y={Math.PI} facing={FACING.has(phase) || watching ? 1 : 0} />
        {roster && <NumberFloor {...roster} show={phase === 'pick'} />}
        {GUARDS.map((g, i) => (
          <Guard key={i} position={g.at} mask={g.mask} aimAt={g.shooter ? VICTIM_AT : WATCH_AT} firing={g.shooter && FIRING.has(phase)} />
        ))}
      </Suspense>
      <EffectComposer>
        <Bloom intensity={0.35} luminanceThreshold={0.85} mipmapBlur />
        <Vignette offset={0.25} darkness={red ? 0.85 : 0.55} />
      </EffectComposer>
    </Canvas>
  )
}
