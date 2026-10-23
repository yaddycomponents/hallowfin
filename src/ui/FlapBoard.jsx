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

const ease = (x) => 1 - Math.pow(1 - x, 4)

// The name reel as a flap board: same spin as before (lands exactly on the
// drawn player, at least ~3 laps), but shows one name at a time, flipping.
export const FlapReel = forwardRef(function FlapReel({ items, onDone, onTick, ms = 4200 }, ref) {
  const [shown, setShown] = useState(null)
  const [dur, setDur] = useState(200)
  const pos = useRef(0)
  const raf = useRef()
  const n = items.length
  // cells: wide enough for the longest name, within reason
  const width = Math.min(20, Math.max(10, ...items.map((p) => p.name.length)))

  useImperativeHandle(ref, () => ({
    spin(target) {
      if (!n) return
      cancelAnimationFrame(raf.current)
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
          setShown(items[((last % n) + n) % n])
          sfx.flap()
          onTick?.()
        }
        pos.current = p
        if (k < 1) raf.current = requestAnimationFrame(step)
        else { sfx.land(); onDone?.(items[target]) }
      }
      raf.current = requestAnimationFrame(step)
    },
  }), [items, n, ms, onDone, onTick])

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  return (
    <div className="board">
      <div className="board-label"><span>Player</span><span>Name</span></div>
      <div className="board-row">
        <FlapText className="no" text={shown ? playerNo(shown.name) : '???'} dur={dur} />
        <FlapText text={shown ? shown.name : 'Who is next?'} width={width} dur={dur} />
      </div>
    </div>
  )
})
