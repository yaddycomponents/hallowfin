import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { AdditiveBlending, AnimationMixer, CanvasTexture, LoopOnce, Matrix4, Vector3 } from 'three'

// The pink guard: "Squid Game Pink Soldier" by Protyanik25 (CC-BY), rigged
// and given a rifle in Blender by tools/rig_guard.py. Two clips come out of
// that export, "Guard" (the bones) and "Rifle" (the gun they follow), and
// they play together: low ready → raise → aim → shot at frame 32.
const HEIGHT = 1.95
const FPS = 24
const SHOT = 32 / FPS
const AIM = 30 / FPS
// both masks ride on the head bone; one is hidden
const MASKS = {
  circle: ['Object_12', 'Object_13', 'Object_14'],
  square: ['Object_8', 'Object_9', 'Object_10'],
}

// a soft white-to-orange blob for the muzzle flash; Bloom does the rest
function flashTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  r.addColorStop(0, 'rgba(255,255,240,1)')
  r.addColorStop(0.25, 'rgba(255,210,120,.9)')
  r.addColorStop(1, 'rgba(255,120,30,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 128, 128)
  return new CanvasTexture(c)
}

// firing: false = low ready; true = raise, aim and shoot once, then hold aim.
// aimAt: the world point the barrel should cross at the shot (the camera).
export function Guard({ firing, aimAt, position, mask = 'circle' }) {
  const { scene, animations } = useGLTF('/models/guard.glb')
  const flash = useRef()
  const light = useRef()
  const fired = useRef(false)
  const flashLeft = useRef(0)

  const { mixer, actions, muzzle, fit, barrelYaw } = useMemo(() => {
    scene.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.frustumCulled = false }
    })
    const mixer = new AnimationMixer(scene)
    const actions = animations.map((clip) => {
      const a = mixer.clipAction(clip)
      a.setLoop(LoopOnce, 1)
      a.clampWhenFinished = true
      return a.play()
    })
    // which way the barrel points at full aim, in the model's own frame
    mixer.setTime(AIM)
    scene.updateMatrixWorld(true)
    const toLocal = new Matrix4().copy(scene.matrixWorld).invert()
    const muzzle = scene.getObjectByName('Muzzle')
    const tip = muzzle.getWorldPosition(new Vector3()).applyMatrix4(toLocal)
    const butt = scene.getObjectByName('Rifle').getWorldPosition(new Vector3()).applyMatrix4(toLocal)
    mixer.setTime(0)
    return {
      mixer, actions, muzzle,
      fit: HEIGHT / 5.91, // the model is 5.91 units tall
      barrelYaw: Math.atan2(tip.x - butt.x, tip.z - butt.z),
    }
  }, [scene, animations])

  useEffect(() => {
    for (const [name, nodes] of Object.entries(MASKS)) nodes.forEach((n) => { const o = scene.getObjectByName(n); if (o) o.visible = name === mask })
  }, [scene, mask])

  // turn him so the barrel, not his chest, lines up with the target
  const rotationY = Math.atan2(aimAt[0] - position[0], aimAt[2] - position[2]) - barrelYaw

  useEffect(() => {
    fired.current = false
    actions.forEach((a) => { a.reset(); a.paused = !firing; a.play() })
    mixer.setTime(0)
  }, [firing, actions, mixer])

  const tex = useMemo(flashTexture, [])
  const v = useMemo(() => new Vector3(), [])

  useFrame((_, dt) => {
    if (firing) mixer.update(dt)
    const t = actions[0]?.time ?? 0
    if (firing && !fired.current && t >= SHOT) {
      fired.current = true
      flashLeft.current = 0.09
      dispatchEvent(new Event('guard-shot'))
    }
    flashLeft.current = Math.max(0, flashLeft.current - dt)
    const on = flashLeft.current > 0
    muzzle.getWorldPosition(v)
    flash.current.position.copy(v)
    flash.current.visible = on
    flash.current.material.rotation = Math.random() * Math.PI
    light.current.position.copy(v)
    light.current.intensity = on ? 40 : 0
  })

  return (
    <>
      <group position={position} rotation-y={rotationY}>
        <primitive object={scene} scale={fit} />
      </group>
      <sprite ref={flash} scale={0.9} visible={false}>
        <spriteMaterial map={tex} color={[3, 2.4, 1.6]} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
      <pointLight ref={light} color="#ffb060" distance={8} decay={2} intensity={0} />
    </>
  )
}

useGLTF.preload('/models/guard.glb')
