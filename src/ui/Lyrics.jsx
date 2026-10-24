import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { songAt } from '../audio/sound'

// The whole song, sung along on screen while the floor shuffles: one line a
// bar or so, each [beat it's sung on, Korean, romanised, English]. Read off
// the song's own clock, so wherever the host stops it, the words were right.
// 104.96 BPM, first beat 0.43 s in; the singing comes in at 9 s (beat 15).
const BEAT = 60 / 104.96
const FIRST_BEAT = 0.43
const ROUND = [
  ['둥글게 둥글게', 'dunggeulge dunggeulge', 'Round and round, round and round'],
  ['둥글게 둥글게', 'dunggeulge dunggeulge', 'Round and round, round and round'],
  ['빙글빙글 돌아가며', 'binggeulbinggeul dolagamyeo', 'Turning, turning in a circle'],
  ['춤을 춥시다', 'chumeul chupsida', 'as we dance along'],
]
const CLAP = [
  ['손뼉을 치면서', 'sonppyeogeul chimyeonseo', 'Clap your hands!', 'clap'],
  ['노래를 부르며', 'noraereul bureumyeo', 'and sing along'],
  ['랄라랄라', 'lallallalla', 'La la la la'],
  ['즐겁게 춤추자', 'jeulgeopge chumchuja', 'let’s dance and have fun'],
]
const RINGA = [
  ['링가링가링가', 'ringgaringgaringga', 'Ringa linga linga'],
  ['링가링가링', 'ringgaringgaring', 'ringa linga ling'],
]
const SONG = [
  ...ROUND.map((l, i) => [15 + i * 4, ...l]),
  ...CLAP.map((l, i) => [31 + i * 4, ...l]),
  ...[...RINGA, ...RINGA].map((l, i) => [47 + i * 5, ...l]),
  [67, '모두 손을 잡고', 'modu soneul japgo', 'Everyone, hold hands'],
  [70.5, '모두 다 같이', 'modu da gachi', 'all together now'],
  [74, '즐겁게 뛰어봅시다', 'jeulgeopge ttwieobopsida', 'let’s jump for joy!'],
  ...ROUND.map((l, i) => [78 + i * 4, ...l]),
  ...CLAP.map((l, i) => [94 + i * 4, ...l]),
]
const END = 110 // the last line's end (the song loops back to beat 15)
const PREVIEW = 4 // beats the first line is shown before it's sung

// which line is up and how far through it (null: no singing right now)
function place(time) {
  const b = (time - FIRST_BEAT) / BEAT
  if (b < SONG[0][0] - PREVIEW || b >= END) return null
  let k = 0
  while (k < SONG.length - 1 && b >= SONG[k + 1][0]) k++
  const to = SONG[k + 1]?.[0] ?? END
  const p = SONG[k][4] === 'clap' ? 1 : Math.max(0, Math.min(1, (b - SONG[k][0]) / (to - SONG[k][0])))
  // up between beats, landing on each one: a carousel horse on its pole
  const hop = Math.sin((b - Math.floor(b)) * Math.PI)
  return { k, p, hop }
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
  const now = SONG[k]
  // to <body>: the pick panel is transformed, which would pin a fixed child
  // to the panel instead of the screen
  return createPortal(
    <div className="lyrics" aria-hidden>
      {now && (
        <div key={k} className={`lyric ${now[4] === 'clap' ? 'clap' : ''}`} ref={line}>
          <span className="ko">
            <span className="note">♪</span>
            <span className="fill" data-text={now[1]}>
              {now[1]}
              <Horse />
            </span>
            <span className="note">♪</span>
          </span>
          <span className="ro"><span className="fill" data-text={now[2]}>{now[2]}</span></span>
          <span className="en">{now[3]}</span>
        </div>
      )}
    </div>,
    document.body,
  )
}
