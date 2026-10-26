import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEMO, load, playing, save, setRoster, splitQuestion } from './data'
import { STREAM, drawIndex, newSeed } from './pcg'
import { SHAPES, dalgonaAt } from './dalgona'

// trying a candy out: ?shape=octopus makes every dalgona that shape
const TRY = typeof location === 'undefined' ? null : SHAPES.find((s) => s === new URLSearchParams(location.search).get('shape')) ?? null

// The round, as phases:
//   lobby → pick (reel spins) → picked (name shown) → question (green light,
//   timer running) → redlight (time's up) → survived | eliminated → dare → pick …
//   → end (everyone has been called)
// Every draw comes from the seed (see pcg.js), and the run is saved after each
// step, so a reload resumes the same game.
const RUN_KEY = 'halloween-dare:run'
const PRIZE = 100_000_000

const fresh = () => ({ phase: 'lobby', seed: newSeed(), turn: 0, qTurn: 0, dTurn: 0, log: [] })

function loadRun() {
  try {
    const r = JSON.parse(sessionStorage.getItem(RUN_KEY))
    // the game chooser is a doorway, not a place: a reload there is back in the lobby
    return r?.phase === 'choose' ? { ...r, phase: 'lobby' } : r
  } catch { return null }
}

export function useGame() {
  // setup: the lobby's lists as edited; config: what this game plays with
  const [setup, setConfig] = useState(load)
  const [run, setRun] = useState(() => loadRun() ?? fresh())
  // the real game, kept aside while a demo runs
  const real = useRef(null)

  useEffect(() => save(setup), [setup])
  // a demo is never saved: a reload mid-demo is back in the real game
  useEffect(() => { if (!run.demo) try { sessionStorage.setItem(RUN_KEY, JSON.stringify(run)) } catch {} }, [run])

  const config = useMemo(
    () => (run.demo ? { ...setup, ...DEMO, hard: false } : { ...setup, players: setup.players.filter(playing) }),
    [setup, run.demo],
  )
  const { players, questions, dares } = config
  setRoster(players) // cheap; keeps player numbers unique for this list
  const n = players.length

  // who is called on this turn, and which question and dare they'd get
  const current = useMemo(() => {
    const p = drawIndex(run.seed, STREAM.players, n, run.turn)
    const q = drawIndex(run.seed, STREAM.questions, questions.length, run.qTurn)
    const d = drawIndex(run.seed, STREAM.dares, dares.length, run.dTurn)
    return {
      playerIndex: p,
      player: players[p],
      // the candy, if the host makes this turn a dalgona (the demo's is the
      // easy triangle, to show how it works)
      shape: TRY ?? (run.demo ? 'triangle' : dalgonaAt(run.seed, run.turn)),
      question: q < 0 ? null : splitQuestion(questions[q]),
      dareIndex: d,
      dare: dares[d],
    }
  }, [run.seed, run.turn, run.qTurn, run.dTurn, run.demo, players, questions, dares, n])

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
    setRun({ phase: 'pick', seed: seed || newSeed(), turn: 0, qTurn: 0, dTurn: 0, log: [], auto: false })
  }, [])

  const verdict = useCallback((result) => {
    setRun((r) => ({
      ...r,
      phase: result === 'failed' ? 'eliminated' : 'survived',
      log: [...r.log, { playerIndex: current.playerIndex, name: current.player, question: r.phase === 'dalgona' ? `Dalgona: ${current.shape}` : current.question?.q, dalgona: r.phase === 'dalgona', result, dare: result === 'failed' ? current.dare : null }],
    }))
  }, [current])

  // after a verdict: the next turn (a new question; a new dare if they failed)
  const advance = (r) => {
    const last = r.log[r.log.length - 1]
    const turn = r.turn + 1
    return {
      ...r,
      turn,
      qTurn: last?.dalgona ? r.qTurn : r.qTurn + 1, // a dalgona turn used no question
      dTurn: last?.result === 'failed' ? r.dTurn + 1 : r.dTurn,
      phase: turn >= n ? 'end' : 'pick',
      auto: true, // the next draw spins by itself
    }
  }
  const next = useCallback(() => setRun(advance), [n])

  // the called player isn't in today: note it and draw again. No question or
  // dare is used up, and they won't be drawn again this game.
  const absent = useCallback(() => setRun((r) => {
    if (r.log.length > r.turn) return r // a verdict is already in
    const turn = r.turn + 1
    return {
      ...r,
      turn,
      log: [...r.log, { playerIndex: current.playerIndex, name: current.player, result: 'absent' }],
      phase: turn >= n ? 'end' : 'pick',
      auto: true,
    }
  }), [current, n])

  // back from the lobby: if this turn's verdict is already in (they left before
  // pressing next), move on, or the same player would be drawn again
  // (no auto spin when coming back from the lobby: the host may still be setting up)
  const resume = useCallback(() => setRun((r) => ({ ...(r.log.length > r.turn ? advance(r) : r), phase: r.log.length > r.turn && r.turn + 1 >= n ? 'end' : 'pick', auto: false })), [n])

  // the demo: a practice game on the demo cast; the lobby brings the real one back
  const demo = useCallback(() => setRun((r) => {
    if (!r.demo) real.current = r
    return { phase: 'pick', seed: newSeed(), turn: 0, qTurn: 0, dTurn: 0, log: [], auto: false, demo: true }
  }), [])
  const lobby = useCallback(() => setRun((r) => ({ ...(r.demo ? real.current ?? fresh() : r), phase: 'lobby' })), [])

  return { config, setup, setConfig, run, current, remaining, eliminated, won, to, start, verdict, next, absent, resume, demo, lobby }
}
