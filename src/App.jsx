import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from './game/useGame'
import { playerNo } from './game/data'
import { heardAnswer, saidSomething } from './game/match'
import { music, sfx, sing, stopMusic } from './audio/sound'
import { announce, canListen, hush, listen } from './audio/speech'
import { Stage } from './scene/Stage'
import { tileShape } from './scene/NumberFloor'
import { Lobby } from './ui/Lobby'
import { ShapeBtn } from './ui/ShapeBtn'
import { IconBtn } from './ui/IconBtn'
import { UserX } from 'lucide-react'
import { Called, End, Hud, PenaltyCard, PickPanel, QuestionPanel, Stamp } from './ui/Panels'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const words = (t) => t.trim().split(/\s+/).filter(Boolean).length
// red light: how long the host has to spare a player before the guard fires
const GRACE = 4

// One chant of "Mugunghwa kkochi pieotseumnida", like the show: a quick one, a
// normal one, or a slow tease, and now and then cut short so she spins early.
// The file's last syllable ends at 4.6 s.
const CHANT_END = 4.6
function chant() {
  const m = Math.random()
  const rate = m < 0.4 ? 1.45 + Math.random() * 0.45 // fast
    : m < 0.8 ? 1.05 + Math.random() * 0.25 // normal
    : 0.85 + Math.random() * 0.1 // slow tease
  const until = Math.random() < 0.2 ? CHANT_END * (0.55 + Math.random() * 0.3) : CHANT_END
  return { rate, until }
}

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
  // red light, green light inside a question: she sings (talk), then turns (silence)
  const [watching, setWatching] = useState(false)
  const armed = useRef(false) // she has turned and settled: a word now eliminates
  const heardSoFar = useRef('') // the mic's whole transcript, to spot new words at red light
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  // the announcer only calls numbers and verdicts; questions are read off the screen
  const say = useCallback((kind, n) => (config.voice ? announce(kind, n) : Promise.resolve()), [config.voice])
  const no = current.player ? playerNo(current.player) : ''

  // music per phase: the lobby tune while picking; the doll's song starts once she has read the question
  useEffect(() => {
    if (phase === 'redlight') stopMusic('redlight', 150)
    // (the draw starts its own: the song plays from the moment SPIN is pressed)
    // the opening: "Way Back Then" under the invitation card and the lobby
    else if (phase === 'lobby') { stopMusic('redlight'); stopMusic('lobby', 400); music('intro', 0.5) }
    else if (phase === 'end') { stopMusic('redlight'); music('lobby', 0.45) }
    else if (phase === 'pick') { stopMusic('redlight'); stopMusic('lobby', 500); stopMusic('intro', 900) }
    if (phase === 'lobby') hush()
  }, [phase])

  // a name is called: she announces it, then the game waits while the player
  // walks up and takes the mic; the host starts the question (Space or ▶)
  useEffect(() => {
    if (phase !== 'picked') return
    // the song stops on the draw, so the call carries in a quiet room
    stopMusic('lobby', 500)
    say('call', no)
    const k = (e) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); g.to('question') } }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
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

  // the rounds: she sings with her back turned (green: talk), the song ends and
  // she turns (red: not a word), then turns back and sings again. Random song
  // speed and red length, so nobody can count her turn.
  useEffect(() => {
    if (phase !== 'question' || stage !== 'clock') { setWatching(false); armed.current = false; return }
    let live = true
    let song
    ;(async () => {
      while (live) {
        setWatching(false)
        armed.current = false
        // her head is back round before she starts again
        await wait(350)
        if (!live) return
        // quiet enough that the mic hears the player over the speakers
        const { rate, until } = chant()
        song = sing('redlight', rate, config.mic && canListen ? 0.35 : 0.8, until)
        await song.done
        if (!live) return
        setWatching(true)
        sfx.turn()
        // her head is still turning, and the recogniser lags: words already said aren't new
        await wait(600)
        if (!live) return
        heardSoFar.base = words(heardSoFar.current)
        armed.current = true
        await wait(1500 + Math.random() * 2500)
      }
    })()
    return () => { live = false; song?.stop(); armed.current = false }
  }, [phase, stage, config.mic])

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
        heardSoFar.current = text
        if (armed.current) {
          // red light: any new word and they're out
          if (words(text) > heardSoFar.base) {
            hit = true
            setHeard(interim || final || text)
            setStage('moved')
            wait(800).then(() => onVerdict('failed'))
          }
          return
        }
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

  // not here today: while they're being called (before they take the mic),
  // N (or the button) skips them
  const canSkip = phase === 'picked'
  const skip = () => { hush(); g.absent() }
  useEffect(() => {
    if (!canSkip) return
    const k = (e) => { if (e.key === 'n' && !e.repeat) { e.preventDefault(); skip() } }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [canSkip, g.absent])

  const start = (seed) => {
    sfx.unlock()
    // ask for the mic now, not halfway through the first question
    if (config.mic && canListen) navigator.mediaDevices?.getUserMedia({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop()), () => {})
    g.start(seed)
  }
  const inGame = phase !== 'lobby'

  // the player wall: every name's number, its result so far, and who's on the
  // spot (never revealed before the reel lands)
  const roster = useMemo(() => {
    const status = {}
    run.log.forEach((e) => { status[e.playerIndex] = e.result })
    return {
      names: config.players,
      numbers: config.players.map(playerNo),
      status,
      current: phase === 'pick' || phase === 'lobby' || phase === 'end' ? -1 : current.playerIndex,
    }
  }, [config.players, run.log, phase, current.playerIndex])

  return (
    <>
      <Stage phase={phase} watching={watching} roster={roster} />
      {phase === 'lobby' && (
        <Lobby
          config={config}
          setConfig={g.setConfig}
          onStart={start}
          canResume={run.log.length > 0 && run.turn < config.players.length}
          onResume={() => { sfx.unlock(); g.resume() }}
        />
      )}
      {inGame && phase !== 'end' && <Hud run={run} remaining={g.remaining.length} total={config.players.length} prize={g.won} onLobby={g.lobby} config={config} setConfig={g.setConfig} listening={phase === 'question' && stage === 'clock' && config.mic && canListen} />}
      {(phase === 'pick' || phase === 'picked') && (
        <PickPanel remaining={g.remaining} target={current.playerIndex} phase={phase} auto={run.auto} onLanded={() => setTimeout(() => g.to('picked'), 1100)} />
      )}
      {phase === 'picked' && <Called name={current.player} shape={tileShape(config.players.length, current.playerIndex)} />}
      {phase === 'picked' && <ShapeBtn shape="next" label="Start the question" keyName="Space" className="next-slot" onClick={() => g.to('question')} />}
      {canSkip && <IconBtn icon={UserX} label="Not here today · respin (N)" className="absent-btn" onClick={skip} />}
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
          watching={watching}
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
