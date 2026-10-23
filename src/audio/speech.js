import { ac } from './sound.js'

// Chrome's Web Speech API, both ways: the doll reads aloud (speechSynthesis)
// and the mic hears the player's answer (SpeechRecognition). In Chrome the
// recognition audio goes to Google's speech service; nothing else leaves the page.

// ── the doll's voice ─────────────────────────
let voices = []
const loadVoices = () => { voices = speechSynthesis.getVoices() }
if (typeof speechSynthesis !== 'undefined') {
  loadVoices()
  speechSynthesis.addEventListener('voiceschanged', loadVoices)
}

// a girl's voice, pitched up and slowed down: Young-hee's sing-song
function dollVoice() {
  const en = voices.filter((v) => v.lang.startsWith('en'))
  return en.find((v) => v.name === 'Google UK English Female')
    ?? en.find((v) => /female|samantha|zira|aria|jenny/i.test(v.name))
    ?? en[0]
}

// Resolves when she has finished (or after a safety timeout: Chrome sometimes
// never fires onend).
export function speak(text, { pitch = 1.55, rate = 0.9 } = {}) {
  if (typeof speechSynthesis === 'undefined') return Promise.resolve()
  speechSynthesis.cancel()
  return new Promise((done) => {
    const u = new SpeechSynthesisUtterance(text)
    u.voice = dollVoice() ?? null
    u.pitch = pitch
    u.rate = rate
    u.onend = u.onerror = () => done()
    speechSynthesis.speak(u)
    setTimeout(done, 1500 + text.length * 110)
  })
}

let playing = null // the announcer's current stitched line
export const hush = () => {
  playing?.forEach((n) => { try { n.stop() } catch {} })
  playing = null
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}

// "063" is read "zero six three", as the guards call numbers
const DIGIT = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
export const sayNumber = (no) => no.split('').map((d) => DIGIT[d]).join(' ')

// ── the announcer: just numbers and verdicts ─
// Thirteen words recorded once with a Fish Audio voice (tools/split_voice.mjs
// cuts them into public/voice/parts/) and strung together per line:
// "player" "zero" "six" "three" "eliminated". If any word is missing, Chrome
// reads the whole line instead.
export const PARTS = ['player', ...DIGIT, 'eliminated', 'passed']
const WORDS = {
  call: (no) => ['player', ...no.split('').map((d) => DIGIT[d])],
  out: (no) => [...WORDS.call(no), 'eliminated'],
  pass: (no) => [...WORDS.call(no), 'passed'],
}
const LINES = {
  call: (no) => `Player ${sayNumber(no)}.`,
  out: (no) => `Player ${sayNumber(no)}, eliminated.`,
  pass: (no) => `Player ${sayNumber(no)}, passed.`,
}

// the parts, fetched and decoded once; null if they aren't all there
let parts
const loadParts = () => (parts ??= Promise.all(PARTS.map(async (w) => {
  const res = await fetch(`/voice/parts/${w}.mp3`)
  // the dev server answers a missing file with index.html
  if (!res.ok || !/audio|octet/.test(res.headers.get('content-type') ?? '')) throw new Error(w)
  return [w, await ac().decodeAudioData(await res.arrayBuffer())]
})).then(Object.fromEntries, () => null))

const GAP = { 0: 0.16 } // a longer breath after "player"; digits run on
const STEP = 0.05

// resolves when the line has been said
export async function announce(kind, no) {
  hush()
  const buf = await loadParts()
  if (!buf) return speak(LINES[kind](no))
  const c = ac()
  let t = c.currentTime + 0.05
  const words = WORDS[kind](no)
  // the verdict lands after a beat, like the PA: "Player zero six three … eliminated."
  const nodes = words.map((w, i) => {
    const n = c.createBufferSource()
    n.buffer = buf[w]
    n.connect(c.destination)
    n.start(t)
    t += buf[w].duration + (GAP[i] ?? (i === words.length - 2 && kind !== 'call' ? 0.3 : STEP))
    return n
  })
  playing = nodes
  return new Promise((done) => setTimeout(done, (t - c.currentTime) * 1000))
}

// ── the mic ──────────────────────────────────
const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
export const canListen = !!SR

// Listens until stopped, calling onText with everything heard so far: the
// running transcript plus each result's alternative guesses (more chances to
// catch the answer), `final`: the sentence that just finished, if one did, and
// `interim`: the sentence still being spoken.
// Chrome ends a session after a pause, so it restarts itself until stop() is called.
export function listen({ lang = 'en-IN', onText, onState }) {
  if (!SR) { onState?.('unsupported'); return () => {} }
  const rec = new SR()
  rec.lang = lang
  rec.continuous = true
  rec.interimResults = true
  rec.maxAlternatives = 3
  let on = true
  let finals = ''
  const alts = []

  rec.onstart = () => onState?.('listening')
  rec.onresult = (e) => {
    let interim = ''
    let final = null
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]
      if (r.isFinal) {
        final = r[0].transcript
        finals += r[0].transcript + ' '
        for (let k = 1; k < r.length; k++) alts.push(r[k].transcript)
      } else interim += r[0].transcript
    }
    const text = (finals + interim).trim()
    onText?.({ text, all: [text, ...alts], final, interim: interim.trim() })
  }
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { on = false; onState?.('denied') }
    else if (e.error === 'network') { on = false; onState?.('offline') }
  }
  rec.onend = () => {
    if (!on) return onState?.('off')
    setTimeout(() => { if (on) try { rec.start() } catch {} }, 120)
  }
  try { rec.start() } catch { onState?.('off') }

  return () => { on = false; try { rec.abort() } catch {} }
}
