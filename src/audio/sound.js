// Sound effects are synthesised (Web Audio), so the game works with no files.
// Music is optional: drop MP3s into public/audio/ and they play; if a file is
// missing it is skipped silently.
//   public/audio/lobby.mp3     — loops in the lobby and while picking (e.g. "Way Back Then")
//   public/audio/redlight.mp3  — plays while the question timer runs (the doll's song)
//   public/audio/dare.mp3      — loops under a dare (e.g. "Pink Soldiers")
//   public/audio/dalgona.mp3   — loops while a player carves dalgona
//   public/audio/called.mp3    — under a player's call, till their turn starts (e.g. "Round VI")

let ctx = null
export const ac = () => (ctx ??= new (window.AudioContext || window.webkitAudioContext)())

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
  // the floor shuffling: a soft, low turn of cloth tiles
  shuffle: () => { noise({ dur: 0.06, vol: 0.16, lp: 1400 }); tone({ f: 300, f2: 210, type: 'triangle', dur: 0.07, vol: 0.07 }) },
  tick: () => tone({ f: 1800, type: 'square', dur: 0.025, vol: 0.06 }),
  land: () => { tone({ f: 110, f2: 55, type: 'triangle', dur: 0.9, vol: 0.5 }); tone({ f: 660, dur: 0.6, vol: 0.12 }) },
  heart: () => { tone({ f: 70, f2: 40, dur: 0.14, vol: 0.7 }); tone({ f: 60, f2: 35, dur: 0.16, vol: 0.5, at: 0.18 }) },
  turn: () => noise({ dur: 0.45, vol: 0.25, lp: 3000 }),
  // the elimination: a low, falling drone (the guard's shot follows)
  eliminated: () => tone({ f: 90, f2: 30, type: 'sawtooth', dur: 1.2, vol: 0.3 }),
  // the rifle: a bright crack, a thump, and the field echoing it back
  gunshot: () => {
    noise({ dur: 0.16, vol: 1, lp: 9000 })
    tone({ f: 140, f2: 40, dur: 0.35, vol: 0.7 })
    noise({ dur: 1.1, vol: 0.35, lp: 600, at: 0.03 })
    noise({ dur: 0.5, vol: 0.12, lp: 2500, at: 0.28 })
  },
  survived: () => [523, 659, 784, 1047].forEach((f, i) => tone({ f, type: 'triangle', dur: 0.4, vol: 0.18, at: i * 0.09 })),
  // the candy gives: a dry snap
  crack: () => { tone({ f: 2400, f2: 180, type: 'square', dur: 0.07, vol: 0.12 }); tone({ f: 900, f2: 120, type: 'sawtooth', dur: 0.12, vol: 0.08, at: 0.03 }) },
  // the whole candy giving way: a crunch, then the pieces hitting the tray
  shatter: () => {
    noise({ dur: 0.35, vol: 0.8, lp: 6000 })
    tone({ f: 1900, f2: 140, type: 'square', dur: 0.12, vol: 0.14 })
    ;[0.18, 0.27, 0.33, 0.42].forEach((at, i) => noise({ dur: 0.05, vol: 0.3 - i * 0.05, lp: 4000, at }))
  },
  unlock: () => ac().resume(),
}

// where a song picks up when it comes round again: the lobby song's sax
// intro is for the start only, so it loops back to where the singing comes in
const LOOP_FROM = { lobby: 9.0 }

const tracks = {}
function track(name) {
  if (!tracks[name]) {
    const a = new Audio(`/audio/${name}.mp3`)
    const from = LOOP_FROM[name]
    a.loop = from == null
    if (from != null) a.addEventListener('ended', () => { a.currentTime = from; a.play().catch(() => {}) })
    a.preload = 'auto'
    a.volume = 0
    a.onerror = () => { a.dataset.missing = '1' }
    tracks[name] = a
  }
  return tracks[name]
}
// fetch both at page load, so the first play is instant
if (typeof window !== 'undefined') ['lobby', 'redlight', 'called'].forEach((n) => track(n).load())

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

// where a playing song is, in seconds (null when it isn't playing)
export function songTime(name) {
  const a = tracks[name]
  return a && !a.paused ? a.currentTime : null
}

// where a song is or will resume from, playing or not (null when the file is
// missing): the lyrics follow it
export function songAt(name) {
  const a = tracks[name]
  return a && !a.dataset.missing ? { time: a.currentTime, playing: !a.paused } : null
}

// the host's "stop the music": whatever is playing fades out
export function stopAllMusic(ms = 700) {
  for (const name of Object.keys(tracks)) if (name !== 'redlight') stopMusic(name, ms)
}

// move a song to a point (playing or not), e.g. a few bars before a cue
export function seekSong(name, t) {
  const a = tracks[name]
  if (a && !a.dataset.missing) a.currentTime = t
}

// the show's stop: the song winds down like a record losing power (pitch and
// speed sag together) as it fades, then rests, ready to pick up from there
export function windDown(name, ms = 1500) {
  const a = tracks[name]
  if (!a || a.paused) return
  clearInterval(fades[a.src])
  a.preservesPitch = false
  const from = a.volume
  const t0 = performance.now()
  fades[a.src] = setInterval(() => {
    const p = Math.min(1, (performance.now() - t0) / ms)
    a.playbackRate = Math.max(0.3, 1 - 0.7 * p * p)
    a.volume = from * (1 - p) ** 1.6
    if (p === 1) { clearInterval(fades[a.src]); a.pause(); a.playbackRate = 1 }
  }, 30)
}

export function stopMusic(name, ms = 600) {
  const a = tracks[name]
  if (a && !a.paused) fade(a, 0, ms, () => a.pause())
}

// One run of a song at a given speed, not looped: the doll's chant before she
// turns. Pitch follows speed, like the show's sped-up and dragged-out takes.
// until: where in the file (seconds) to stop: the last syllable, or earlier to
// cut the chant short. Resolves the moment playback reaches it, read off the
// audio clock itself, so her turn lands on the sound and not on 'ended' (which
// fires late, after the file's tail of silence).
export function sing(name, rate = 1, vol = 0.6, until = Infinity) {
  const a = track(name)
  let stopped = false
  let raf
  const done = new Promise((resolve) => {
    const guess = () => setTimeout(resolve, (Math.min(until, 4.6) * 1000) / rate)
    if (a.dataset.missing) return guess()
    clearInterval(fades[a.src])
    a.loop = false
    a.currentTime = 0
    a.playbackRate = rate
    a.preservesPitch = false
    a.volume = vol
    a.onended = () => resolve()
    const watch = () => {
      if (stopped) return
      if (a.currentTime >= until) { a.pause(); a.onended = null; return resolve() }
      raf = requestAnimationFrame(watch)
    }
    a.play().then(watch, guess)
  })
  return { done, stop: () => { if (!stopped) { stopped = true; cancelAnimationFrame(raf); a.onended = null; a.pause() } } }
}
