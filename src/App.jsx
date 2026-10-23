import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from './game/useGame'
import { playerNo } from './game/data'
import { heardAnswer, saidSomething } from './game/match'
import { music, sfx, stopMusic } from './audio/sound'
import { announce, canListen, hush, listen } from './audio/speech'
import { Stage } from './scene/Stage'
import { Lobby } from './ui/Lobby'
import { ShapeBtn } from './ui/ShapeBtn'
import { Called, End, Hud, PenaltyCard, PickPanel, QuestionPanel, Stamp } from './ui/Panels'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
// red light: how long the host has to spare a player before the guard fires
const GRACE = 4

export default function App() {
  const g = useGame()
  const { run, config, current } = g
  const phase = run.phase
  const [left, setLeft] = useState(config.seconds)
  // inside a question: the doll reads it → the clock runs (mic open) → matched
  const [stage, setStage] = useState('reading')
  const [heard, setHeard] = useState('')
  const [mic, setMic] = useState('off')
  const [shots, setShots] = useState(0)
  const beat = useRef(-1)
  const lastSaid = useRef('') // hard mode: the latest thing the player said
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  // the announcer only calls numbers and verdicts; questions are read off the screen
  const say = useCallback((kind, n) => (config.voice ? announce(kind, n) : Promise.resolve()), [config.voice])
  const no = current.player ? playerNo(current.player) : ''

  // music per phase: the lobby tune while picking; the doll's song starts once she has read the question
  useEffect(() => {
    if (phase === 'redlight') stopMusic('redlight', 150)
    else if (phase === 'pick' || phase === 'lobby' || phase === 'end') { stopMusic('redlight'); music('lobby', 0.45) }
    if (phase === 'lobby') hush()
  }, [phase])

  // a name is called: she announces it, then green light
  useEffect(() => {
    if (phase !== 'picked') return
    let live = true
    Promise.all([say('call', no), wait(2200)]).then(() => live && g.to('question'))
    return () => { live = false }
  }, [phase])

  // green light: she reads the question; then the clock and the mic start together
  useEffect(() => {
    if (phase !== 'question') return
    let live = true
    setStage('reading')
    setHeard('')
    lastSaid.current = ''
    setLeft(config.seconds)
    stopMusic('lobby', 400)
    // a beat to read the question, then the clock and the mic start
    wait(1200).then(() => {
      if (!live) return
      setStage('clock')
      // keep the song low while the mic is open, so it hears the player, not the speakers
      music('redlight', config.mic && canListen ? 0.15 : 0.7, { restart: true })
    })
    return () => { live = false }
  }, [phase])

  // the question clock; a heartbeat in the last five seconds; red light at zero
  useEffect(() => {
    if (phase !== 'question' || stage !== 'clock') return
    const end = performance.now() + config.seconds * 1000
    beat.current = -1
    const id = setInterval(() => {
      const s = Math.max(0, (end - performance.now()) / 1000)
      setLeft(s)
      const whole = Math.ceil(s)
      if (whole <= 5 && whole > 0 && whole !== beat.current) { beat.current = whole; sfx.heart() }
      if (s === 0) { clearInterval(id); timeUp.current() }
    }, 50)
    return () => clearInterval(id)
  }, [phase, stage, config.seconds, g.to])

  // time's up. Hard mode judges now: their last answer, word for word. Anything
  // else (or easy mode, where a right answer already passed them) is red light.
  const timeUp = useRef()
  timeUp.current = () => {
    if (config.hard && config.mic && lastSaid.current && heardAnswer(current.question?.a, [lastSaid.current], { strict: true })) {
      setStage('matched')
      wait(900).then(() => onVerdict('answered'))
      return
    }
    if (config.hard && lastSaid.current) setStage('wrong')
    sfx.turn()
    g.to('redlight')
  }

  const onVerdict = useCallback((r) => {
    // once per question, whoever gets there first (the mic, the host, a key)
    if (phaseRef.current !== 'question' && phaseRef.current !== 'redlight') return
    phaseRef.current = r
    if (r === 'failed') sfx.eliminated()
    else sfx.survived()
    stopMusic('redlight', 200)
    g.verdict(r)
    wait(r === 'failed' ? 700 : 300).then(() => say(r === 'failed' ? 'out' : 'pass', no))
  }, [g.verdict, say, no])

  // red light: the shoot bar drains; nobody spares them in time → eliminated
  useEffect(() => {
    if (phase !== 'redlight') return
    const id = setTimeout(() => onVerdict('failed'), GRACE * 1000)
    return () => clearTimeout(id)
  }, [phase, onVerdict])

  // the mic: open while the clock runs. Easy: hearing the answer stops the clock
  // and passes them. Hard: it just keeps the last thing said, judged at time-up
  useEffect(() => {
    if (phase !== 'question' || stage !== 'clock' || !config.mic) return
    const answer = current.question?.a
    let hit = false
    const stop = listen({
      lang: config.lang,
      onState: setMic,
      onText: ({ text, all, final, interim }) => {
        if (hit) return
        if (config.hard) {
          // they can talk till the clock runs out; only the last thing said counts
          const now = interim || final
          if (now && saidSomething(now)) { lastSaid.current = now; setHeard(now) }
          return
        }
        setHeard(text)
        if (heardAnswer(answer, all)) {
          hit = true
          setStage('matched')
          wait(900).then(() => onVerdict('answered'))
        }
      },
    })
    return () => { stop(); setMic('off') }
  }, [phase, stage, config.mic, config.hard, config.lang, current.question, onVerdict])

  // the guard fires: the bang and the white flash land on the muzzle flash, not the verdict
  useEffect(() => {
    const hit = () => { sfx.gunshot(); setShots((n) => n + 1) }
    addEventListener('guard-shot', hit)
    return () => removeEventListener('guard-shot', hit)
  }, [])

  // Space moves on after a verdict
  useEffect(() => {
    if (phase !== 'survived' && phase !== 'dare') return
    const k = (e) => { if (e.code === 'Space') { e.preventDefault(); hush(); g.next() } }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [phase, g.next])

  const start = (seed) => {
    sfx.unlock()
    // ask for the mic now, not halfway through the first question
    if (config.mic && canListen) navigator.mediaDevices?.getUserMedia({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop()), () => {})
    g.start(seed)
  }
  const inGame = phase !== 'lobby'

  return (
    <>
      <Stage phase={phase} />
      {phase === 'lobby' && (
        <Lobby
          config={config}
          setConfig={g.setConfig}
          onStart={start}
          canResume={run.log.length > 0 && run.turn < config.players.length}
          onResume={() => { sfx.unlock(); g.resume() }}
        />
      )}
      {inGame && phase !== 'end' && <Hud run={run} remaining={g.remaining.length} total={config.players.length} prize={g.won} onLobby={g.lobby} config={config} setConfig={g.setConfig} />}
      {(phase === 'pick' || phase === 'picked') && (
        <PickPanel remaining={g.remaining} target={current.playerIndex} phase={phase} onLanded={() => g.to('picked')} />
      )}
      {phase === 'picked' && <Called name={current.player} />}
      {(phase === 'question' || phase === 'redlight') && current.question && (
        <QuestionPanel
          key={run.turn}
          question={current.question}
          player={current.player}
          seconds={config.seconds}
          left={left}
          phase={phase}
          stage={stage}
          micOn={config.mic}
          hard={config.hard}
          mic={mic}
          heard={heard}
          grace={GRACE}
          onVerdict={onVerdict}
        />
      )}
      {phase === 'survived' && (
        <>
          <Stamp kind="survived" />
          <ShapeBtn shape="next" className="next-slot" label="Next player" keyName="Space" onClick={() => { hush(); g.next() }} />
        </>
      )}
      {(phase === 'eliminated' || phase === 'dare') && (
        <>
          <Stamp kind="eliminated" small={phase === 'dare'} />
          {phase === 'eliminated' && shots > 0 && <div key={shots} className="shot-flash" />}
          <PenaltyCard
            key={run.turn}
            dare={current.dare}
            player={current.player}
            shown={phase === 'dare'}
            onShown={() => g.to('dare')}
            onNext={() => { hush(); g.next() }}
          />
        </>
      )}
      {phase === 'end' && <End log={run.log} onLobby={g.lobby} onAgain={() => start()} />}
    </>
  )
}
