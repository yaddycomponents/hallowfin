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

export const hush = () => typeof speechSynthesis !== 'undefined' && speechSynthesis.cancel()

// "063" is read "zero six three", as the guards call numbers
export const sayNumber = (no) => no.split('').join(' ')

// ── the mic ──────────────────────────────────
const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
export const canListen = !!SR

// Listens until stopped, calling onText with everything heard so far: the
// running transcript plus each result's alternative guesses (more chances to
// catch the answer). Chrome ends a session after a pause, so it restarts
// itself until stop() is called.
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
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]
      if (r.isFinal) {
        finals += r[0].transcript + ' '
        for (let k = 1; k < r.length; k++) alts.push(r[k].transcript)
      } else interim += r[0].transcript
    }
    const text = (finals + interim).trim()
    onText?.({ text, all: [text, ...alts] })
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
