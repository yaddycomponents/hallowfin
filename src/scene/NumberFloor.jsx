import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, Color, MathUtils, SRGBColorSpace } from 'three'

// The player floor: one tile per player, laid on the sand between the start
// line and the doll, cut from the tracksuit: teal cloth, cream stitching,
// and the player's number on a sewn-on patch. While a name is being drawn
// every tile lies face-down showing a bare shape, and on each tick of the
// flip board (the reel's 'reel-at' event) the shapes shuffle; on 'reel-land'
// only the drawn player's tile turns over to show its patch. Afterwards the
// tiles keep score: pale for passed, dark with a ✕ for out, grey for not here today.
const SHAPES = ['o', 't', 's']
const shapeAt = (r, c) => (r % 2 ? [...SHAPES].reverse() : SHAPES)[c % 3]

export const FLOOR = { z: -10, width: 18, depth: 10 }
const GAP = 0.1

const SUIT = new Color('#037a76')
const SUIT_HI = new Color('#0aa39d')
const SUIT_PASS = new Color('#7fc9bf')
const SUIT_OUT = new Color('#15191c')
const SUIT_AWAY = new Color('#3d4a48')
const AWAY = new Color('#8a8f8c')
const WHITE = new Color('#ffffff')
const SPENT = new Color('#3a3f44')

// stitching just inside the tile's edge, like a seam on the jacket
function stitch(g, colour) {
  g.save()
  g.strokeStyle = colour
  g.lineWidth = 4
  g.setLineDash([12, 9])
  g.strokeRect(16, 16, 224, 224)
  g.restore()
}

function outline(g, shape, cx, cy, r, width) {
  g.lineWidth = width
  g.lineJoin = 'round'
  g.beginPath()
  if (shape === 'o') g.arc(cx, cy, r, 0, Math.PI * 2)
  else if (shape === 't') { g.moveTo(cx, cy - r * 1.05); g.lineTo(cx + r * 1.1, cy + r * 0.85); g.lineTo(cx - r * 1.1, cy + r * 0.85); g.closePath() }
  else g.rect(cx - r * 0.9, cy - r * 0.9, r * 1.8, r * 1.8)
  g.stroke()
}

// face-down: just the shape, in cream on the cloth
function drawShape(shape) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  stitch(g, 'rgba(240,234,220,.45)')
  g.strokeStyle = '#efe9db'
  outline(g, shape, 128, 132, 62, 13)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}

// face-up: the number on a cream patch, with the tile's shape stitched above it
function drawPatch(no, shape) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  stitch(g, 'rgba(240,234,220,.45)')
  g.strokeStyle = 'rgba(240,234,220,.8)'
  outline(g, shape, 128, 56, 18, 6)
  g.fillStyle = '#ece6d6'
  g.beginPath()
  g.roundRect(34, 90, 188, 124, 10)
  g.fill()
  g.save()
  g.strokeStyle = 'rgba(30,40,40,.35)'
  g.lineWidth = 3
  g.setLineDash([8, 6])
  g.beginPath()
  g.roundRect(42, 98, 172, 108, 6)
  g.stroke()
  g.restore()
  g.fillStyle = '#0d2b29'
  g.font = '400 104px "Bebas Neue", sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(no, 128, 157)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}

function crossTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  g.strokeStyle = '#fff'
  g.lineWidth = 14
  g.lineCap = 'round'
  g.beginPath(); g.moveTo(26, 26); g.lineTo(102, 102); g.moveTo(102, 26); g.lineTo(26, 102); g.stroke()
  return new CanvasTexture(c)
}

// the grid shape that gives the biggest tiles on a wide floor (81 → 12 × 7)
function gridFor(n) {
  let cols = 1
  let step = 0
  for (let c = 1; c <= Math.max(1, n); c++) {
    const s = Math.min(FLOOR.width / c, FLOOR.depth / Math.ceil(n / c))
    if (s > step + 1e-6) { step = s; cols = c }
  }
  return { cols, rows: Math.max(1, Math.ceil(n / cols)), step }
}

// the shape on player i's tile, for the called card to match
export const tileShape = (n, i) => {
  const { cols } = gridFor(n)
  return shapeAt(Math.floor(i / cols), i % cols)
}

const backOut = (x) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2

