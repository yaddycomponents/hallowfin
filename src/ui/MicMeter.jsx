import { useEffect, useRef } from 'react'
import { Mic } from 'lucide-react'
import { ac } from '../audio/sound'

// The mic button with a live level meter: five bars that move with the room,
// so everyone can see the mic is picking them up. listening: the browser is
// taking answers right now (green, with a pulsing dot).
// The meter has its own stream (speech recognition doesn't expose a level);
// it's opened only while mic answers are on, and closed when they're turned off.
const BARS = [0.55, 0.85, 1, 0.8, 0.5]

export function MicMeter({ listening, onClick }) {
  const root = useRef()
  useEffect(() => {
    let stream
    let raf
    let live = true
    navigator.mediaDevices?.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then((s) => {
      if (!live) return s.getTracks().forEach((t) => t.stop())
      stream = s
      const c = ac()
      const src = c.createMediaStreamSource(s)
      const an = c.createAnalyser()
      an.fftSize = 512
      src.connect(an) // not on to the speakers: no feedback
      const buf = new Float32Array(an.fftSize)
      let level = 0
      const tick = () => {
        an.getFloatTimeDomainData(buf)
        let sum = 0
        for (const v of buf) sum += v * v
        // loudness on a rough log scale, quick up and slower down like a VU meter
        const db = 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-6)
        const target = Math.min(1, Math.max(0, (db + 58) / 40))
        level += (target - level) * (target > level ? 0.5 : 0.12)
        root.current?.style.setProperty('--lvl', level.toFixed(3))
        raf = requestAnimationFrame(tick)
      }
      tick()
    }, () => root.current?.classList.add('blocked'))
    return () => { live = false; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()) }
  }, [])

  return (
    <button
      ref={root}
      className={`mic-meter ${listening ? 'listening' : ''}`}
      onClick={onClick}
      aria-label="Mic answers on"
      data-tip={listening ? 'Listening for the answer · click to turn mic answers off' : 'Mic on · click to turn mic answers off'}
    >
      <Mic size={18} strokeWidth={2.2} />
      <span className="bars">{BARS.map((k, i) => <i key={i} style={{ '--k': k }} />)}</span>
    </button>
  )
}
