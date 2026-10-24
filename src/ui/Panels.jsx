import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'
import { playerNo } from '../game/data'
import { music } from '../audio/sound'
import { Shapes } from './Shapes'
import { Lyrics } from './Lyrics'
import { FlapReel, FlapText } from './FlapBoard'
import { toggleFull, useFullscreen } from './fullscreen'
import { IconBtn } from './IconBtn'
import { ShapeBtn } from './ShapeBtn'
import { MicMeter } from './MicMeter'
import { Crosshair, Eye, EyeOff, Home, Maximize, Mic, MicOff, Minimize, PiggyBank, Volume2, VolumeX } from 'lucide-react'

gsap.registerPlugin(useGSAP, SplitText)

const won = (n) => '₩' + n.toLocaleString('en-US')

export function Hud({ run, remaining, total, prize, onLobby, config, setConfig, listening = false }) {
  // a demo ends here (back to the real game); a game is kept, to resume
  const home = run.demo ? 'End the demo' : 'Back to the lobby'
  const toggle = (key) => setConfig((c) => ({ ...c, [key]: !c[key] }))
  const full = useFullscreen()
  const digits = String(total).length
  return (
    <div className="hud">
      <button className="logo small" onClick={onLobby} title={home}>SQU<span className="tri">△</span>D <span className="pink">DARE</span></button>
      <div className="hud-right">
        <div className="hud-icons">
          <IconBtn icon={Home} label={home} onClick={onLobby} />
          <IconBtn icon={config.voice ? Volume2 : VolumeX} label={config.voice ? 'Doll voice on' : 'Doll voice off'} on={config.voice} onClick={() => toggle('voice')} />
          {config.mic
            ? <MicMeter listening={listening} onClick={() => toggle('mic')} />
            : <IconBtn icon={MicOff} label="Mic answers off" on={false} onClick={() => toggle('mic')} />}
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
// One of the three shapes, drawn to sit in a line of text
const SHAPES = ['t', 's', 'o']
export function ShapeGlyph({ shape }) {
  return (
    <svg className="glyph" viewBox="0 0 40 40" aria-hidden>
      {shape === 'o' && <circle cx="20" cy="20" r="15" />}
      {shape === 't' && <path d="M20 4 L37 35 L3 35 Z" />}
      {shape === 's' && <rect x="5" y="5" width="30" height="30" />}
    </svg>
  )
}

// "SP△N": the I is a triangle, like the show's logo (SQU△D). While the board
// spins it runs through △ □ ○ once per name, so it slows down with the board.
function SpinButton({ running, onClick }) {
  const [k, setK] = useState(0)
  useEffect(() => {
    const on = () => setK((x) => x + 1)
    addEventListener('flap-tick', on)
    return () => removeEventListener('flap-tick', on)
  }, [])
  return (
    <button className={`spin-btn ${running ? 'running' : ''}`} onClick={onClick} aria-label="Spin">
      <span className="trail" aria-hidden>{Array.from({ length: 12 }, (_, i) => <ShapeGlyph key={i} shape={SHAPES[i % 3]} />)}</span>
      <span className="word">SP<ShapeGlyph shape={SHAPES[k % 3]} />N</span>
      {!running && <kbd>Space</kbd>}
    </button>
  )
}

// auto: spin by itself once the floor is laid out (every draw after the first)
export function PickPanel({ remaining, target, onLanded, phase, auto = false }) {
  const reel = useRef()
  const items = remaining
  const index = Math.max(0, items.findIndex((p) => p.i === target))
  const [running, setRunning] = useState(false)
  // a ref too, so a spin started from a timer sees the latest value
  const busy = useRef(false)
  // back to the floor without a remount (the called player was skipped as
  // absent): ready to spin again
  useEffect(() => { if (phase === 'pick') { busy.current = false; setRunning(false) } }, [phase])
  const spin = () => {
    if (phase !== 'pick' || busy.current) return
    busy.current = true
    setRunning(true)
    // the merry-go-round song plays for the ride (it stops once a name is
    // called); the last player left has no ride, so no song
    if (items.length > 1) music('lobby', 0.45)
    reel.current?.spin(index)
  }

  // the floor takes ~1 s to ripple in; then the ride starts on its own
  useEffect(() => {
    if (phase !== 'pick' || !auto) return
    const t = setTimeout(spin, 1300)
    return () => clearTimeout(t)
  }, [phase, auto, target])

  useEffect(() => {
    const k = (e) => { if (e.code === 'Space') { e.preventDefault(); spin() } }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  })

  return (
    <div className={`panel pick ${phase}`}>
      <FlapReel ref={reel} bare items={items} onDone={onLanded} onTick={() => dispatchEvent(new Event('flap-tick'))} />
      {phase === 'pick' && <SpinButton running={running} onClick={spin} />}
      {phase === 'pick' && running && items.length > 1 && <Lyrics />}
    </div>
  )
}

// The tracksuit: teal knit, a zip, and the white number patch stitched on the chest
export function Patch({ no, mini }) {
  return <span className={`patch ${mini ? 'mini' : ''}`}><span>{no}</span></span>
}

// the player's tile from the floor, held up close: teal cloth, the stitched
// edge, their shape, and the number patch
function TileShape({ shape }) {
  return (
    <svg className="tile-shape" viewBox="0 0 40 40">
      {shape === 'o' ? <circle cx="20" cy="20" r="14" /> : shape === 't' ? <path d="M20 5 L35 33 L5 33 Z" /> : <rect x="7" y="7" width="26" height="26" />}
    </svg>
  )
}

export function Called({ name, shape }) {
  const root = useRef()
  useGSAP(() => {
    const split = SplitText.create('.called-name', { type: 'chars' })
    gsap.timeline()
      // it turns over like the tile on the floor did
      .from('.tile-card', { y: 200, rotationX: 75, scale: 0.6, opacity: 0, duration: 0.75, ease: 'back.out(1.4)' })
      .from('.tile-card .tile-shape', { scale: 0, opacity: 0, duration: 0.35, ease: 'back.out(2.4)' }, '-=0.3')
      .from('.tile-card .patch', { scale: 1.8, rotation: -14, opacity: 0, duration: 0.45, ease: 'back.out(2.2)' }, '-=0.2')
      .from(split.chars, { y: 40, opacity: 0, rotationX: -80, stagger: 0.035, duration: 0.5, ease: 'back.out(1.8)' }, '-=0.1')
    return () => split.revert()
  }, { scope: root })
  return (
    <div className="called" ref={root}>
      <div className="tile-card">
        <TileShape shape={shape} />
        <Patch no={playerNo(name)} />
      </div>
      <div className="called-name">{name}</div>
    </div>
  )
}

// which browser this is, for the "can't hear" message (Zen and others build on Firefox)
const BROWSER = /Firefox/.test(navigator.userAgent) ? 'Firefox-based browsers (Firefox, Zen)'
  : /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent) ? 'Safari' : 'This browser'

const MIC_SAYS = {
  denied: 'Mic blocked: click the mic icon in Chrome\'s address bar and allow it. Judge with A / F for now',
  unsupported: `${BROWSER} can't hear answers. Open this page in Google Chrome, or judge with A / F`,
  offline: 'Chrome can\'t reach its speech service (network or Brave-style blocking). Judge with A / F',
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

// Red light: the guard is aiming. The bar drains over `grace` seconds; the
// host can still press O to spare the player before it runs out.
function ShootBar({ grace }) {
  return (
    <div className="shoot">
      <Crosshair size={16} />
      <span className="shoot-label">Guard is aiming <kbd>A</kbd> to spare</span>
      <span className="shoot-track"><i style={{ animationDuration: `${grace}s` }} /></span>
    </div>
  )
}

export function QuestionPanel({ question, player, seconds, left, phase, stage, micOn, hard, mic, heard, watching, grace, onVerdict }) {
  const [reveal, setReveal] = useState(false)
  const red = phase === 'redlight'
  const reading = stage === 'reading' && !red
  const matched = stage === 'matched'
  const wrong = stage === 'wrong'
  const moved = stage === 'moved' // spoke while she was looking

  useEffect(() => {
    const k = (e) => {
      if (e.key === 'a') onVerdict('answered')
      if (e.key === 'f') onVerdict('failed')
      if (e.key === 'r') setReveal((v) => !v)
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [onVerdict])

  const micLine = moved ? `Caught talking at red light: “${heard}”`
    : watching ? 'She’s watching. Not a word…'
    : matched ? `Heard it: “${heard}”`
    : wrong ? `Wrong: “${heard}”`
    : reading ? 'Answer while she sings. When she turns: not a word'
    : MIC_SAYS[mic] ?? (heard ? (hard ? `Last answer: “${heard}”` : `“${heard}”`) : hard ? 'Listening… your last answer counts' : 'Listening… say your answer')

  return (
    <>
      <Light red={red || watching || moved} reading={reading} />
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
          {micOn && !red && <p className={`mic ${matched ? 'hit' : wrong || moved ? 'miss' : watching ? 'freeze' : mic}`}><span className="mic-dot" />{micLine}</p>}
          {red && <ShootBar grace={grace} />}
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

// The penalty arrives as one of the recruiter's cards: it flies in face
// down (○△□), turns over, and the dare is typed on the back.
export function PenaltyCard({ dare, player, onShown, onNext, shown }) {
  const root = useRef()
  useGSAP(() => {
    // after the guard's shot (~1.3 s in) has landed
    gsap.timeline({ delay: 2.3 })
      .from('.pen-card', { y: innerHeight, rotation: 28, rotationX: 55, scale: 1.4, duration: 0.85, ease: 'power4.out' })
      .from('.pen-shadow', { opacity: 0, duration: 0.6 }, '<')
      .to('.pen-card .biz-inner', { rotationY: 180, duration: 0.85, ease: 'back.inOut(1.3)' }, '+=0.35')
      .call(() => onShown?.())
  }, { scope: root })
  return (
    <div className="penalty" ref={root}>
      <div className="pen-shadow" />
      <div className="pen-card">
        <div className="biz-inner">
          <div className="biz-face biz-front"><Shapes className="deboss" /></div>
          <div className="biz-face biz-back pen-back">
            <span className="pen-head"><Shapes className="deboss tiny inline" /> Penalty</span>
            <p className="pen-dare">{dare}</p>
            <span className="pen-for">for player {playerNo(player)}</span>
          </div>
        </div>
      </div>
      {shown && <ShapeBtn shape="next" label="Next player" keyName="Space" onClick={onNext} />}
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
            <span className="res">{e.result === 'failed' ? `✕ ${e.dare}` : e.result === 'absent' ? '– not here' : '○ survived'}</span>
          </li>
        ))}
      </ul>
      <div className="end-btns">
        <IconBtn icon={Home} label="Back to the lobby" onClick={onLobby} />
        <ShapeBtn shape="next" label="New game" onClick={onAgain} />
      </div>
      <p className="credit">Doll model: "Squid Game Doll Rig" by Bug All (CC-BY), Sketchfab · Guard model: "Squid Game Pink Soldier" by Protyanik25 (CC-BY), Sketchfab · Arena: "Squid Game: Red Light Green Light" by DodoBabypop (CC BY-NC-ND), Sketchfab</p>
    </div>
  )
}
