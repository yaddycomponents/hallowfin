import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Box3, MathUtils, MeshStandardMaterial, Quaternion, Vector3 } from 'three'

// Young-hee: "Squid Game Doll Rig" by Bug All (CC-BY), a Rigify skeleton.
// She stands with her back to the players; on red light her head swings
// round 180° to face them. The turn is shared between neck and head bones so
// the skin at the collar doesn't tear.
const HEIGHT = 6.4 // metres: the giant doll on the field
const NECK_SHARE = 0.3
const Y_AXIS = new Vector3(0, 1, 0) // Blender bones point along their own +Y

const bone = (root, re) => {
  let hit = null
  root.traverse((o) => { if (!hit && o.isBone && re.test(o.name)) hit = o })
  return hit
}

// facing: 0 = back to the players (green light), 1 = looking at them (red light)
export function Doll({ facing = 0, ...props }) {
  const { scene } = useGLTF('/models/doll.glb')
  const turn = useRef(0)

  // the export is unlit (flat colour); give it a lit material so the sun shapes her
  const { neck, head, base, fit } = useMemo(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.material = new MeshStandardMaterial({ map: o.material.map, roughness: 0.55, metalness: 0 })
        o.castShadow = true
        o.frustumCulled = false
      }
    })
    const neck = bone(scene, /spine\.?004/)
    const head = bone(scene, /spine\.?005/)
    const box = new Box3().setFromObject(scene, true)
    const size = box.getSize(new Vector3())
    const s = HEIGHT / size.y
    return {
      neck, head,
      base: { neck: neck?.quaternion.clone(), head: head?.quaternion.clone() },
      fit: { scale: s, y: -box.min.y * s },
    }
  }, [scene])

  const q = useMemo(() => new Quaternion(), [])
  useFrame((_, dt) => {
    // a quick, mechanical turn with a slight overshoot settle
    turn.current = MathUtils.damp(turn.current, facing, facing > turn.current ? 7 : 4, dt)
    const a = turn.current * Math.PI
    if (neck) neck.quaternion.copy(base.neck).multiply(q.setFromAxisAngle(Y_AXIS, a * NECK_SHARE))
    if (head) head.quaternion.copy(base.head).multiply(q.setFromAxisAngle(Y_AXIS, a * (1 - NECK_SHARE)))
  })

  return (
    <group {...props}>
      <group scale={fit.scale} position-y={fit.y}>
        <primitive object={scene} />
      </group>
    </group>
  )
}

useGLTF.preload('/models/doll.glb')
