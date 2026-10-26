// A burst of ○ △ □ confetti in the guards' colours, for a player who survives.
// One canvas, two cannons from the bottom corners, gone after a few seconds.
import { useEffect, useRef } from 'react'

const COLORS = ['#ed1b76', '#0aa39d', '#f6f2ea', '#22d37a', '#c9a66b']
const COUNT = 160
const LIFE = 4200 // ms

export function Confetti() {
  const ref = useRef(null)

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(devicePixelRatio || 1, 2)
    const w = (canvas.width = innerWidth * dpr)
    const h = (canvas.height = innerHeight * dpr)

    const bits = Array.from({ length: COUNT }, (_, i) => {
      const left = i % 2 === 0
      const angle = (left ? -60 : -120) + (Math.random() - 0.5) * 40 // degrees, up and inward
      const speed = (14 + Math.random() * 12) * dpr
      return {
        x: left ? 0 : w,
        y: h,
        vx: Math.cos((angle * Math.PI) / 180) * speed,
        vy: Math.sin((angle * Math.PI) / 180) * speed,
        size: (8 + Math.random() * 8) * dpr,
        spin: (Math.random() - 0.5) * 0.3,
        turn: Math.random() * Math.PI,
        color: COLORS[i % COLORS.length],
        kind: i % 3, // ○ △ □
        delay: Math.random() * 250,
      }
    })

    const start = performance.now()
    let frame
    const draw = (now) => {
      const t = now - start
      ctx.clearRect(0, 0, w, h)
      ctx.globalAlpha = Math.min(1, (LIFE - t) / 800) // fade out at the end
      for (const b of bits) {
        if (t < b.delay) continue
        b.vy += 0.35 * dpr // gravity
        b.vx *= 0.985 // air
        b.vy *= 0.985
        b.x += b.vx
        b.y += b.vy
        b.turn += b.spin
        ctx.save()
        ctx.translate(b.x, b.y)
        ctx.rotate(b.turn)
        ctx.scale(1, Math.abs(Math.cos(b.turn * 1.7)) * 0.7 + 0.3) // tumbling flutter
        ctx.strokeStyle = ctx.fillStyle = b.color
        ctx.lineWidth = b.size / 4
        const s = b.size / 2
        ctx.beginPath()
        if (b.kind === 0) { ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2); ctx.stroke() }
        else if (b.kind === 1) { ctx.moveTo(0, -s); ctx.lineTo(s, s * 0.8); ctx.lineTo(-s, s * 0.8); ctx.closePath(); ctx.fill() }
        else { ctx.rect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6); ctx.stroke() }
        ctx.restore()
      }
      if (t < LIFE) frame = requestAnimationFrame(draw)
      else ctx.clearRect(0, 0, w, h)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])

  return <canvas ref={ref} className="confetti" aria-hidden="true" />
}
