// Players, questions and dares: seeded here, editable in the lobby, kept in
// this browser's localStorage. Nothing leaves the machine — no backend.

export const DEFAULTS = {
  players: ['Player One', 'Player Two', 'Player Three', 'Player Four', 'Player Five', 'Player Six'],
  // "question | answer": the answer is only shown to the host on demand
  questions: [
    'In which country did Halloween originate? | Ireland (the Celtic festival of Samhain)',
    'What were jack-o\'-lanterns first carved from? | Turnips',
    'What is the fear of Halloween called? | Samhainophobia',
    'Which horror villain says "Do you want to play a game?" | Jigsaw (Saw)',
    'What is the name of the doll in Squid Game\'s first game? | Young-hee',
    'How many players start Squid Game season 1? | 456',
    'What prize money is the season 1 winner promised? | ₩45.6 billion',
    'Which shape did Gi-hun get in the honeycomb game? | The umbrella',
    'Name the four shapes on the honeycomb candy. | Circle, triangle, star, umbrella',
    'What is Bram Stoker\'s most famous novel? | Dracula',
    'Who wrote Frankenstein? | Mary Shelley',
    'Which film has the line "Here\'s Johnny!"? | The Shining',
    'What colour is the Ghostbusters\' slime in Ghostbusters II? | Pink',
    'In Stranger Things, what is the parallel dimension called? | The Upside Down',
    'What does Wednesday Addams\' disembodied hand go by? | Thing',
    'Which month has the most full-moon horror films set in it? Trick question — name any werewolf film. | Any: An American Werewolf in London, The Wolfman, Teen Wolf…',
    'How many hearts does an octopus have? | Three',
    'What is the most popular Halloween candy in the US? | Reese\'s Peanut Butter Cups',
    'What is a group of crows called? | A murder',
    'Spell "Halloween" backwards in under 5 seconds. | neewollaH',
  ],
  dares: [
    'Eat one extra-sour candy — no water for 30 seconds',
    'Drink a shot of lemon squeeze',
    'Eat a sour candy AND keep a straight face for 10 seconds',
    'Lemon slice, bite it, smile for the photo',
    'Do your best Young-hee "Red light, green light" chant',
    'Speak only in a whisper until your next turn',
    'Two sour candies at once',
    'Let the person on your left pick your next sour candy',
  ],
  seconds: 20,
  mic: true, // players answer out loud (Chrome speech recognition)
  voice: true, // the doll reads questions and calls players
  lang: 'en-IN', // recogniser accent
}

const KEY = 'halloween-dare:v1'

export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    if (s && Array.isArray(s.players)) return { ...DEFAULTS, ...s }
  } catch {}
  return DEFAULTS
}

export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch {}
}

// A dropped .md file:
//   # Players / ## Questions / ## Dares headings, one item per line (bullets
//   or numbers optional). A file with no headings is read as a list of names.
export function parseMd(text) {
  const out = { players: [], questions: [], dares: [] }
  let section = 'players'
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('<!--')) continue
    const h = line.match(/^#{1,6}\s*(.+)$/)
    if (h) {
      const t = h[1].toLowerCase()
      section = /quest|trivia|quiz/.test(t) ? 'questions'
        : /dare|penalt|punish/.test(t) ? 'dares'
        : /player|name|people|team|member/.test(t) ? 'players'
        : null // an unknown heading: skip its lines
      continue
    }
    if (!section) continue
    const item = line.replace(/^([-*+]|\d+[.)])\s+/, '').replace(/^\[[ x]\]\s*/i, '').trim()
    if (item) out[section].push(item)
  }
  return out
}

export const TEMPLATE = `# Players
- Full Name One
- Full Name Two

# Questions
- What is the fear of Halloween called? | Samhainophobia
- Who wrote Frankenstein? | Mary Shelley

# Dares
- Eat one extra-sour candy
- Drink a shot of lemon squeeze
`

export const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean)

export function splitQuestion(q) {
  const i = q.indexOf(' | ')
  return i < 0 ? { q, a: null } : { q: q.slice(0, i), a: q.slice(i + 3) }
}

// Every name gets a stable 3-digit player number, like the tracksuits
export function playerNo(name) {
  let h = 7
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return String((h % 456) + 1).padStart(3, '0')
}

