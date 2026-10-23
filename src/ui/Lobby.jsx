import { useRef, useState } from 'react'
import { DEFAULTS, TEMPLATE, lines, parseMd } from '../game/data'

// Players, questions and dares: paste them, or drop a .md file. The file is
// read in the browser (FileReader) and never uploaded anywhere.
export function Lobby({ config, setConfig, onStart, canResume, onResume }) {
  const [text, setText] = useState(() => ({
    players: config.players.join('\n'),
    questions: config.questions.join('\n'),
    dares: config.dares.join('\n'),
  }))
  const [seed, setSeed] = useState('')
  const [drag, setDrag] = useState(false)
  const file = useRef()

  const commit = (t = text) => setConfig((c) => ({ ...c, players: lines(t.players), questions: lines(t.questions), dares: lines(t.dares) }))
  const edit = (key) => (e) => setText((t) => ({ ...t, [key]: e.target.value }))

  const readFile = async (f) => {
    if (!f) return
    const md = parseMd(await f.text())
    // only replace the sections the file actually has
    const t = {
      players: md.players.length ? md.players.join('\n') : text.players,
      questions: md.questions.length ? md.questions.join('\n') : text.questions,
      dares: md.dares.length ? md.dares.join('\n') : text.dares,
    }
    setText(t)
    commit(t)
  }

  const downloadTemplate = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/markdown' }))
    a.download = 'squid-dare.md'
    a.click()
  }

  const counts = { players: lines(text.players).length, questions: lines(text.questions).length, dares: lines(text.dares).length }
  const ready = counts.players > 0 && counts.questions > 0 && counts.dares > 0

  return (
    <div
      className={`lobby ${drag ? 'drag' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files[0]) }}
    >
      <header className="lobby-head">
        <h1 className="logo">SQU<span className="tri">△</span>D <span className="pink">DARE</span></h1>
        <p className="kr">무궁화 꽃이 피었습니다</p>
        <p className="sub">Answer the question, or take the penalty.</p>
      </header>

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

      <div className="lobby-foot">
        <div className="files">
          <button className="ghost" onClick={() => file.current.click()}>Upload .md</button>
          <button className="ghost" onClick={downloadTemplate}>Template</button>
          <button className="ghost" onClick={() => { const t = { players: DEFAULTS.players.join('\n'), questions: DEFAULTS.questions.join('\n'), dares: DEFAULTS.dares.join('\n') }; setText(t); commit(t) }}>Reset lists</button>
          <input ref={file} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden onChange={(e) => { readFile(e.target.files[0]); e.target.value = '' }} />
        </div>
        <div className="go">
          <label className="field">
            <span>Timer</span>
            <input type="number" min={5} max={120} value={config.seconds} onChange={(e) => setConfig((c) => ({ ...c, seconds: Math.max(5, Math.min(120, +e.target.value || 20)) }))} />
            <span>s</span>
          </label>
          <label className="field">
            <span>Seed</span>
            <input className="seed-in" placeholder="random" value={seed} onChange={(e) => setSeed(e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 16))} />
          </label>
          {canResume && <button className="ghost" onClick={onResume}>Resume game</button>}
          <button className="primary" disabled={!ready} onClick={() => { commit(); onStart(seed) }}>Enter the game</button>
        </div>
      </div>
      {drag && <div className="drop">Drop your .md</div>}
    </div>
  )
}
