// Dalgona: instead of a question, the called player carves a shape out of a
// honeycomb candy on their own phone, like the show's second game. The host
// chooses when (on the phone remote, or D); the shape comes from the seed like
// every other draw.
//
// Shapes are outlines in candy space: 0..1 across the candy square, the candy
// a disc of radius 0.46 in the middle. An outline is a list of strokes (the
// umbrella's handle is its own stroke), each a list of [x, y].
import { parseSeed, pcg32 } from './pcg'

export const SECONDS = 90 // to carve, from the moment their phone picks it up
export const LIVES = 3 // cracks before the candy breaks
export const DONE = 1 // the whole line cut (the phone forgives a slip, never a gap)

export const SHAPES = ['circle', 'triangle', 'star', 'umbrella', 'heart', 'bolt', 'octopus', 'bat', 'pumpkin', 'ghost']
// what a turn can draw: the hard ones (sharp points, tight curves). Circle and
// triangle were a stroll; the demo still shows the triangle
export const DRAWN = ['star', 'umbrella', 'heart', 'bolt', 'octopus', 'bat', 'pumpkin', 'ghost']
export const NAMES = { circle: 'Circle', triangle: 'Triangle', star: 'Star', umbrella: 'Umbrella', heart: 'Heart', bolt: 'Lightning', octopus: 'Octopus', bat: 'Bat', pumpkin: 'Jack-o’-lantern', ghost: 'Ghost' }
export const GLYPH = { circle: '○', triangle: '△', star: '☆', umbrella: '☂', heart: '♡', bolt: 'ϟ', octopus: '🐙', bat: '🦇', pumpkin: '🎃', ghost: '👻' }

// this turn's candy, if the host makes it a dalgona (one stream per turn, so
// it doesn't shift when the lists change)
export function dalgonaAt(seedHex, turn) {
  return DRAWN[pcg32(parseSeed(seedHex), 1000 + turn).below(DRAWN.length)]
}

const arc = (cx, cy, r, from, to, n) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / n
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  })

// a quadratic curve from a to b, bowed toward c
const bow = (a, c, b, n = 10) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const u = 1 - t
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]
  })

// an oval, closed
const oval = (cx, cy, rx, ry, n = 28) =>
  Array.from({ length: n + 1 }, (_, i) => [cx + rx * Math.cos((i / n) * 2 * Math.PI), cy + ry * Math.sin((i / n) * 2 * Math.PI)])

const polygon = (cx, cy, r, sides, rIn = null) => {
  const pts = []
  const n = rIn ? sides * 2 : sides
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    const rr = rIn && i % 2 ? rIn : r
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)])
  }
  return pts
}

