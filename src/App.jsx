import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from './game/useGame'
import { music, sfx, stopMusic } from './audio/sound'
import { Stage } from './scene/Stage'
import { Lobby } from './ui/Lobby'
import { Called, DarePanel, End, Hud, PickPanel, QuestionPanel, Stamp } from './ui/Panels'

export default function App() {
  const g = useGame()
  const { run, config, current } = g
  const phase = run.phase
  const [left, setLeft] = useState(config.seconds)
  const beat = useRef(-1)

  // music per phase: the lobby tune while picking, the doll's song while the clock runs
  useEffect(() => {
    if (phase === 'question') { stopMusic('lobby', 400); music('redlight', 0.7, { restart: true }) }
    else if (phase === 'redlight') { stopMusic('redlight', 150) }
    else if (phase === 'pick' || phase === 'lobby' || phase === 'end') { stopMusic('redlight'); music('lobby', 0.45) }
  }, [phase])

  // a name is called: hold on it, then green light
  useEffect(() => {
    if (phase !== 'picked') return
    const t = setTimeout(() => g.to('question'), 2200)
    return () => clearTimeout(t)
  }, [phase, g.to])

  // the question clock; a heartbeat in the last five seconds; red light at zero
  useEffect(() => {
    if (phase !== 'question') return
    const end = performance.now() + config.seconds * 1000
    setLeft(config.seconds)
    beat.current = -1
    const id = setInterval(() => {
      const s = Math.max(0, (end - performance.now()) / 1000)
      setLeft(s)
      const whole = Math.ceil(s)
      if (whole <= 5 && whole > 0 && whole !== beat.current) { beat.current = whole; sfx.heart() }
      if (s === 0) { clearInterval(id); sfx.turn(); g.to('redlight') }
    }, 50)
    return () => clearInterval(id)
  }, [phase, config.seconds, g.to])

  const onVerdict = useCallback((r) => {
    if (r === 'failed') sfx.eliminated()
    else sfx.survived()
    stopMusic('redlight', 200)
    g.verdict(r)
  }, [g.verdict])

  // Space moves on after a verdict
  useEffect(() => {
    if (phase !== 'survived' && phase !== 'dare') return
    const k = (e) => { if (e.code === 'Space') { e.preventDefault(); g.next() } }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [phase, g.next])

  const start = (seed) => { sfx.unlock(); g.start(seed) }
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
          onResume={() => { sfx.unlock(); g.to('pick') }}
        />
      )}
      {inGame && phase !== 'end' && <Hud run={run} remaining={g.remaining.length} total={config.players.length} prize={g.won} onLobby={g.lobby} />}
      {(phase === 'pick' || phase === 'picked') && (
        <PickPanel remaining={g.remaining} target={current.playerIndex} phase={phase} onLanded={() => g.to('picked')} />
      )}
      {phase === 'picked' && <Called name={current.player} />}
      {(phase === 'question' || phase === 'redlight') && current.question && (
        <QuestionPanel key={run.turn} question={current.question} player={current.player} seconds={config.seconds} left={left} phase={phase} onVerdict={onVerdict} />
      )}
      {phase === 'survived' && (
        <>
          <Stamp kind="survived" />
          <button className="primary big next" onClick={g.next}>Next player <kbd>Space</kbd></button>
        </>
      )}
      {(phase === 'eliminated' || phase === 'dare') && (
        <>
          <Stamp kind="eliminated" small={phase === 'dare'} />
          <DarePanel dares={config.dares} target={current.dareIndex} phase={phase} onLanded={() => g.to('dare')} onNext={g.next} />
        </>
      )}
      {phase === 'end' && <End log={run.log} onLobby={g.lobby} onAgain={() => start()} />}
    </>
  )
}