// names: the roster in lobby order; numbers: their patch numbers;
// status: index → the log's result ('failed', or a pass); current: index on the spot (or -1)
// show: laid out on the sand (only for the draw; it folds away for the rest of the turn).
// Once the reel starts, the tiles of players still to play lie face-down (shapes only);
// those who have played stay face-up with their score.
export function NumberFloor({ names, numbers, status, current, show }) {
  const n = names.length
  const { cols, rows, step } = gridFor(n)
  const size = step - GAP
  const home = (i) => shapeAt(Math.floor(i / cols), i % cols)

  const shapes = useMemo(() => Object.fromEntries(SHAPES.map((s) => [s, drawShape(s)])), [])
  const faces = useMemo(() => numbers.map((no, i) => drawPatch(no, home(i))), [numbers, cols])
  useEffect(() => () => faces.forEach((t) => t.dispose()), [faces])
  // the web font may arrive after the first draw: redraw once it has
  useEffect(() => {
    let live = true
    document.fonts?.load('104px "Bebas Neue"').then(() => {
      if (!live) return
      faces.forEach((t, i) => {
        const fresh = drawPatch(numbers[i], home(i))
        t.image = fresh.image
        t.needsUpdate = true
        fresh.dispose()
      })
    })
    return () => { live = false }
  }, [faces, numbers, cols])
  const cross = useMemo(crossTexture, [])

  // shown: the shape each face-down tile shows right now (shuffled by the reel)
  const shown = useRef([])
  // bump: a little hop when a tile's shape changes; flip: 0 face-down … 1 face-up
  const bump = useRef(new Float32Array(n))
  const flip = useRef(new Float32Array(n).fill(1))
  const landed = useRef({ i: -1, t: 0 })
  const hiddenAt = useRef(0)
  const hidden = useRef(false)
  const played = useRef(status)
  played.current = status
  useEffect(() => {
    shown.current = Array.from({ length: n }, (_, i) => home(i))
    bump.current = new Float32Array(n)
    flip.current = new Float32Array(n).fill(1)
  }, [n, cols])
  useEffect(() => {
    // the merry-go-round: two arms sweep round the floor, an eighth of a turn
    // per tick of the ride, and every tile they pass hops and changes shape
    const at = (e) => {
      if (!hidden.current) { hidden.current = true; hiddenAt.current = performance.now() }
      const from = (e.detail * Math.PI) / 4
      const to = from + Math.PI / 4
      for (let i = 0; i < n; i++) {
        if (played.current[i]) continue
        // either arm (the second is half a turn behind) crossed this tile
        const a = angle.current[i]
        const passed = [0, Math.PI].some((k) => {
          const d = (((a - from - k) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
          return d < to - from
        })
        if (!passed) continue
        shown.current[i] = SHAPES[(SHAPES.indexOf(shown.current[i]) + 1 + ((Math.random() * 2) | 0)) % 3]
        bump.current[i] = 1
      }
    }
    const land = (e) => { landed.current = { i: e.detail, t: performance.now() } }
    addEventListener('reel-at', at)
    addEventListener('reel-land', land)
    return () => { removeEventListener('reel-at', at); removeEventListener('reel-land', land) }
  }, [n])
  // each tile's bearing from the middle of the floor, for the sweeping arms
  // (scaled by the grid so the sweep is round, not stretched)
  const angle = useRef([])
  angle.current = useMemo(() => Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols)
    const c = i % cols
    return Math.atan2(((rows - 1) / 2 - r) / rows, (c - (cols - 1) / 2) / cols)
  }), [n, cols, rows])
  // a new draw: every tile face-up again, shapes back in their rows
  useEffect(() => {
    if (!show) return
    hidden.current = false
    landed.current = { i: -1, t: 0 }
    shown.current = Array.from({ length: n }, (_, i) => home(i))
  }, [show, n, cols])

  // the entrance: tiles drop and flip into place in a ripple out from the
  // middle; on the way out they fold away faster, the same way round
  const entrance = useRef({ on: false, at: -1e9 })
  useEffect(() => { entrance.current = { on: show, at: performance.now() } }, [show])
  const delay = useMemo(() => Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols)
    const c = i % cols
    return (Math.abs(c - (cols - 1) / 2) + Math.abs(r - (rows - 1) / 2)) * 45
  }), [n, cols, rows])

  const tiles = useRef([])
  const root = useRef()
  const bed = useRef()
  const tmp = useMemo(() => new Color(), [])
  useFrame((_, dt) => {
    const b = bump.current
    const f = flip.current
    const now = performance.now()
    const pulse = 0.5 + 0.5 * Math.sin(now / 180)
    const { on, at } = entrance.current
    const since = now - at
    const last = Math.max(0, ...delay)
    root.current.visible = on || since < last * 0.4 + 300
    if (!root.current.visible) return
    const open = on ? Math.min(1, since / 350) : 1 - Math.min(1, since / 300)
    bed.current.scale.set(Math.max(0.001, 1 - (1 - open) ** 3), Math.max(0.001, open), 1)
    for (let i = 0; i < n; i++) {
      const tile = tiles.current[i]
      if (!tile) continue
      const a = on
        ? backOut(Math.min(1, Math.max(0, (since - 120 - delay[i]) / 420)))
        : 1 - Math.min(1, Math.max(0, (since - delay[i] * 0.4) / 250))
      b[i] *= Math.exp(-dt * 10)
      const st = status[i]
      const isLanded = i === landed.current.i
      const isOn = i === current || isLanded
      // face-down in a wave from the first tile when the draw opens; the
      // landed tile turns back over, the rest once the draw is done
      const down = hidden.current && !st && !isLanded && now - hiddenAt.current > i * (600 / n)
      f[i] = MathUtils.damp(f[i], down ? 0 : 1, 7, dt)
      const up = f[i] > 0.5
      tile.face.material.map = up ? faces[i] : shapes[shown.current[i] ?? home(i)]
      // the flip itself: squash to an edge and back, lifting off the sand mid-turn
      const turn = Math.abs(Math.cos(f[i] * Math.PI))
      tile.face.scale.x = Math.max(0.02, turn)
      // the cloth: teal, pale once passed, near-black once out; the drawn tile breathes
      tmp.copy(up && st === 'failed' ? SUIT_OUT : up && st === 'absent' ? SUIT_AWAY : up && st ? SUIT_PASS : SUIT)
      if (isOn) tmp.lerp(SUIT_HI, 0.4 + 0.6 * pulse)
      tile.plate.material.color.copy(tmp)
      tile.face.material.color.copy(up && st === 'failed' ? SPENT : up && st === 'absent' ? AWAY : WHITE)
      tile.cross.visible = up && st === 'failed'
      // the landed tile pops, then sits a little proud of the floor
      const pop = isLanded ? Math.max(0, 1 - (now - landed.current.t) / 500) : 0
      tile.k = MathUtils.damp(tile.k ?? 1, 1 + pop * 0.3 + (isOn ? 0.04 : 0), 14, dt)
      tile.z = MathUtils.damp(tile.z ?? 0, (isOn ? 0.18 : 0) + (1 - turn) * 0.25 + b[i] * 0.08, 14, dt)
      // the entrance on top: falling in from above, tipped up, then settling
      tile.group.scale.setScalar(Math.max(0.001, tile.k * Math.min(1, a + 0.2) * (a > 0 ? 1 : 0)))
      tile.group.position.z = tile.z + (1 - a) * 1.6
      tile.group.rotation.x = (1 - a) * 1.2
    }
  })

  const w = cols * step
  const d = rows * step
  return (
    <group ref={root} position={[0, 0.02, FLOOR.z]} rotation-x={-Math.PI / 2} visible={false}>
      <group ref={bed}>
      {/* the bed the tiles sit in: dark cloth with a cream piping round the edge */}
      <mesh position-z={-0.01} receiveShadow>
        <planeGeometry args={[w + 0.5, d + 0.5]} />
        <meshStandardMaterial color="#082826" roughness={0.95} />
      </mesh>
      {[[0, (d + 0.5) / 2, w + 0.56, 0.06], [0, -(d + 0.5) / 2, w + 0.56, 0.06], [(w + 0.5) / 2, 0, 0.06, d + 0.56], [-(w + 0.5) / 2, 0, 0.06, d + 0.56]].map(([x, y, sw, sh], k) => (
        <mesh key={k} position={[x, y, 0]}>
          <planeGeometry args={[sw, sh]} />
          <meshBasicMaterial color="#e9e2d0" />
        </mesh>
      ))}
      </group>
      {names.map((name, i) => {
        const r = Math.floor(i / cols)
        const c = i % cols
        return (
          <group
            key={i}
            // row 0 is the far row, so the grid reads top-to-bottom from the start line
            // a short last row sits centred
            position={[(c - ((r === rows - 1 ? n - r * cols : cols) - 1) / 2) * step, ((rows - 1) / 2 - r) * step, 0]}
            ref={(g) => {
              if (!g) return
              tiles.current[i] = { group: g, plate: g.children[0], face: g.children[1], cross: g.children[2] }
            }}
          >
            <mesh>
              <planeGeometry args={[size, size]} />
              <meshBasicMaterial color={SUIT} />
            </mesh>
            <mesh position-z={0.01}>
              <planeGeometry args={[size, size]} />
              <meshBasicMaterial map={faces[i]} transparent />
            </mesh>
            <mesh position-z={0.02} visible={false}>
              <planeGeometry args={[size * 0.7, size * 0.7]} />
              <meshBasicMaterial map={cross} color="#ed1b76" transparent />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
