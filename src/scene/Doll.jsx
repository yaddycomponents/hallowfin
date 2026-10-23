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

// A bone's rest rotation, read from the file itself rather than the live bone:
// a hot reload while she's turned would otherwise take "turned" as her rest,
// and she'd face the players on green light.
const restOf = (parser, b) => {
  const i = b && parser.associations.get(b)?.nodes
  const r = i != null && parser.json.nodes[i].rotation
  return r ? new Quaternion().fromArray(r) : b?.quaternion.clone()
}

// facing: 0 = back to the players (green light), 1 = looking at them (red light)
export function Doll({ facing = 0, ...props }) {
  const { scene, parser } = useGLTF('/models/doll.glb')
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
    // measured once, in the model's own space: the loaded scene is shared, and
    // on a remount (or a hot reload) it is still inside the scaled group, which
    // would make it measure as already fitted and come out twice the size.
    if (!scene.userData.fit) {
      const parent = scene.parent
      parent?.remove(scene)
      scene.updateMatrixWorld(true)
      const box = new Box3().setFromObject(scene, true)
      const s = HEIGHT / box.getSize(new Vector3()).y
      scene.userData.fit = { scale: s, y: -box.min.y * s }
      parent?.add(scene)
    }
    return { neck, head, base: { neck: restOf(parser, neck), head: restOf(parser, head) }, fit: scene.userData.fit }
  }, [scene, parser])

  const q = useMemo(() => new Quaternion(), [])
  useFrame((_, dt) => {
    // a quick, mechanical turn with a slight overshoot settle
    turn.current = MathUtils.damp(turn.current, facing, facing > turn.current ? 13 : 8, dt)
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
