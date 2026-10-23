import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Color, MathUtils, Vector3 } from 'three'
import { Doll } from './Doll'
import { Field } from './Field'

// Where the camera stands in each phase: back at the start line while names
// spin, walking up the field once someone is called, closest at red light.
const SHOTS = {
  lobby: { pos: [0, 2.2, 6], look: [0, 3.6, -18] },
  pick: { pos: [0, 1.8, 4], look: [0, 2.8, -18] },
  picked: { pos: [0, 1.7, -1], look: [0, 4.2, -18] },
  question: { pos: [0.5, 1.7, -5], look: [0, 3.6, -18] },
  redlight: { pos: [0, 2.2, -8], look: [0, 4.6, -18] },
  survived: { pos: [0, 1.8, -5], look: [0, 4.2, -18] },
  eliminated: { pos: [0, 2.4, -9], look: [0, 4.8, -18] },
  dare: { pos: [0, 1.8, -3], look: [0, 3.4, -18] },
  end: { pos: [0, 2.6, 6], look: [0, 3.6, -18] },
}

const FACING = new Set(['redlight', 'survived', 'eliminated', 'dare'])
const RED = new Set(['redlight', 'eliminated'])

function Rig({ phase }) {
  const look = useRef(new Vector3(0, 2.6, -18))
  const shot = useRef({ phase, at: -9 })
  const p = new Vector3()
  useFrame(({ camera, clock }, dt) => {
    // the shot: half a second of hard camera shake when someone is eliminated
    if (shot.current.phase !== phase) shot.current = { phase, at: phase === 'eliminated' ? clock.elapsedTime : -9 }
    const kick = Math.max(0, 1 - (clock.elapsedTime - shot.current.at) / 0.5) ** 2 * 0.18
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

function Lights({ phase }) {
  const sun = useRef()
  const fill = useRef()
  const warm = new Color('#fff1d6')
  const red = new Color('#ff3b4e')
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 6)
    const target = RED.has(phase) ? red : warm
    sun.current.color.lerp(target, k)
    fill.current.color.lerp(target, k)
    sun.current.intensity = MathUtils.lerp(sun.current.intensity, RED.has(phase) ? 2.2 : 3, k)
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

export function Stage({ phase }) {
  return (
    <Canvas className="stage" shadows="percentage" dpr={[1, 2]} camera={{ fov: 42, position: [0, 2.2, 6], near: 0.1, far: 200 }}>
      <color attach="background" args={['#a9d6f2']} />
      <fog attach="fog" args={['#cfe6f3', 30, 70]} />
      <Rig phase={phase} />
      <Lights phase={phase} />
      <Suspense fallback={null}>
        <Field />
        {/* her back to the players; she faces down the field toward the tree */}
        <Doll position={[0, 0, -19]} rotation-y={Math.PI} facing={FACING.has(phase) ? 1 : 0} />
      </Suspense>
      <EffectComposer>
        <Bloom intensity={0.35} luminanceThreshold={0.85} mipmapBlur />
        <Vignette offset={0.25} darkness={RED.has(phase) ? 0.85 : 0.55} />
      </EffectComposer>
    </Canvas>
  )
}
