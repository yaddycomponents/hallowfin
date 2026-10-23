import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'
import { playerNo } from '../game/data'
import { Reel } from './Reel'
import { FlapReel, FlapText } from './FlapBoard'
import { toggleFull, useFullscreen } from './fullscreen'

gsap.registerPlugin(useGSAP, SplitText)

const won = (n) => '₩' + n.toLocaleString('en-US')

export function Hud({ run, remaining, total, prize, onLobby, config, setConfig }) {
  const toggle = (key) => setConfig((c) => ({ ...c, [key]: !c[key] }))
  const full = useFullscreen()
  return (
    <div className="hud">
      <button className="logo small" onClick={onLobby} title="Back to the lobby">SQU<span className="tri">△</span>D <span className="pink">DARE</span></button>
      <div className="hud-right">
        <div className="toggles">
          <button className={config.voice ? 'on' : ''} onClick={() => toggle('voice')} title="The doll reads questions aloud">Voice</button>
          <button className={config.mic ? 'on' : ''} onClick={() => toggle('mic')} title="Players answer into the mic">Mic</button>
          <button className={full ? 'on' : ''} onClick={toggleFull} title="Full screen">Full</button>
        </div>
        <div className="stat"><span>Players left</span><b><FlapText className="mini" text={String(remaining).padStart(String(total).length, '0')} /><i>/{total}</i></b></div>
        <div className="stat piggy"><span>Prize pool</span><b>{won(prize)}</b></div>
      </div>
      <div className="seed" title="Same seed + same lists = the same draw. Anyone can replay it.">SEED {run.seed.slice(0, 8)}·{run.seed.slice(8)}</div>
    </div>
  )
}

// The name reel. The player is already drawn (PCG, see pcg.js); the spin
// only animates to them.
export function PickPanel({ remaining, target, onLanded, phase }) {
  const reel = useRef()
  const items = remaining
  const index = Math.max(0, items.findIndex((p) => p.i === target))
  const spinning = useRef(false)
  const spin = () => {
    if (phase !== 'pick' || spinning.current) return
    spinning.current = true
    reel.current?.spin(index)
  }

  useEffect(() => {
    const k = (e) => { if (e.code === 'Space') { e.preventDefault(); spin() } }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  })

  return (
    <div className={`panel pick ${phase}`}>
      <FlapReel ref={reel} items={items} onDone={onLanded} />
      {phase === 'pick' && <button className="primary big" onClick={spin}>Spin <kbd>Space</kbd></button>}
    </div>
  )
}

// The tracksuit: teal knit, a zip, and the white number patch stitched on the chest
export function Patch({ no, mini }) {
  return <span className={`patch ${mini ? 'mini' : ''}`}><span>{no}</span></span>
}

export function Called({ name }) {
  const root = useRef()
  useGSAP(() => {
    const split = SplitText.create('.called-name', { type: 'chars' })
    gsap.timeline()
      .from('.suit', { y: 260, opacity: 0, duration: 0.7, ease: 'power3.out' })
      .from('.suit .patch', { scale: 1.8, rotation: -14, opacity: 0, duration: 0.45, ease: 'back.out(2.2)' }, '-=0.15')
      .from(split.chars, { y: 40, opacity: 0, rotationX: -80, stagger: 0.035, duration: 0.5, ease: 'back.out(1.8)' }, '-=0.1')
    return () => split.revert()
  }, { scope: root })
  return (
    <div className="called" ref={root}>
      <div className="suit">
        <span className="zip" />
        <Patch no={playerNo(name)} />
      </div>
      <div className="called-name">{name}</div>
    </div>
  )
}

const MIC_SAYS = {
  denied: 'Mic blocked: allow it in Chrome, or judge with A / F',
  unsupported: 'No speech recognition here: use Chrome, or judge with A / F',
  offline: 'Speech service unreachable: judge with A / F',
}

export function QuestionPanel({ question, player, seconds, left, phase, stage, micOn, mic, heard, onVerdict }) {
  const [reveal, setReveal] = useState(false)
  const red = phase === 'redlight'
  const reading = stage === 'reading' && !red
  const matched = stage === 'matched'

  useEffect(() => {
    const k = (e) => {
      if (e.key === 'a') onVerdict('answered')
      if (e.key === 'f') onVerdict('failed')
      if (e.key === 'r') setReveal((v) => !v)
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [onVerdict])

  const frac = Math.max(0, left / seconds)
  return (
    <div className={`panel question ${red ? 'red' : 'green'}`}>
      <div className="q-top">
        <span className="q-player"><Patch no={playerNo(player)} mini /> {player}</span>
        <span className={`light ${red ? 'red' : 'green'}`}>{red ? 'RED LIGHT' : reading ? 'LISTEN…' : 'GREEN LIGHT'}</span>
      </div>
      <div className="q-body">
        <div className="timer">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" className="track" />
            <circle cx="50" cy="50" r="44" className="ring" style={{ strokeDashoffset: 276.5 * (1 - frac) }} />
          </svg>
          <span>{Math.ceil(left)}</span>
        </div>
        <p className="q-text">{question.q}</p>
      </div>
      {micOn && !red && (
        <div className={`mic ${matched ? 'hit' : mic}`}>
          <span className="mic-dot" />
          {matched ? `Heard it: “${heard}”`
            : reading ? 'The mic opens after the question'
            : MIC_SAYS[mic] ?? (heard ? `“${heard}”` : 'Listening… say your answer')}
        </div>
      )}
      {question.a && (
        <button className="answer" onClick={() => setReveal((v) => !v)}>
          {reveal ? question.a : 'Reveal answer (host)'} <kbd>R</kbd>
        </button>
      )}
      <div className="verdict-btns">
        <button className="ok" onClick={() => onVerdict('answered')}>○ Answered <kbd>A</kbd></button>
        <button className="bad" onClick={() => onVerdict('failed')}>✕ Failed <kbd>F</kbd></button>
      </div>
    </div>
  )
}

export function Stamp({ kind, small }) {
  return <div className={`stamp ${kind} ${small ? 'small' : ''}`}>{kind === 'eliminated' ? 'ELIMINATED' : 'SURVIVED'}</div>
}

// The penalty reel: spins by itself after the elimination
export function DarePanel({ dares, target, phase, onLanded, onNext }) {
  const reel = useRef()
  useEffect(() => {
    if (phase !== 'eliminated') return
    const t = setTimeout(() => reel.current?.spin(target), 1600)
    return () => clearTimeout(t)
  }, [phase, target])

  return (
    <div className={`panel dare ${phase}`}>
      <div className="dare-head">□ PENALTY</div>
      <Reel ref={reel} items={dares} ms={3000} onDone={onLanded} render={(d) => <div className="dare-row">{d}</div>} />
      {phase === 'dare' && <button className="primary big" onClick={onNext}>Next player <kbd>Space</kbd></button>}
    </div>
  )
}

export function End({ log, onLobby, onAgain }) {
  return (
    <div className="end">
      <h2>GAME OVER</h2>
      <ul>
        {log.map((e, i) => (
          <li key={i} className={e.result}>
            <span className="no">{playerNo(e.name)}</span>
            <span className="nm">{e.name}</span>
            <span className="res">{e.result === 'failed' ? `✕ ${e.dare}` : '○ survived'}</span>
          </li>
        ))}
      </ul>
      <div className="end-btns">
        <button className="ghost" onClick={onLobby}>Lobby</button>
        <button className="primary" onClick={onAgain}>New game</button>
      </div>
      <p className="credit">Doll model: "Squid Game Doll Rig" by Bug All (CC-BY), Sketchfab</p>
    </div>
  )
}
