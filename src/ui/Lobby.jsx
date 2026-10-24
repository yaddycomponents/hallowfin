import { useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { DEFAULTS, TEMPLATE, lines, parseMd } from '../game/data'
import { newSeed } from '../game/pcg'
import { music, sfx } from '../audio/sound'
import { enterFull, toggleFull, useFullscreen } from './fullscreen'
import { IconBtn } from './IconBtn'
import { Shapes } from './Shapes'
import { FileDown, FolderOpen, Maximize, Minimize, Presentation, RotateCcw, Upload } from 'lucide-react'
import { ShapeBtn } from './ShapeBtn'
import { RemoteBtn } from './RemoteBtn'

gsap.registerPlugin(useGSAP)

// The lobby is the recruiter's business card: kraft card, ○△□ pressed into
// the front, a number on the back. Here the number is the game's PCG seed
// ("same number, same game"). Flip it, and answer the only question.
const NO_LINES = ['No', 'Are you sure?', 'Your debt says otherwise', 'There is no "no"']

const asPhone = (s) => s.toUpperCase().match(/.{1,4}/g)?.join(' ') ?? ''

export function Lobby({ config, setConfig, onStart, onDemo, remote, canResume, onResume }) {
  const [seed, setSeed] = useState(newSeed)
  const [editingSeed, setEditingSeed] = useState(false)
  const [face, setFace] = useState('front')
  const [files, setFiles] = useState(false)
  const [no, setNo] = useState(0)
  const [drag, setDrag] = useState(false)
  const full = useFullscreen()
  const upload = useRef()
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
    // browsers hold sound until the first click: this is it, so the opening starts here
    music('intro', 0.5)
    setFace(toBack ? 'back' : 'front')
    gsap.to(inner.current, { rotationY: toBack ? 180 : 0, duration: 0.9, ease: 'back.inOut(1.3)' })
  })

  const yes = contextSafe((e) => {
    e.stopPropagation()
    enterFull() // the game is for the big screen
    sfx.unlock()
    sfx.land()
    gsap.to(card.current, { scale: 2.6, y: -30, opacity: 0, rotationX: -25, duration: 0.65, ease: 'power3.in', onComplete: () => onStart(seed) })
    gsap.to('.biz-shadow, .lobby-hint, .lobby-corner', { opacity: 0, duration: 0.3 })
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
                <button
                  className={`mode-btn ${config.hard ? 'hard' : ''}`}
                  title={config.hard ? 'Hard: talk till time runs out, only the last answer counts, exact words. Click for easy' : 'Easy: keeps listening, forgives spelling. Click for hard'}
                  onClick={() => setConfig((c) => ({ ...c, hard: !c.hard }))}
                >{config.hard ? 'Hard' : 'Easy'}</button>
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

      <div className="lobby-corner">
        <RemoteBtn remote={remote} />
        <IconBtn icon={Presentation} label="Demo: show the team how to play" onClick={() => { enterFull(); onDemo() }} />
        <IconBtn icon={Upload} label="Upload a .md list" onClick={() => upload.current.click()} />
        <IconBtn icon={FolderOpen} label="Player files" onClick={() => setFiles(true)} />
        <IconBtn icon={full ? Minimize : Maximize} label={full ? 'Exit full screen' : 'Full screen'} onClick={toggleFull} />
        <input ref={upload} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden onChange={(e) => { readFile(e.target.files[0]); e.target.value = '' }} />
      </div>
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
        {/* the Front Man's monitor: who's playing, what's asked, what it costs */}
        <div className="files-head">
          <Shapes className="files-logo" />
          <b>Player files</b>
          <span>Stays on this computer</span>
        </div>
        <div className="cols">
          {[
            ['players', 'o', 'Players', 'One full name per line'],
            ['questions', 't', 'Questions', 'Question | answer (the answer is for the host)'],
            ['dares', 's', 'Penalties', 'One dare per line'],
          ].map(([key, shape, title, hint]) => (
            <label key={key} className="col">
              <span className="col-head"><i className={`glyph ${shape}`} />{title} <b>{String(counts[key]).padStart(2, '0')}</b></span>
              <textarea value={text[key]} onChange={edit(key)} onBlur={() => commit()} spellCheck={false} />
              <span className="hint">{hint}</span>
            </label>
          ))}
        </div>
        <div className="files-foot">
          <IconBtn icon={Upload} label="Upload a .md list" onClick={() => file.current.click()} />
          <IconBtn icon={FileDown} label="Download the .md template" onClick={downloadTemplate} />
          <IconBtn icon={RotateCcw} label="Reset to the sample lists" onClick={() => { const t = { players: DEFAULTS.players.join('\n'), questions: DEFAULTS.questions.join('\n'), dares: DEFAULTS.dares.join('\n') }; setText(t); commit(t) }} />
          <input ref={file} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden onChange={(e) => { readFile(e.target.files[0]); e.target.value = '' }} />
          <span className="grow" />
          <ShapeBtn shape="o" label="Done" onClick={() => { commit(); onClose() }} />
        </div>
      </div>
    </div>
  )
}
