import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { seekSong, sfx, songAt } from '../audio/sound'
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
// The lobby song (Mingle, "round and round"), fitted to the whole file:
// 104.96 BPM, first beat 0.43 s in (stays within ~30 ms of the beat to the end;
// the 104.75 read off the opening drifted ~130 ms late by the last bars).
export const BEAT = 60 / 104.96
export const FIRST_BEAT = 0.43
const beatAt = (b) => FIRST_BEAT + b * BEAT
// "손뼉을" (clap your hands!): sung twice in the song, at 18.2 s and 54.2 s
// (the singing comes in at 9 s, after the sax). Every draw lands on one, like
// the game's number call: the first draw on the first, the rest on the second.
export const CLAPS = [31, 94]
// The floor's shuffle rides into it like a merry-go-round: it gets going on
// the beat, spins on the half-beats, then slows (on the beat, every other
// beat) into the stop; the last tick is the clap. Long enough to make people
// nervous.
const RIDE = [...Array(4).fill(1), ...Array(16).fill(0.5), ...Array(4).fill(1), ...Array(3).fill(2)] // 22 beats, ~12.6 s
const SPAN = RIDE.reduce((a, b) => a + b)
// later draws jump the song to this many beats before the ride, so it's
// playing (and faded up) before the floor moves
const LEAD_IN = 2

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
  const wait = useRef()
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
        // one player left: nothing to shuffle; a beat of quiet, then theirs
        if (n === 1) {
          clearTimeout(wait.current)
          wait.current = setTimeout(() => {
            sfx.land()
            dispatchEvent(new CustomEvent('reel-land', { detail: items[0].i }))
            onDone?.(items[0])
          }, 700)
          return
        }
        // which clap: a song still at its opening (the game's first draw) plays
        // on through the intro into the first clap; every later draw jumps to
        // just before the second, mid-song, so it never sounds like a restart
        let song = songAt('lobby')
        const fresh = !song || song.time <= beatAt(CLAPS[0] - SPAN - LEAD_IN)
        const clap = fresh ? CLAPS[0] : CLAPS[1]
        if (song && !fresh) {
          seekSong('lobby', beatAt(clap - SPAN - LEAD_IN))
          song = songAt('lobby')
        }
        // tick times in song seconds, read off the song itself (play() is async,
        // so right now it may not have started); no song: off the wall clock
        const from = song ? song.time : beatAt(clap - SPAN - LEAD_IN)
        const t0 = performance.now()
        const clock = () => {
          const at = songAt('lobby')
          if (at?.playing) return at.time
          // no song, or it never started (blocked): don't hang the draw
          const waited = (performance.now() - t0) / 1000
          return song && waited < 1.5 ? null : from + waited
        }
        // before the ride (the opening, on a first draw) the carousel winds up
        // a tick a beat, so the floor moves the moment it's pressed
        const lead = []
        for (let b = Math.ceil((from - FIRST_BEAT) / BEAT); b < clap - SPAN; b++) lead.push(beatAt(b))
        let at = clap - SPAN
        const ride = [beatAt(at), ...RIDE.map((b) => beatAt((at += b)))]
        const ticks = [...lead, ...ride]
        let next = 0
        const step = () => {
          const now = clock()
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

  useEffect(() => () => { cancelAnimationFrame(raf.current); clearTimeout(wait.current) }, [])

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