export function outline(shape) {
  switch (shape) {
    case 'circle':
      return [arc(0.5, 0.5, 0.25, 0, 2 * Math.PI, 72)]
    case 'triangle':
      return [polygon(0.5, 0.54, 0.29, 3)]
    case 'star':
      return [polygon(0.5, 0.52, 0.31, 5, 0.11)] // thin arms, deep notches
    case 'umbrella': {
      // the canopy over the top, its scalloped hem back along the bottom,
      // and the hooked handle hanging from the middle
      const top = arc(0.5, 0.47, 0.27, Math.PI, 2 * Math.PI, 40)
      const hem = []
      const w = 0.54 / 6 // six tight scallops: the show's hardest
      for (let k = 0; k < 6; k++) {
        const cx = 0.77 - w / 2 - k * w
        hem.push(...arc(cx, 0.47, w / 2, 0, -Math.PI, 10).slice(k ? 1 : 0))
      }
      const handle = [[0.5, 0.47], [0.5, 0.7], ...arc(0.45, 0.7, 0.05, 0, Math.PI, 12)]
      return [[...top, ...hem.slice(1)], handle]
    }
    case 'heart': {
      // two round lobes into a sharp dip, and a sharp point at the bottom
      const pts = Array.from({ length: 121 }, (_, i) => {
        const t = (i / 120) * 2 * Math.PI
        const x = 16 * Math.sin(t) ** 3
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
        return [0.5 + (x / 16) * 0.28, 0.5 - (y / 16) * 0.28]
      })
      return [pts]
    }
    case 'bolt':
      // a lightning bolt: five sharp corners, two of them needle-thin
      return [[[0.57, 0.2], [0.33, 0.55], [0.48, 0.55], [0.4, 0.82], [0.68, 0.45], [0.53, 0.45], [0.63, 0.2], [0.57, 0.2]]]
    case 'octopus': {
      // a round head with two eyes, and four wavy tentacles hanging from it, each one down
      // one side, round its curled tip and back up the other
      const head = arc(0.5, 0.45, 0.2, Math.PI, 2 * Math.PI, 36)
      const legs = []
      const centres = [0.645, 0.548, 0.452, 0.355]
      centres.forEach((cx, k) => {
        const len = k === 0 || k === 3 ? 0.27 : 0.3
        // all wave together (so they never cross), fanning out as they hang
        const at = (t) => [cx + 0.022 * Math.sin(t * Math.PI * 1.8 + k * 0.5) + (cx - 0.5) * 0.9 * t, 0.45 + len * t]
        const half = (t) => 0.036 * (1 - t) + 0.01
        const n = 18
        const right = Array.from({ length: n + 1 }, (_, i) => { const [x, y] = at(i / n); return [x + half(i / n), y] })
        const left = Array.from({ length: n + 1 }, (_, i) => { const [x, y] = at(1 - i / n); return [x - half(1 - i / n), y] })
        const [tx, ty] = at(1)
        const tip = arc(tx, ty, 0.01, 0, Math.PI, 6)
        legs.push(...right, ...tip, ...left)
      })
      // and its two eyes, cut out on their own
      return [[...head, ...legs, head[0]], oval(0.44, 0.37, 0.026, 0.036), oval(0.56, 0.37, 0.026, 0.036)]
    }
    case 'bat': {
      // pointed ears, then each wing out to a sharp tip and back in three
      // scallops to the body
      const L = [
        ...bow([0.5, 0.62], [0.42, 0.6], [0.38, 0.52], 8),
        ...bow([0.38, 0.52], [0.33, 0.6], [0.27, 0.5], 8).slice(1),
        ...bow([0.27, 0.5], [0.2, 0.55], [0.13, 0.42], 8).slice(1),
        ...bow([0.13, 0.42], [0.25, 0.3], [0.42, 0.38], 10).slice(1),
        [0.44, 0.27], [0.475, 0.36],
      ]
      const R = L.map(([x, y]) => [1 - x, y]).reverse()
      return [[...L, ...R, L[0]]]
    }
    case 'pumpkin': {
      // a ribbed pumpkin with its stem, and the face cut through: two eyes, a
      // nose and a jagged grin, each its own cut
      const body = Array.from({ length: 121 }, (_, i) => {
        const a = -Math.PI / 2 + (i / 120) * 2 * Math.PI
        const r = 0.25 * (1 - 0.07 * Math.abs(Math.sin(2.5 * (a + Math.PI / 2))))
        return [0.5 + r * 1.12 * Math.cos(a), 0.55 + r * 0.92 * Math.sin(a)]
      })
      const top = body.findIndex(([, y], i) => i > 0 && y > 0.36) // just past the stem's foot
      const shell = [[0.53, 0.33], ...body.slice(top, body.length - top), [0.47, 0.33], [0.46, 0.25], [0.52, 0.22], [0.54, 0.25], [0.53, 0.33]]
      const eye = (cx) => [[cx - 0.055, 0.52], [cx, 0.43], [cx + 0.055, 0.52], [cx - 0.055, 0.52]]
      const nose = [[0.475, 0.58], [0.5, 0.54], [0.525, 0.58], [0.475, 0.58]]
      const grin = [[0.35, 0.62], [0.4, 0.66], [0.43, 0.63], [0.46, 0.67], [0.5, 0.64], [0.54, 0.67], [0.57, 0.63], [0.6, 0.66], [0.65, 0.62],
        [0.6, 0.72], [0.55, 0.69], [0.5, 0.73], [0.45, 0.69], [0.4, 0.72], [0.35, 0.62]]
      return [shell, eye(0.41), eye(0.59), nose, grin]
    }
    case 'ghost': {
      // a round top, a wavy hem of four scallops, and two hollow eyes
      const top = arc(0.5, 0.42, 0.2, Math.PI, 2 * Math.PI, 36)
      const side = [[0.7, 0.42], [0.7, 0.72]]
      const hem = []
      for (let k = 0; k < 4; k++) hem.push(...arc(0.65 - k * 0.1, 0.72, 0.05, 0, Math.PI, 10).slice(k ? 1 : 0))
      return [[...top, ...side, ...hem, [0.3, 0.42]], oval(0.43, 0.46, 0.028, 0.045), oval(0.57, 0.46, 0.028, 0.045)]
    }
  }
  return []
}

// points every `step` along the outline: the line to carve, checked off as
// the needle passes
export function checkpoints(strokes, step = 0.008) {
  const out = []
  for (const s of strokes) {
    for (let i = 1; i < s.length; i++) {
      const [x0, y0] = s[i - 1]
      const [x1, y1] = s[i]
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step))
      for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n])
    }
  }
  return out
}

// The candy breaking: jagged pieces split from where it gave (x, y), each a
// polygon in candy space reaching past the rim, with which way it falls
export function shards([x, y], n = 7, rand = Math.random) {
  const angles = Array.from({ length: n }, (_, i) => ((i + 0.2 + rand() * 0.6) / n) * 2 * Math.PI).sort((a, b) => a - b)
  // a jagged split from the break out past the rim, along each angle
  const splits = angles.map((a) => Array.from({ length: 5 }, (_, k) => {
    const r = ((k + 1) / 5) * 0.75
    const j = k < 4 ? (rand() - 0.5) * 0.12 : 0
    return [x + r * Math.cos(a + j), y + r * Math.sin(a + j)]
  }))
  return angles.map((a, i) => {
    const b = angles[(i + 1) % n] + (i === n - 1 ? 2 * Math.PI : 0)
    const mid = (a + b) / 2
    const rim = Array.from({ length: 4 }, (_, k) => {
      const t = a + ((k + 1) / 5) * (b - a)
      return [x + 0.8 * Math.cos(t), y + 0.8 * Math.sin(t)]
    })
    const next = splits[(i + 1) % n]
    return {
      points: [[x, y], ...splits[i], ...rim, ...next.slice().reverse()],
      // what it turns about: roughly its middle
      at: [x + 0.22 * Math.cos(mid), y + 0.22 * Math.sin(mid)],
      // out from the break, then down; a turn as it goes
      dx: Math.cos(mid) * (0.1 + rand() * 0.12),
      dy: Math.sin(mid) * (0.1 + rand() * 0.12) + 0.35 + rand() * 0.2,
      turn: (rand() - 0.5) * 70,
    }
  })
}

// SVG path data for an outline (in a 1×1 box; scale it with the viewBox)
export const pathOf = (strokes) =>
  strokes.map((s) => 'M' + s.map(([x, y]) => `${x.toFixed(4)} ${y.toFixed(4)}`).join(' L')).join(' ')
