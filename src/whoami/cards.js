// Who Am I's deck: the office's own people, from the lobby's list, in a
// shuffled order. The TV shows the name; the guesser's team gives the clues.
import { parseSeed, pcg32, shuffled } from '../game/pcg'

// one stream per thing Who Am I draws (the quiz uses 1–3)
export const WSTREAM = { people: 13 }

export function deck(seed, players) {
  return shuffled(players.length, pcg32(parseSeed(seed), WSTREAM.people)).map((i) => ({ person: players[i], word: players[i] }))
}

// The room's three teams, by the guards' shapes
export const TEAMS = [
  { shape: 'o', name: 'Circle' },
  { shape: 't', name: 'Triangle' },
  { shape: 's', name: 'Square' },
]
