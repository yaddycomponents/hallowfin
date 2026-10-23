import { useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { DEFAULTS, TEMPLATE, lines, parseMd } from '../game/data'
import { newSeed } from '../game/pcg'
import { sfx } from '../audio/sound'

gsap.registerPlugin(useGSAP)

// The lobby is the recruiter's business card: kraft card, ○△□ pressed into
// the front, a number on the back. Here the number is the game's PCG seed
// ("same number, same game"). Flip it, and answer the only question.
const NO_LINES = ['No', 'Are you sure?', 'Your debt says otherwise', 'There is no "no"']

const Shapes = ({ className }) => (
  <svg className={className} viewBox="0 0 330 100" aria-hidden>
    <circle cx="50" cy="50" r="38" />
    <path d="M165 13 L208 87 L122 87 Z" />
    <rect x="242" y="12" width="76" height="76" />
  </svg>
)

const asPhone = (s) => s.toUpperCase().match(/.{1,4}/g)?.join(' ') ?? ''

export function Lobby({ config, setConfig, onStart, canResume, onResume }) {
  const [seed, setSeed] = useState(newSeed)
  const [editingSeed, setEditingSeed] = useState(false)
  const [face, setFace] = useState('front')
  const [files, setFiles] = useState(false)
  const [no, setNo] = useState(0)
  const [drag, setDrag] = useState(false)
  const root = useRef()
  const card = useRef()
  const inner = useRef()

  const { contextSafe } = useGSAP(() => {
    // tossed onto the table: drops in spinning, lands with a slap
    gsap.timeline()
      .from(card.current, { y: -innerHeight * 0.9, rotation: -32, rotationX: 50, scale: 1.4, duration: 1.05, ease: 'power4.out' })
      .from('.biz-shadow', { opacity: 0, scale: 0.4, duration: 0.9, ease: 'power3.out' }, 0)
      .from('.lobby-hint', { opacity: 0, y: 12, duration: 0.5 }, 0.9)

    // it leans toward the pointer
    const rx = gsap.quickTo(card.current, 'rotationX', { duration: 0.7, ease: 'power3' })
    const ry = gsap.quickTo(card.current, 'rotationY', { duration: 0.7, ease: 'power3' })
    const move = (e) => { rx((e.clientY / innerHeight - 0.5) * -12); ry((e.clientX / innerWidth - 0.5) * 16) }
    addEventListener('pointermove', move)
    return () => removeEventListener('pointermove', move)
  }, { scope: root })

  const flip = contextSafe(() => {
    if (files) return
    const toBack = face === 'front'
    sfx.unlock()
    sfx.turn()
    setFace(toBack ? 'back' : 'front')
    gsap.to(inner.current, { rotationY: toBack ? 180 : 0, duration: 0.9, ease: 'back.inOut(1.3)' })
  })

  const yes = contextSafe((e) => {
    e.stopPropagation()
    sfx.unlock()
    sfx.land()
    gsap.to(card.current, { scale: 2.6, y: -30, opacity: 0, rotationX: -25, duration: 0.65, ease: 'power3.in', onComplete: () => onStart(seed) })
    gsap.to('.biz-shadow, .lobby-hint, .lobby-files-btn', { opacity: 0, duration: 0.3 })
  })

  const refuse = contextSafe((e) => {
    e.stopPropagation()
    setNo((n) => Math.min(n + 1, NO_LINES.length - 1))
    gsap.fromTo(card.current, { x: -14 }, { x: 0, duration: 0.5, ease: 'elastic.out(1.2, 0.25)' })
  })

  const readFile = async (f) => {
    if (!f) return
    const md = parseMd(await f.text())
    // only replace the sections the file actually has
    setConfig((c) => ({
      ...c,
      players: md.players.length ? md.players : c.players,
      questions: md.questions.length ? md.questions : c.questions,
      dares: md.dares.length ? md.dares : c.dares,
    }))
    setFiles(true)
  }

  const ready = config.players.length > 0 && config.questions.length > 0 && config.dares.length > 0
  const stop = (e) => e.stopPropagation()

  return (
    <div
      ref={root}
      className="lobby"
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files[0]) }}
    >
      <div className="table">
        <div className="biz-shadow" />
        <div className="biz" ref={card} onClick={flip}>
          <div className="biz-inner" ref={inner}>
            <div className="biz-face biz-front">
              <Shapes className="deboss" />
            </div>

            <div className="biz-face biz-back">
              <Shapes className="deboss tiny" />
              <p className="biz-q">Do you want to play a game?</p>

              <div className="phone" onClick={stop}>
                {editingSeed ? (
                  <input
                    autoFocus
                    value={seed}
                    onChange={(e) => setSeed(e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 16))}
                    onBlur={() => { setEditingSeed(false); if (!seed) setSeed(newSeed()) }}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  />
                ) : (
                  <button className="num" title="The game's seed: same number + same lists = same game. Click to type one." onClick={() => setEditingSeed(true)}>{asPhone(seed)}</button>
                )}
                <button className="redial" title="New number" onClick={() => setSeed(newSeed())}>↻</button>
              </div>

              <div className="biz-meta" onClick={stop}>
                <button onClick={() => setFiles(true)}>{config.players.length} players · {config.questions.length} questions · {config.dares.length} penalties</button>
                <span className="timer-step">
                  <button onClick={() => setConfig((c) => ({ ...c, seconds: Math.max(5, c.seconds - 5) }))}>−</button>
                  {config.seconds}s
                  <button onClick={() => setConfig((c) => ({ ...c, seconds: Math.min(120, c.seconds + 5) }))}>+</button>
                </span>
              </div>

              <div className="biz-actions">
                <button className="biz-no" onClick={refuse}>{NO_LINES[no]}</button>
                {canResume && <button className="biz-no" onClick={(e) => { e.stopPropagation(); onResume() }}>Resume</button>}
                <button className="biz-yes" disabled={!ready} onClick={yes}>Yes, I'll play</button>
              </div>
            </div>
          </div>
        </div>
        <p className="lobby-hint">{face === 'front' ? 'Click the card' : 'Click the card to turn it back'}</p>
      </div>

      <button className="ghost lobby-files-btn" onClick={() => setFiles(true)}>Player files</button>
      {files && <Files config={config} setConfig={setConfig} onClose={() => setFiles(false)} readFile={readFile} />}
      {drag && <div className="drop">Drop your .md</div>}
    </div>
  )
}

