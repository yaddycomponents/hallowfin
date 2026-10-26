// Who Am I on the big screen: the rules, then each team in turn sends a
// player up, who gets 60 seconds of office names they can't see. Their team
// gives clues in English.
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Home } from 'lucide-react'
import { music, sfx, stopMusic, windDown } from '../audio/sound'
import { playerNo } from '../game/data'
import { Confetti } from '../ui/Confetti'
import { IconBtn } from '../ui/IconBtn'
import { RemoteBtn } from '../ui/RemoteBtn'
import { Dial, Patch } from '../ui/Panels'
import { ShapeBtn } from '../ui/ShapeBtn'
import { SECONDS, ROUNDS } from './useWhoAmI'
import { TEAMS } from './cards'

export function Mark({ shape, className = '' }) {
  return (
    <svg className={`wmark ${shape} ${className}`} viewBox="0 0 100 100" aria-hidden>
      {shape === 'o' ? <circle cx="50" cy="50" r="36" /> : shape === 't' ? <path d="M50 12 L90 84 L10 84 Z" /> : <rect x="14" y="14" width="72" height="72" />}
    </svg>
  )
}

const RULES = [
  'The guesser turns their back to the screen',
  'Their team gives clues, in English only',
  'Never say the word, or any part of it',
  'No letters, no spelling, no "starts with…"',
  'The guesser can ask questions: "Am I in tech?" "Do I wear glasses?"',
  `${SECONDS} seconds a turn: as many as you can. Skipping is free`,
]

