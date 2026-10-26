// Who Am I, as steps:
//   rules → called (team ○ sends a player, who turns their back) → play
//   (60 s of names) → score → called (the next team) … → final
// The teams are the room's own: the game only keeps their scores. The deck
// comes from the seed, and the game is kept in this tab's sessionStorage, so
// a reload carries on.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { newSeed } from '../game/pcg'
import { deck } from './cards'

const KEY = 'halloween-dare:whoami'
export const SECONDS = 60
export const ROUNDS = 3 // turns per team

const fresh = () => ({
  seed: newSeed(),
  step: 'rules',
  turn: 0, // turn t is team t % 3's
  scores: [0, 0, 0],
  card: 0, // the next card in the deck
  got: [], // this turn's cards
  skipped: [],
  log: [], // every turn: { team, got, skipped }
})

function load() {
  try {
    const w = JSON.parse(sessionStorage.getItem(KEY))
    // a save from before the teams were the room's own: start it over
    return w && ['teams', 'call'].includes(w.step) ? null : w
  } catch { return null }
}

export function useWhoAmI(players) {
  const [w, setW] = useState(() => load())
  useEffect(() => { try { w ? sessionStorage.setItem(KEY, JSON.stringify(w)) : sessionStorage.removeItem(KEY) } catch {} }, [w])

  const seed = w?.seed
  const cards = useMemo(() => (seed ? deck(seed, players) : []), [seed, players])
  const team = w ? w.turn % 3 : 0
  const turns = ROUNDS * 3

  const card = w && cards.length ? cards[w.card % cards.length] : null

  // a new game: picking Who Am I always starts one, from the rules (only a
  // reload carries on the game in progress, from the save)
  const again = useCallback(() => setW(fresh()), [])

  const to = useCallback((step) => setW((cur) => ({ ...cur, step })), [])

  const play = useCallback(() => setW((cur) => ({ ...cur, step: 'play', got: [], skipped: [] })), [])

  // a card: got it (a point) or skipped (no cost); the next card either way
  const mark = useCallback((ok) => setW((cur) => {
    if (cur.step !== 'play' || !cards.length) return cur
    const i = cur.card % cards.length
    const c = cards[i]
    return {
      ...cur,
      card: (i + 1) % cards.length,
      got: ok ? [...cur.got, c] : cur.got,
      skipped: ok ? cur.skipped : [...cur.skipped, c],
    }
  }), [cards])

  // the clock ran out (or the host ended it)
  const done = useCallback(() => setW((cur) => {
    if (cur.step !== 'play') return cur
    const t = cur.turn % 3
    return {
      ...cur,
      step: 'score',
      scores: cur.scores.map((s, k) => (k === t ? s + cur.got.length : s)),
      log: [...cur.log, { team: t, got: cur.got, skipped: cur.skipped }],
    }
  }), [])

  const next = useCallback(() => setW((cur) => {
    const turn = cur.turn + 1
    return { ...cur, turn, step: turn >= turns ? 'final' : 'called' }
  }), [turns])

  return { w, team, turns, card, again, to, play, mark, done, next }
}
