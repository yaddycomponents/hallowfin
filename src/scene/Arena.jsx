import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'

// The set: "Squid Game: Red Light Green Light" by DodoBabypop on Sketchfab
// (CC BY-NC-ND 4.0), textures shrunk to webp for the web: the painted walls,
// the houses, the clock board and the cameras. Its own doll, tree and ground
// are hidden; ours stand in their place.
// the set's doll and tree (Arml1Mtl, Face1Mtl, Meshpart1Mtl …), and its dark
// dirt and red line: our sand and lines read better under the game's light
const THEIRS = /1Mtl$|^Ground$|^RedLine$/

// turned so its doll end is at the far end of our field, and scaled so its
// doll spot lands on ours (z -19)
const SCALE = 1.8
const AT = [0, 0, 21.5]

export function Arena() {
  const { scene } = useGLTF('/models/arena.glb')
  useMemo(() => {
    scene.traverse((o) => {
      if (!o.isMesh) return
      if (THEIRS.test(o.material.name)) o.visible = false
      o.receiveShadow = true
    })
  }, [scene])
  return <primitive object={scene} position={AT} rotation-y={Math.PI} scale={SCALE} />
}

useGLTF.preload('/models/arena.glb')
