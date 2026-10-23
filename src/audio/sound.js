// Sound effects are synthesised (Web Audio), so the game works with no files.
// Music is optional: drop MP3s into public/audio/ and they play; if a file is
// missing it is skipped silently.
//   public/audio/lobby.mp3     — loops in the lobby and while picking (e.g. "Way Back Then")
//   public/audio/redlight.mp3  — plays while the question timer runs (the doll's song)

let ctx = null
const ac = () => (ctx ??= new (window.AudioContext || window.webkitAudioContext)())

function tone({ f = 440, f2, type = 'sine', dur = 0.15, vol = 0.3, at = 0 }) {
  const c = ac()
  const t = c.currentTime + at
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(f, t)
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur)
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(c.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function noise({ dur = 0.3, vol = 0.4, at = 0, lp = 1200 }) {
  const c = ac()
  const t = c.currentTime + at
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2
  const s = c.createBufferSource()
  const f = c.createBiquadFilter()
  const g = c.createGain()
  s.buffer = b
  f.type = 'lowpass'
  f.frequency.value = lp
  g.gain.value = vol
  s.connect(f).connect(g).connect(ac().destination)
  s.start(t)
}

export const sfx = {
  // one split-flap tile dropping: a short, bright clack
  flap: () => { noise({ dur: 0.035, vol: 0.35, lp: 5200 }); tone({ f: 2400, type: 'square', dur: 0.012, vol: 0.03 }) },
  tick: () => tone({ f: 1800, type: 'square', dur: 0.025, vol: 0.06 }),
  land: () => { tone({ f: 110, f2: 55, type: 'triangle', dur: 0.9, vol: 0.5 }); tone({ f: 660, dur: 0.6, vol: 0.12 }) },
  heart: () => { tone({ f: 70, f2: 40, dur: 0.14, vol: 0.7 }); tone({ f: 60, f2: 35, dur: 0.16, vol: 0.5, at: 0.18 }) },
  turn: () => noise({ dur: 0.45, vol: 0.25, lp: 3000 }),
  // the elimination: a sharp crack and a low boom
  eliminated: () => { noise({ dur: 0.25, vol: 0.9, lp: 6000 }); tone({ f: 90, f2: 30, type: 'sawtooth', dur: 1.2, vol: 0.35, at: 0.05 }) },
  survived: () => [523, 659, 784, 1047].forEach((f, i) => tone({ f, type: 'triangle', dur: 0.4, vol: 0.18, at: i * 0.09 })),
  unlock: () => ac().resume(),
}

const tracks = {}
function track(name) {
  if (!tracks[name]) {
    const a = new Audio(`/audio/${name}.mp3`)
    a.loop = true
    a.preload = 'auto'
    a.volume = 0
    a.onerror = () => { a.dataset.missing = '1' }
    tracks[name] = a
  }
  return tracks[name]
}
// fetch both at page load, so the first play is instant
if (typeof window !== 'undefined') ['lobby', 'redlight'].forEach((n) => track(n).load())

const fades = {}
function fade(a, to, ms, then) {
  clearInterval(fades[a.src])
  const from = a.volume
  const t0 = performance.now()
  fades[a.src] = setInterval(() => {
    const p = Math.min(1, (performance.now() - t0) / ms)
    a.volume = from + (to - from) * p
    if (p === 1) { clearInterval(fades[a.src]); then?.() }
  }, 30)
}

// Must first be called from a click or key press: browsers block audio before a gesture.
export function music(name, vol = 0.6, { restart = false } = {}) {
  const a = track(name)
  if (a.dataset.missing) return
  if (restart) a.currentTime = 0
  a.play().then(() => fade(a, vol, 800), () => {})
}

export function stopMusic(name, ms = 600) {
  const a = tracks[name]
  if (a && !a.paused) fade(a, 0, ms, () => a.pause())
}
