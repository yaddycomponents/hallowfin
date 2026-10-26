import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from './game/useGame'
import { playerNo } from './game/data'
import { heardAnswer, saidSomething } from './game/match'
import { music, seekSong, sfx, sing, stopAllMusic, stopMusic } from './audio/sound'
import { announce, canListen, hush, listen } from './audio/speech'
import { Stage } from './scene/Stage'
import { tileShape } from './scene/NumberFloor'
import { Lobby } from './ui/Lobby'
import { useRemote } from './remote/useRemote'
import { GLYPH, NAMES } from './game/dalgona'
import { DalgonaPanel } from './ui/Dalgona'
import { ShapeBtn } from './ui/ShapeBtn'
import { Confetti } from './ui/Confetti'
import { Chooser } from './ui/Chooser'
import { WhoAmI } from './whoami/WhoAmI'
import { useWhoAmI } from './whoami/useWhoAmI'
import { TEAMS } from './whoami/cards'
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
  const who = useWhoAmI(g.config.players)
  // the draw is riding the song (the phone shows Stop the music)
  const [drawing, setDrawing] = useState(false)
  const { run, config, current } = g
  const phase = run.phase
  const demo = !!run.demo
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
    // the guards' theme under a dare (if public/audio/dare.mp3 is there)
    if (phase === 'dare') music('dare', 0.35, { restart: true })
    else stopMusic('dare', 700)
  }, [phase])

  // M: the host stops the music (the song after a draw, the dare's theme, …)
  useEffect(() => {
    const k = (e) => {
      if (e.key !== 'm' || e.repeat || e.target.closest?.('input, textarea')) return
      stopAllMusic()
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [])

  // the player has the mic: the host gives them a question (Space), or a
  // dalgona to carve (D)
  const begin = (kind = 'question') => g.to(kind)
  // dalgona: the song stops, the candy's own theme plays while they carve
  useEffect(() => {
    if (phase !== 'dalgona') return
    stopMusic('lobby', 400)
    music('dalgona', 0.4, { restart: true })
    return () => stopMusic('dalgona', 700)
  }, [phase])

  // a name is called: she announces it, then the game waits while the player
  // walks up and takes the mic; the host starts the question (Space or ▶)
  useEffect(() => {
    if (phase !== 'picked') return
    // under the call and their walk up: a low, tense theme (public/audio/
    // called.mp3, if it's there), quiet so her voice carries; it fades as
    // their turn starts, or the host stops it (M, or the phone)
    music('called', 0.3, { restart: true })
    say('call', no)
    const k = (e) => {
      if (e.repeat || e.target.closest?.('input, textarea')) return
      if (e.code === 'Space') { e.preventDefault(); begin('question') }
      if (e.key === 'd') begin('dalgona')
    }
    addEventListener('keydown', k)
    return () => { removeEventListener('keydown', k); stopMusic('called', 700) }
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
    if (phaseRef.current !== 'question' && phaseRef.current !== 'redlight' && phaseRef.current !== 'dalgona') return
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
        // a demo: whatever they say, the doll takes it
        if (demo ? saidSomething(text) : heardAnswer(answer, all)) {
          hit = true
          setStage('matched')
          wait(900).then(() => onVerdict('answered'))
        }
      },
    })
    return () => { stop(); setMic('off') }
  }, [phase, stage, config.mic, config.hard, config.lang, current.question, onVerdict, demo])

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

  const warmMic = () => {
    if (config.mic && canListen) navigator.mediaDevices?.getUserMedia({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop()), () => {})
  }
  const start = (seed) => {
    sfx.unlock()
    // ask for the mic now, not halfway through the first question
    warmMic()
    // a new game's first draw rides in from the song's opening, wherever a
    // demo or the last game left it
    seekSong('lobby', 0)
    g.start(seed)
  }
  // the game chooser, and Who Am I, sit outside the quiz's own phases
  const inGame = !['lobby', 'choose', 'whoami'].includes(phase)
  // back in Who Am I with no game kept (an old save was dropped): a fresh one
  useEffect(() => { if (phase === 'whoami' && !who.w) who.again() }, [phase, who.w])
  const choose = (game) => {
    if (game === 'squid') return start(run.chosenSeed)
    sfx.unlock()
    who.again()
    g.to('whoami')
  }

  // the phone remote: what it shows. Who's up only once they're called (the
  // draw is decided before the spin; the phone mustn't spoil it)
  const called = inGame && !['pick', 'end'].includes(phase)
  const wstep = who.w?.step
  const remote = useRemote(phase === 'whoami' && who.w ? {
    phase: `w-${wstep}`,
    team: `${TEAMS[who.team].name}`,
    shape: TEAMS[who.team].shape,
    scores: who.w.scores,
    card: wstep === 'play' && who.card ? who.card.word : '',
    got: who.w.got.length,
  } : {
    phase,
    demo,
    spinning: phase === 'pick' && drawing,
    no: called ? no : '',
    name: called ? current.player : '',
    question: !called ? '' : phase === 'dalgona' ? `Dalgona: ${GLYPH[current.shape]} ${NAMES[current.shape]} (they carve it on their phone)` : current.question?.q,
    answer: called && phase !== 'dalgona' ? current.question?.a : '',
    dare: phase === 'eliminated' || phase === 'dare' ? current.dare : '',
    remaining: g.remaining.length,
    total: config.players.length,
  })

  // a phone has the controls: the on-screen buttons step aside (keys still work)
  useEffect(() => { document.body.classList.toggle('remote-on', remote.phones > 0) }, [remote.phones])

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
      {phase === 'choose' && <Chooser onChoose={choose} onLobby={g.lobby} />}
      {phase === 'whoami' && <WhoAmI g={who} onLobby={g.lobby} remote={remote} />}
      {phase === 'lobby' && (
        <Lobby
          config={g.setup}
          setConfig={g.setConfig}
          onStart={(seed) => g.to('choose', { chosenSeed: seed })}
          remote={remote}
          onDemo={() => { sfx.unlock(); warmMic(); seekSong('lobby', 0); g.demo() }}
          canResume={run.log.length > 0 && run.turn < config.players.length}
          onResume={() => { sfx.unlock(); g.resume() }}
        />
      )}
      {inGame && phase !== 'end' && <Hud run={run} remaining={g.remaining.length} total={config.players.length} prize={g.won} onLobby={g.lobby} remote={remote} config={config} setConfig={g.setConfig} listening={phase === 'question' && stage === 'clock' && config.mic && canListen} />}
      {(phase === 'pick' || phase === 'picked') && (
        <PickPanel onRunning={setDrawing} remaining={g.remaining} target={current.playerIndex} phase={phase} auto={run.auto} onLanded={() => setTimeout(() => g.to('picked'), 1100)} />
      )}
      {phase === 'picked' && <Called name={current.player} shape={tileShape(config.players.length, current.playerIndex)} />}
      {phase === 'picked' && <ShapeBtn shape="next" label="Start the question" keyName="Space" className="next-slot" onClick={() => begin('question')} />}
      {phase === 'picked' && <button className="dalgona-btn" onClick={() => begin('dalgona')} data-tip="Carve a dalgona instead · D">달고나 <kbd>D</kbd></button>}
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
      {phase === 'dalgona' && (
        <DalgonaPanel key={run.turn} shape={current.shape} player={current.player} no={no} remote={remote} onVerdict={onVerdict} />
      )}
      {phase === 'survived' && (
        <>
          <Confetti key={run.turn} />
          <Stamp kind="survived" />
          <ShapeBtn shape="next" className="next-slot" label="Next player" keyName="Space" onClick={() => { hush(); g.next() }} />
        </>
      )}
      {(phase === 'eliminated' || phase === 'dare') && (
        <>
          <Stamp kind="eliminated" small={phase === 'dare'} />
          {!run.log.at(-1)?.dalgona && current.question?.a && (
            <div className="reveal"><span>The answer was</span><b>{current.question.a.split(/\s*\/\s*/).join(' · ')}</b></div>
          )}
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
      {phase === 'end' && <End log={run.log} onLobby={g.lobby} onAgain={() => (demo ? (seekSong('lobby', 0), g.demo()) : start())} />}
    </>
  )
}
