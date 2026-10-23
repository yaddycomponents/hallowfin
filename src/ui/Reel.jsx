import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { sfx } from '../audio/sound'

const ROW = 84 // px per row
const ease = (x) => 1 - Math.pow(1 - x, 4)

// A slot reel over `items`. Only the rows in view are drawn: `pos` is a float
// (in rows) and each row sits at (k - pos) * ROW. spin(index) scrolls at least
// ~3 laps and lands exactly on items[index], ticking once per row passed.
export const Reel = forwardRef(function Reel({ items, render, onDone, ms = 3600 }, ref) {
  const [pos, setPos] = useState(0)
  const posRef = useRef(0)
  const raf = useRef()
  const n = items.length

  useImperativeHandle(ref, () => ({
    spin(target) {
      if (!n) return
      cancelAnimationFrame(raf.current)
      const from = posRef.current
      const base = Math.ceil(from)
      const laps = Math.max(3, Math.ceil(36 / n))
      const to = base + laps * n + (((target - base) % n) + n) % n
      const t0 = performance.now()
      let last = Math.floor(from)
      const step = (now) => {
        const k = Math.min(1, (now - t0) / ms)
        const p = from + (to - from) * ease(k)
        if (Math.floor(p) !== last) { last = Math.floor(p); sfx.tick() }
        posRef.current = p
        setPos(p)
        if (k < 1) raf.current = requestAnimationFrame(step)
        else { sfx.land(); onDone?.(items[target]) }
      }
      raf.current = requestAnimationFrame(step)
    },
  }), [items, n, ms, onDone])

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const rows = []
  if (n) for (let k = Math.floor(pos) - 2; k <= Math.floor(pos) + 3; k++) {
    const d = k - pos
    const item = items[((k % n) + n) % n]
    rows.push(
      <div key={k} className="reel-row" style={{ transform: `translateY(${d * ROW}px) rotateX(${-d * 22}deg)`, opacity: Math.max(0, 1 - Math.abs(d) * 0.38) }}>
        {render(item)}
      </div>,
    )
  }
  return (
    <div className="reel">
      <div className="reel-window">{rows}</div>
      <div className="reel-frame" />
    </div>
  )
})