// The lists: paste them, or drop a .md file (read locally, never uploaded)
function Files({ config, setConfig, onClose, readFile }) {
  const [text, setText] = useState(() => ({
    players: config.players.join('\n'),
    questions: config.questions.join('\n'),
    dares: config.dares.join('\n'),
  }))
  const file = useRef()
  const panel = useRef()

  useGSAP(() => { gsap.from(panel.current, { y: 40, opacity: 0, duration: 0.45, ease: 'power3.out' }) }, { scope: panel })

  // a .md read while open replaces the text too
  const [seen, setSeen] = useState(config)
  if (seen !== config) {
    setSeen(config)
    setText({ players: config.players.join('\n'), questions: config.questions.join('\n'), dares: config.dares.join('\n') })
  }

  const commit = (t = text) => setConfig((c) => ({ ...c, players: lines(t.players), questions: lines(t.questions), dares: lines(t.dares) }))
  const edit = (key) => (e) => setText((t) => ({ ...t, [key]: e.target.value }))
  const counts = { players: lines(text.players).length, questions: lines(text.questions).length, dares: lines(text.dares).length }

  const downloadTemplate = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/markdown' }))
    a.download = 'squid-dare.md'
    a.click()
  }

  return (
    <div className="files-wrap" onClick={() => { commit(); onClose() }}>
      <div className="files" ref={panel} onClick={(e) => e.stopPropagation()}>
        <div className="cols">
          {[
            ['players', '○ Players', 'One full name per line'],
            ['questions', '△ Questions', 'Question | answer (the answer is for the host)'],
            ['dares', '□ Penalties', 'One dare per line'],
          ].map(([key, title, hint]) => (
            <label key={key} className="col">
              <span className="col-head">{title} <b>{counts[key]}</b></span>
              <textarea value={text[key]} onChange={edit(key)} onBlur={() => commit()} spellCheck={false} />
              <span className="hint">{hint}</span>
            </label>
          ))}
        </div>
        <div className="files-foot">
          <button className="ghost" onClick={() => file.current.click()}>Upload .md</button>
          <button className="ghost" onClick={downloadTemplate}>Template</button>
          <button className="ghost" onClick={() => { const t = { players: DEFAULTS.players.join('\n'), questions: DEFAULTS.questions.join('\n'), dares: DEFAULTS.dares.join('\n') }; setText(t); commit(t) }}>Reset lists</button>
          <input ref={file} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden onChange={(e) => { readFile(e.target.files[0]); e.target.value = '' }} />
          <span className="grow" />
          <button className="primary" onClick={() => { commit(); onClose() }}>Done</button>
        </div>
      </div>
    </div>
  )
}
