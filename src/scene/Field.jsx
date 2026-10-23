import { useMemo } from 'react'
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

// The Red Light, Green Light arena, built in code: a sand field, the red start
// line, walls painted as a summer sky (the set is an indoor hall), and the
// bare tree the doll stands under.
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(...repeat)
  t.anisotropy = 8
  return t
}

const sand = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#c9a66b'
  g.fillRect(0, 0, w, h)
  for (let i = 0; i < 26000; i++) {
    const v = Math.random()
    g.fillStyle = v < 0.5 ? `rgba(120,86,40,${0.05 + v * 0.12})` : `rgba(240,214,160,${0.04 + (v - 0.5) * 0.14})`
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2.5, 1 + Math.random() * 2.5)
  }
  // footprints and drag marks from 456 players
  g.strokeStyle = 'rgba(110,80,40,0.10)'
  for (let i = 0; i < 40; i++) {
    g.lineWidth = 2 + Math.random() * 4
    g.beginPath()
    const x = Math.random() * w
    g.moveTo(x, 0)
    g.bezierCurveTo(x + (Math.random() - 0.5) * 80, h * 0.33, x + (Math.random() - 0.5) * 80, h * 0.66, x + (Math.random() - 0.5) * 60, h)
    g.stroke()
  }
}, [10, 14])

const sky = () => canvasTex(2048, 512, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h)
  grd.addColorStop(0, '#6fb6e8')
  grd.addColorStop(0.75, '#a9d6f2')
  grd.addColorStop(1, '#d7ecf7')
  g.fillStyle = grd
  g.fillRect(0, 0, w, h)
  // flat, painted cumulus: a cluster of white circles with a soft grey belly
  for (let i = 0; i < 14; i++) {
    const cx = (i / 14) * w + Math.random() * 90
    const cy = h * (0.18 + Math.random() * 0.4)
    const r = 30 + Math.random() * 40
    for (let k = 0; k < 7; k++) {
      const x = cx + (k - 3) * r * 0.55 + (Math.random() - 0.5) * 10
      const y = cy - Math.sin((k / 6) * Math.PI) * r * 0.6
      g.fillStyle = '#e9eef2'
      g.beginPath(); g.arc(x, y + 6, r * (0.6 + Math.random() * 0.3), 0, 7); g.fill()
      g.fillStyle = '#ffffff'
      g.beginPath(); g.arc(x, y, r * (0.55 + Math.random() * 0.3), 0, 7); g.fill()
    }
  }
}, [1, 1])

function Tree(props) {
  // a bare, gnarled tree: tapering trunk and branches as cylinders
  const branches = useMemo(() => {
    const out = []
    const grow = (x, y, z, ry, tilt, len, r, depth) => {
      // branches spread sideways and back, never toward the players, so none
      // crosses in front of the doll (a branch heads along (cos ry, sin ry) in x/z)
      if (Math.sin(ry) > 0) ry = -ry
      out.push({ x, y, z, ry, tilt, len, r })
      if (depth === 0) return
      const ex = x + Math.sin(tilt) * Math.cos(ry) * len
      const ey = y + Math.cos(tilt) * len
      const ez = z + Math.sin(tilt) * Math.sin(ry) * len
      const kids = depth > 2 ? 3 : 2
      for (let k = 0; k < kids; k++) {
        grow(ex, ey, ez, ry + (k - (kids - 1) / 2) * 1.6 + Math.random() * 0.6, Math.min(1.3, tilt + 0.35 + Math.random() * 0.35), len * 0.7, r * 0.62, depth - 1)
      }
    }
    grow(0, 0, 0, 0, 0.05, 3.2, 0.42, 4)
    return out
  }, [])
  return (
    <group {...props}>
      {branches.map((b, i) => (
        <group key={i} position={[b.x, b.y, b.z]} rotation={[0, -b.ry, 0]}>
          <mesh rotation={[0, 0, -b.tilt]} position={[Math.sin(b.tilt) * b.len / 2, Math.cos(b.tilt) * b.len / 2, 0]} castShadow>
            <cylinderGeometry args={[b.r * 0.62, b.r, b.len, 7]} />
            <meshStandardMaterial color="#4a3a2c" roughness={0.95} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function Field() {
  const sandTex = useMemo(sand, [])
  const skyTex = useMemo(sky, [])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -20]} receiveShadow>
        <planeGeometry args={[60, 80]} />
        <meshStandardMaterial map={sandTex} roughness={1} />
      </mesh>
      {/* the start line, just in front of the players */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, -2.2]}>
        <planeGeometry args={[60, 0.35]} />
        <meshStandardMaterial color="#c4161c" roughness={0.9} />
      </mesh>
      {/* the finish line under the doll */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, -17]}>
        <planeGeometry args={[60, 0.35]} />
        <meshStandardMaterial color="#c4161c" roughness={0.9} />
      </mesh>
      {/* painted-sky walls: back and both sides */}
      <mesh position={[0, 9, -30]}>
        <planeGeometry args={[60, 18]} />
        <meshBasicMaterial map={skyTex} toneMapped={false} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 22, 9, -15]} rotation-y={-s * Math.PI / 2}>
          <planeGeometry args={[40, 18]} />
          <meshBasicMaterial map={skyTex} toneMapped={false} />
        </mesh>
      ))}
      {/* behind her, as on the show's field */}
      <Tree position={[2.6, 0, -23.5]} scale={1.2} />
    </group>
  )
}
