import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'
import { playerNo } from '../game/data'
import { Reel } from './Reel'
import { FlapReel, FlapText } from './FlapBoard'
import { toggleFull, useFullscreen } from './fullscreen'
import { IconBtn } from './IconBtn'
import { Eye, EyeOff, Maximize, Mic, MicOff, Minimize, PiggyBank, Volume2, VolumeX } from 'lucide-react'

gsap.registerPlugin(useGSAP, SplitText)

const won = (n) => '₩' + n.toLocaleString('en-US')

export function Hud({ run, remaining, total, prize, onLobby, config, setConfig }) {
  const toggle = (key) => setConfig((c) => ({ ...c, [key]: !c[key] }))
  const full = useFullscreen()
  const digits = String(total).length
  return (
    <div className="hud">
      <button className="logo small" onClick={onLobby} title="Back to the lobby">SQU<span className="tri">△</span>D <span className="pink">DARE</span></button>
      <div className="hud-right">
        <div className="hud-icons">
          <IconBtn icon={config.voice ? Volume2 : VolumeX} label={config.voice ? 'Doll voice on' : 'Doll voice off'} on={config.voice} onClick={() => toggle('voice')} />
          <IconBtn icon={config.mic ? Mic : MicOff} label={config.mic ? 'Mic answers on' : 'Mic answers off'} on={config.mic} onClick={() => toggle('mic')} />
          <IconBtn icon={full ? Minimize : Maximize} label={full ? 'Exit full screen' : 'Full screen'} onClick={toggleFull} />
        </div>
        {/* the dorm's board: players still in, and the piggy bank */}
        <div className="scoreboard">
          <div className="sb-cell">
            <span className="sb-label">Players</span>
            <span className="sb-value"><FlapText className="mini" text={String(remaining).padStart(digits, '0')} /><i>/ {String(total).padStart(digits, '0')}</i></span>
          </div>
          <div className="sb-cell prize">
            <span className="sb-label"><PiggyBank size={13} strokeWidth={2.4} /> Prize</span>
            <span className="sb-value">{won(prize)}</span>
          </div>
        </div>
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
  denied: 'Mic blocked. Allow it in Chrome, or judge with A / F',
  unsupported: 'This browser can\'t hear answers. Use Chrome, or judge with A / F',
  offline: 'Speech service unreachable. Judge with A / F',
}

// The clock: a dial of 60 ticks that go dark as time runs out
function Dial({ left, seconds, red }) {
  const lit = Math.ceil((left / seconds) * 60)
  return (
    <div className={`dial ${red ? 'red' : ''} ${left <= 5 && left > 0 ? 'pulse' : ''}`}>
      <svg viewBox="0 0 120 120">
        {Array.from({ length: 60 }, (_, i) => (
          <line key={i} x1="60" y1="6" x2="60" y2={i % 5 ? 14 : 18} transform={`rotate(${i * 6} 60 60)`} className={i < lit ? 'lit' : ''} />
        ))}
      </svg>
      <span>{Math.ceil(left)}</span>
    </div>
  )
}

// The players' vote from the show: O to stay, X to leave
function Vote({ kind, label, keyName, onClick }) {
  return (
    <button className={`vote ${kind}`} onClick={onClick} aria-label={label}>
      <svg viewBox="0 0 100 100">
        {kind === 'o' ? <circle cx="50" cy="50" r="30" /> : <path d="M26 26 L74 74 M74 26 L26 74" />}
      </svg>
      <span>{label} <kbd>{keyName}</kbd></span>
    </button>
  )
}

export function Light({ red, reading }) {
  return (
    <div className={`light-banner ${red ? 'red' : reading ? 'wait' : 'green'}`}>
      <b>{red ? 'Red light' : reading ? 'Listen' : 'Green light'}</b>
      <span>{red ? '빨간불' : reading ? '들어라' : '초록불'}</span>
    </div>
  )
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

  const micLine = matched ? `Heard it: “${heard}”`
    : reading ? 'The mic opens after the question'
    : MIC_SAYS[mic] ?? (heard ? `“${heard}”` : 'Listening… say your answer')

  return (
    <>
      <Light red={red} reading={reading} />
      <div className={`qbar ${red ? 'red' : ''}`}>
        <Dial left={left} seconds={seconds} red={red} />
        <div className="q-main">
          <div className="q-who">
            <Patch no={playerNo(player)} mini />
            <span>{player}</span>
            {question.a && (
              <button className={`peek ${reveal ? 'open' : ''}`} onClick={() => setReveal((v) => !v)} data-tip="Host: show the answer (R)" aria-label="Show the answer">
                {reveal ? <><EyeOff size={15} /> {question.a}</> : <Eye size={15} />}
              </button>
            )}
          </div>
          <p className="q-text">{question.q}</p>
          {micOn && !red && <p className={`mic ${matched ? 'hit' : mic}`}><span className="mic-dot" />{micLine}</p>}
        </div>
        <div className="votes">
          <Vote kind="o" label="Pass" keyName="A" onClick={() => onVerdict('answered')} />
          <Vote kind="x" label="Fail" keyName="F" onClick={() => onVerdict('failed')} />
        </div>
      </div>
    </>
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
