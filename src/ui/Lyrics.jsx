import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { songAt } from '../audio/sound'
import { BEAT, CLAPS, FIRST_BEAT } from './FlapBoard'

// The verse the draw rides, sung along on screen into "손뼉을!" (clap your
// hands), where the number lands: one line a bar, each line's start in beats
// before the clap. Timed off the song's own clock, the same one the shuffle
// follows, so words and floor agree.
const VERSE = [
  [-16, '둥글게 둥글게', 'dung-geul-ge dung-geul-ge', 'round and round'],
  [-12, '둥글게 둥글게', 'dung-geul-ge dung-geul-ge', 'round and round'],
  [-8, '빙글빙글 돌아가며', 'bing-geul bing-geul do-ra-ga-myeo', 'spinning, spinning round'],
  [-4, '춤을 춥시다', 'chu-meul chup-si-da', "let's dance"],
  [0, '손뼉을!', 'son-ppyeo-geul', 'clap your hands!'],
]
const LAST = VERSE.length - 1
const PREVIEW = 4 // beats the first line is shown dimmed before it's sung
const HOLD = 4 // beats the clap stays up

// which line is up (-1: the verse is coming) and how far through it
function place(time) {
  const b = (time - FIRST_BEAT) / BEAT
  for (const c of CLAPS) {
    const r = b - c // beats relative to the clap
    if (r < VERSE[0][0] - PREVIEW || r >= HOLD) continue
    let k = -1
    while (k < LAST && r >= VERSE[k + 1][0]) k++
    const p = k < 0 ? 0 : k === LAST ? 0.5 : (r - VERSE[k][0]) / (VERSE[k + 1][0] - VERSE[k][0])
    // up between beats, landing on each one: a carousel horse on its pole
    const hop = Math.sin((b - Math.floor(b)) * Math.PI)
    return { k, p, hop }
  }
  return null
}

// the rider: public/images/horse.png if there is one (facing right, clear
// background), else the carousel-horse emoji
const HORSE = '/images/horse.png'
let png = null
const probe = new Promise((ok) => {
  if (typeof Image === 'undefined') return ok(false)
  const i = new Image()
  i.onload = () => ok(true)
  i.onerror = () => ok(false)
  i.src = HORSE
}).then((has) => (png = has))

function Horse() {
  const [has, setHas] = useState(png)
  useEffect(() => { if (has == null) probe.then(setHas) }, [has])
  return (
    <span className="rider">
      {SPARKS.map(([x, y, size, delay, kind], i) => (
        <i key={i} className={`spark ${kind}`} style={{ '--x': x, '--y': y, '--s': size, '--d': `${delay}s` }} />
      ))}
      {has ? <img className="horse" src={HORSE} alt="" /> : <span className="horse emoji">🎠</span>}
    </span>
  )
}

// magic around the rider: [x, y] in em from its middle, size, delay, and kind
// (twinkle in place, or trail: dust it leaves behind as it rides on)
const SPARKS = [
  [-0.7, -0.5, 0.32, 0, 'twinkle gold'],
  [0.75, -0.65, 0.24, 0.35, 'twinkle white'],
  [0.65, 0.1, 0.18, 0.8, 'twinkle pink'],
  [-0.45, 0.25, 0.2, 0.55, 'twinkle white'],
  [0.05, -0.85, 0.22, 1.1, 'twinkle gold'],
  [-0.65, -0.05, 0.22, 0, 'trail gold'],
  [-0.6, 0.3, 0.16, 0.3, 'trail white'],
  [-0.7, -0.35, 0.18, 0.6, 'trail pink'],
  [-0.55, 0.1, 0.14, 0.9, 'trail gold'],
]

export function Lyrics() {
  const [k, setK] = useState(null)
  const line = useRef()
  useEffect(() => {
    let raf
    const tick = () => {
      const s = songAt('lobby')
      const at = s?.playing ? place(s.time) : null
      setK(at ? at.k : null) // same value: React skips the render
      // the horse rides along the line, frame by frame, without re-rendering
      line.current?.style.setProperty('--p', at ? at.p : 0)
      line.current?.style.setProperty('--hop', at ? at.hop : 0)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  if (k == null) return null
  const now = VERSE[k]
  const next = VERSE[k + 1]
  // to <body>: the pick panel is transformed, which would pin a fixed child
  // to the panel instead of the screen
  return createPortal(
    <div className="lyrics" aria-hidden>
      {now && (
        <div key={k} className={`lyric ${k === VERSE.length - 1 ? 'clap' : ''}`} ref={line}>
          <b>
            {now[1]}
            <Horse />
          </b>
          <small>{now[2]} · <i>{now[3]}</i></small>
        </div>
      )}
      {next && <div className="lyric-next">{next[1]}</div>}
    </div>,
    document.body,
  )
}
