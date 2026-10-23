import { useCallback, useEffect, useMemo, useState } from 'react'
import { load, save, splitQuestion } from './data'
import { STREAM, drawIndex, newSeed } from './pcg'

// The round, as phases:
//   lobby → pick (reel spins) → picked (name shown) → question (green light,
//   timer running) → redlight (time's up) → survived | eliminated → dare → pick …
//   → end (everyone has been called)
// Every draw comes from the seed (see pcg.js), and the run is saved after each
// step, so a reload resumes the same game.
const RUN_KEY = 'halloween-dare:run'
const PRIZE = 100_000_000

function loadRun() {
  try { return JSON.parse(localStorage.getItem(RUN_KEY)) } catch { return null }
}

export function useGame() {
  const [config, setConfig] = useState(load)
  const [run, setRun] = useState(() => loadRun() ?? { phase: 'lobby', seed: newSeed(), turn: 0, qTurn: 0, dTurn: 0, log: [] })

  useEffect(() => save(config), [config])
  useEffect(() => { try { localStorage.setItem(RUN_KEY, JSON.stringify(run)) } catch {} }, [run])

  const { players, questions, dares } = config
  const n = players.length

  // who is called on this turn, and which question and dare they'd get
  const current = useMemo(() => {
    const p = drawIndex(run.seed, STREAM.players, n, run.turn)
    const q = drawIndex(run.seed, STREAM.questions, questions.length, run.qTurn)
    const d = drawIndex(run.seed, STREAM.dares, dares.length, run.dTurn)
    return {
      playerIndex: p,
      player: players[p],
      question: q < 0 ? null : splitQuestion(questions[q]),
      dareIndex: d,
      dare: dares[d],
    }
  }, [run.seed, run.turn, run.qTurn, run.dTurn, players, questions, dares, n])

  // players not called yet, in the lobby's order (the reel shows these, so it
  // never reveals the shuffled order)
  const remaining = useMemo(() => {
    const called = new Set(run.log.map((e) => e.playerIndex))
    return players.map((name, i) => ({ name, i })).filter((p) => !called.has(p.i))
  }, [players, run.log])

  const eliminated = run.log.filter((e) => e.result === 'failed').length
  const won = eliminated * PRIZE

  const to = useCallback((phase, patch) => setRun((r) => ({ ...r, ...patch, phase })), [])

  const start = useCallback((seed) => {
    setRun({ phase: 'pick', seed: seed || newSeed(), turn: 0, qTurn: 0, dTurn: 0, log: [] })
  }, [])

  const verdict = useCallback((result) => {
    setRun((r) => ({
      ...r,
      phase: result === 'failed' ? 'eliminated' : 'survived',
      log: [...r.log, { playerIndex: current.playerIndex, name: current.player, question: current.question?.q, result, dare: result === 'failed' ? current.dare : null }],
    }))
  }, [current])

  const next = useCallback(() => {
    setRun((r) => {
      const last = r.log[r.log.length - 1]
      const turn = r.turn + 1
      return {
        ...r,
        turn,
        qTurn: r.qTurn + 1,
        dTurn: last?.result === 'failed' ? r.dTurn + 1 : r.dTurn,
        phase: turn >= n ? 'end' : 'pick',
      }
    })
  }, [n])

  return { config, setConfig, run, current, remaining, eliminated, won, to, start, verdict, next, lobby: () => to('lobby') }
}