// Space moves on wherever there's a ▶ on screen
function useSpace(on, go) {
  useEffect(() => {
    if (!on) return
    const k = (e) => {
      if (e.code !== 'Space' || e.repeat || e.target.closest?.('input, textarea')) return
      e.preventDefault()
      go()
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [on, go])
}

function Scores({ scores, team, step }) {
  return (
    <div className="wscores">
      {TEAMS.map((t, k) => (
        <div key={t.shape} className={`wscore ${k === team && step !== 'final' && step !== 'rules' ? 'up' : ''}`}>
          <Mark shape={t.shape} />
          <span className="wname">{t.name}</span>
          <b>{scores[k]}</b>
        </div>
      ))}
    </div>
  )
}

function Rules({ onNext }) {
  const root = useRef()
  useGSAP(() => {
    gsap.from('.wrules', { y: innerHeight, rotation: 10, duration: 0.9, ease: 'power4.out' })
    gsap.from('.wrules li', { opacity: 0, y: 14, stagger: 0.12, delay: 0.6 })
  }, { scope: root })
  return (
    <div className="wrules-wrap" ref={root}>
      <div className="wrules">
        <h2>Who am I?</h2>
        <ol>{RULES.map((t, i) => <li key={t}><Mark shape={'ots'[i % 3]} className="wrule-mark" />{t}</li>)}</ol>
        <p>Break a rule and that card doesn't count.</p>
      </div>
      <ShapeBtn shape="next" className="wnext" label="Call the team" keyName="Space" onClick={onNext} />
    </div>
  )
}

// a team's turn: they send someone up, who turns their back
function Called({ team, round, onNext }) {
  const t = TEAMS[team]
  useEffect(() => { music('called', 0.3, { restart: true }) }, [])
  return (
    <div className="wcalled">
      <Mark shape={t.shape} className="wcalled-mark" />
      <h2>Team {t.name}</h2>
      <p className="wround-of">Round {round} of {ROUNDS}</p>
      <p className="wturn">Send one player: back to the screen</p>
      <p className="wfor">Everyone else in Team {t.name}: get ready to give clues</p>
      <ShapeBtn shape="next" className="wnext" label="Start the clock" keyName="Space" onClick={onNext} />
    </div>
  )
}

// the turn: one card at a time, a clock, ✓ and skip
function Play({ card, got, seen, onMark, onDone }) {
  const [left, setLeft] = useState(SECONDS)
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  useEffect(() => {
    // the merry-go-round song runs ~64 s: one ride per turn, quiet under the clues
    music('lobby', 0.22, { restart: true })
    const end = performance.now() + SECONDS * 1000
    let beat = -1
    const id = setInterval(() => {
      const s = Math.max(0, (end - performance.now()) / 1000)
      setLeft(s)
      const whole = Math.ceil(s)
      if (whole <= 5 && whole > 0 && whole !== beat) { beat = whole; sfx.heart() }
      if (s === 0) {
        clearInterval(id)
        windDown('lobby', 900)
        sfx.turn()
        doneRef.current()
      }
    }, 50)
    return () => { clearInterval(id); stopMusic('lobby', 400) }
  }, [])

  useEffect(() => {
    const k = (e) => {
      if (e.repeat || e.target.closest?.('input, textarea')) return
      if (e.key === 'a' || e.key === 'ArrowRight') { e.preventDefault(); onMark(true) }
      if (e.key === 's' || e.key === 'ArrowLeft') { e.preventDefault(); onMark(false) }
      if (e.key === 'e') { windDown('lobby', 900); onDone() }
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [onMark, onDone])

  // every new card lands with a flip
  const face = useRef()
  useEffect(() => {
    if (!face.current) return
    gsap.fromTo(face.current, { rotationY: -90, scale: 0.85 }, { rotationY: 0, scale: 1, duration: 0.45, ease: 'back.out(1.6)' })
  }, [seen])

  return (
    <div className="wplay">
      <Dial left={left} seconds={SECONDS} red={left <= 5} />
      <div className="wcard-stage">
        <div className="wcard person" ref={face}>
          {card && <><Patch no={playerNo(card.person)} /><b>{card.person}</b><small>one of us</small></>}
        </div>
      </div>
      <div className="wgot">{got.length}<small>this turn</small></div>
      <div className="wctl">
        <button className="wskip" onClick={() => onMark(false)}>↷ Skip <kbd>S</kbd></button>
        <button className="wyes" onClick={() => onMark(true)}>✓ Got it <kbd>A</kbd></button>
      </div>
      <button className="wend" onClick={() => { windDown('lobby', 900); onDone() }}>End turn <kbd>E</kbd></button>
    </div>
  )
}

function Score({ team, entry, onNext, last }) {
  const t = TEAMS[team]
  useEffect(() => { if (entry.got.length) sfx.survived() }, [])
  return (
    <div className="wsum">
      <h2 className={t.shape}><Mark shape={t.shape} /> Team {t.name} got <b>{entry.got.length}</b></h2>
      <ul className="wchips">
        {entry.got.map((c, i) => <li key={'g' + i} className="ok">{c.word}</li>)}
        {entry.skipped.map((c, i) => <li key={'s' + i}>{c.word}</li>)}
      </ul>
      <ShapeBtn shape="next" className="wnext" label={last ? 'The results' : 'Next team'} keyName="Space" onClick={onNext} />
    </div>
  )
}

function Final({ scores, onAgain, onLobby }) {
  const order = [0, 1, 2].sort((a, b) => scores[b] - scores[a])
  const top = scores[order[0]]
  const winners = order.filter((k) => scores[k] === top)
  useEffect(() => { sfx.survived(); music('lobby', 0.4, { restart: true }); return () => stopMusic('lobby', 600) }, [])
  return (
    <div className="wfinal">
      <Confetti />
      <h2>{winners.length > 1 ? 'A tie!' : `Team ${TEAMS[winners[0]].name} wins`}</h2>
      <ol>
        {order.map((k, i) => (
          <li key={k} className={scores[k] === top ? 'win' : ''}>
            <span className="place">{i + 1}</span><Mark shape={TEAMS[k].shape} /><span>{TEAMS[k].name}</span><b>{scores[k]}</b>
          </li>
        ))}
      </ol>
      <div className="wfinal-btns">
        <button onClick={onAgain}>New teams, new game</button>
        <button onClick={onLobby}>Back to the lobby</button>
      </div>
    </div>
  )
}

export function WhoAmI({ g, onLobby, remote }) {
  const { w, team, turns, card } = g
  const step = w?.step
  const last = w && w.turn + 1 >= turns

  // the opening's music carries the rules; the first call ends it
  useEffect(() => { if (step === 'called') stopMusic('intro', 900) }, [step])
  useEffect(() => { if (step === 'play') stopMusic('called', 700) }, [step])

  useSpace(step === 'rules', () => g.to('called'))
  useSpace(step === 'called', g.play)
  useSpace(step === 'score', g.next)

  if (!w) return null
  return (
    <div className={`whoami step-${step}`}>
      <div className="whud">
        <IconBtn icon={Home} label="Lobby" onClick={onLobby} />
        <RemoteBtn remote={remote} />
        <span className="wround">{step === 'final' || step === 'rules' ? 'Who am I?' : `Turn ${Math.min(w.turn + 1, turns)} of ${turns}`}</span>
      </div>
      <Scores scores={w.scores} team={team} step={step} />
      {step === 'rules' && <Rules onNext={() => g.to('called')} />}
      {step === 'called' && <Called key={w.turn} team={team} round={Math.floor(w.turn / 3) + 1} onNext={g.play} />}
      {step === 'play' && <Play key={w.turn} card={card} got={w.got} seen={w.got.length + w.skipped.length} onMark={g.mark} onDone={g.done} />}
      {step === 'score' && <Score team={team} entry={w.log[w.log.length - 1]} last={last} onNext={g.next} />}
      {step === 'final' && <Final scores={w.scores} onAgain={g.again} onLobby={onLobby} />}
    </div>
  )
}
