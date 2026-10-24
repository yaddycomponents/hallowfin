import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { sfx } from '../audio/sound'
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
// once the music stops: the floor's last turns, slowing with the song as it
// winds down (ms after the stop)
const SETTLE = [220, 520, 920, 1450, 2100]
// the ride's turns: slow to get going, then quick (ms between)
const SLOW = 560
const FAST = 280

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
  const stopping = useRef(null)
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
        // musical chairs: the floor shuffles for as long as the song plays
        // (a few slow turns to get going, then quick ones); the host stops the
        // music (stop(), from the phone, M or Space) and it slows onto the
        // drawn player
        const t0 = performance.now()
        let ticks = 0
        let due = 0 // ms after the start the next turn is due
        const land = () => {
          sfx.land()
          dispatchEvent(new CustomEvent('reel-land', { detail: items[target].i }))
          onDone?.(items[target])
        }
        const tick = () => {
          dispatchEvent(new CustomEvent('reel-at', { detail: ticks++ }))
          sfx.shuffle()
          onTick?.()
        }
        stopping.current = null
        const step = () => {
          // stopped: a few slowing turns, then the landing
          if (stopping.current) {
            const since = performance.now() - stopping.current.at
            while (stopping.current.done < SETTLE.length && since >= SETTLE[stopping.current.done]) { stopping.current.done++; tick() }
            if (stopping.current.done < SETTLE.length) raf.current = requestAnimationFrame(step)
            else land()
            return
          }
          while (performance.now() - t0 >= due) { tick(); due += ticks < 4 ? SLOW : FAST }
          raf.current = requestAnimationFrame(step)
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
    // the music stops: the ride winds down and lands
    stop() {
      if (!stopping.current) stopping.current = { at: performance.now(), done: 0 }
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
