import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { sfx, songAt } from '../audio/sound'
import { playerNo } from '../game/data'

// A split-flap board, like the dorm's player counter. Each tile keeps the
// character it is leaving and the one it is turning to: the top half of the
// old character folds down over the new one's bottom half. `dur` is how long
// a flip takes, so tiles flip faster when the board is spinning faster.
function Flap({ ch, dur }) {
  const [s, setS] = useState({ from: ch, to: ch, n: 0 })
  if (ch !== s.to) setS({ from: s.to, to: ch, n: s.n + 1 })
  return (
    <span className="flap" style={{ '--fd': `${dur}ms` }}>
      <span className="half top"><b>{s.to}</b></span>
      <span className="half bot"><b>{s.from}</b></span>
      {s.n > 0 && (
        <>
          <span key={`t${s.n}`} className="half top fold-top"><b>{s.from}</b></span>
          <span key={`b${s.n}`} className="half bot fold-bot"><b>{s.to}</b></span>
        </>
      )}
    </span>
  )
}

export function FlapText({ text, width = text.length, dur = 180, className = '' }) {
  const cells = text.toUpperCase().padEnd(width, ' ').slice(0, width).split('')
  return (
    <span className={`flaps ${className}`}>
      {cells.map((c, i) => <Flap key={i} ch={c} dur={dur} />)}
    </span>
  )
}

// a gentler slow-down than quartic: with ~30 names to pass, quartic left the
// second-to-last name up for ~1.8 s, which looked like the landing. Quadratic
// still slows into the stop, but the last few names keep moving.
const ease = (x) => 1 - Math.pow(1 - x, 2)
// The lobby song (Mingle, "round and round"), measured from the file: 104.75 BPM,
// first beat 0.435 s in. The floor's shuffle rides it like a merry-go-round:
// quick on the half-beats, then on the beat, then every other beat into the stop.
const BEAT = 60 / 104.75
const FIRST_BEAT = 0.435
// the song's quiet opening ends here (bar 3, beat 1): a first spin winds up
// slowly through it and the ride proper rolls in with the theme
const THEME_IN = FIRST_BEAT + 8 * BEAT
const RIDE = [...Array(10).fill(0.5), ...Array(4).fill(1), ...Array(3).fill(2)] // in beats; ~7.7 s

// The name reel as a flap board: same spin as before (lands exactly on the
// drawn player, at least ~3 laps), but shows one name at a time, flipping.
// bare: keep the spin (timing, ticks, the reel events the player floor follows)
// but draw nothing; the floor is the visible reel now
export const FlapReel = forwardRef(function FlapReel({ items, onDone, onTick, ms = 4200, bare = false }, ref) {
  const [shown, setShown] = useState(null)
  const [dur, setDur] = useState(200)
  const [landed, setLanded] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const pos = useRef(0)
  const raf = useRef()
  const n = items.length
  // cells: wide enough for the longest name, within reason
  const width = Math.min(20, Math.max(10, ...items.map((p) => p.name.length)))

  useImperativeHandle(ref, () => ({
    spin(target) {
      if (!n) return
      cancelAnimationFrame(raf.current)
      // bare: nothing to read, so no need to pass every name (with 81 that was
      // ~60 clacks a second). The ride: ticks on the song's own beat grid.
      if (bare) {
        // tick times in song seconds, read off the song itself (play() is async,
        // so right now it may not have started); no song: off the wall clock
        const song = songAt('lobby')
        const from = song ? song.time : 0
        const t0 = performance.now()
        const clock = () => {
          const at = songAt('lobby')
          if (at?.playing) return at.time
          // no song, or it never started (blocked): don't hang the draw
          const waited = (performance.now() - t0) / 1000
          return song && waited < 1.5 ? null : from + waited
        }
        // the next half-beat on the song's grid, and never before the theme is in
        const half = BEAT / 2
        let t = song ? Math.max(THEME_IN, FIRST_BEAT + Math.ceil((from - FIRST_BEAT) / half) * half) : 0
        // while the opening plays, the carousel winds up: a tick on every beat
        // from the next one, so the floor moves the moment it's pressed
        const lead = []
        for (let b = FIRST_BEAT + Math.ceil((from - FIRST_BEAT) / BEAT) * BEAT; b < t - 0.01; b += BEAT) lead.push(b)
        const ticks = [...lead, ...RIDE.map((b) => { const now = t; t += b * BEAT; return now })]
        // the song loops: count the laps so a wrap mid-ride doesn't jump back
        let lap = 0, prev = from
        let next = 0
        const step = () => {
          let now = clock()
          if (now != null) {
            if (now < prev - 1) lap += song.duration
            prev = now
            now += lap
          }
          while (now != null && next < ticks.length && now >= ticks[next]) {
            dispatchEvent(new CustomEvent('reel-at', { detail: next }))
            next++
            sfx.shuffle()
            onTick?.()
          }
          if (next < ticks.length) raf.current = requestAnimationFrame(step)
          else {
            sfx.land()
            dispatchEvent(new CustomEvent('reel-land', { detail: items[target].i }))
            onDone?.(items[target])
          }
        }
        raf.current = requestAnimationFrame(step)
        return
      }
      setLanded(false)
      setSpinning(true)
      const from = pos.current
      const base = Math.ceil(from)
      const laps = Math.max(3, Math.ceil(30 / n))
      const to = base + laps * n + (((target - base) % n) + n) % n
      const t0 = performance.now()
      let last = Math.floor(from)
      let lastT = t0
      const step = (now) => {
        const k = Math.min(1, (now - t0) / ms)
        const p = from + (to - from) * ease(k)
        if (Math.floor(p) !== last) {
          last = Math.floor(p)
          setDur(Math.max(50, Math.min(260, (now - lastT) * 0.9)))
          lastT = now
          const it = items[((last % n) + n) % n]
          setShown(it)
          // the player wall lights the same tile (by roster index)
          dispatchEvent(new CustomEvent('reel-at', { detail: it.i }))
          sfx.flap()
          onTick?.()
        }
        pos.current = p
        if (k < 1) raf.current = requestAnimationFrame(step)
        else {
          sfx.land(); setSpinning(false); setLanded(true)
          dispatchEvent(new CustomEvent('reel-land', { detail: items[target].i }))
          onDone?.(items[target])
        }
      }
      raf.current = requestAnimationFrame(step)
    },
  }), [items, n, ms, onDone, onTick, bare])

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  if (bare) return null
  return (
    <div className={`board ${spinning ? 'spinning' : ''} ${landed ? 'landed' : ''}`}>
      <div className="board-label"><span>Player</span><span>Name</span></div>
      <div className="board-row">
        <FlapText className="no" text={shown ? playerNo(shown.name) : '???'} dur={dur} />
        <FlapText text={shown ? shown.name : 'Who is next?'} width={width} dur={dur} />
      </div>
    </div>
  )
})
