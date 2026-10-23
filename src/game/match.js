// Does what the player said contain the answer? Speech never comes back
// exact ("um, it's Ireland I think"), so each accepted answer (split on " / ")
// counts as heard when every one of its key words turns up in the transcript,
// allowing small recogniser misspellings and "3" for "three".

const STOP = new Set(['the', 'a', 'an', 'of', 'is', 'it', 'its', 'it\'s', 'and', 'i', 'think', 'um', 'uh', 'er', 'like', 'maybe', 'answer', 'was', 'that'])

const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']

function words(s) {
  return s
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, ' ') // "(the Celtic festival)" in an answer is a note, not required
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .map((w) => (NUM.includes(w) ? String(NUM.indexOf(w)) : w))
    .filter((w) => w && !STOP.has(w))
}

function lev(a, b) {
  if (a === b) return 0
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]
}

// how many letters can be off: none for short words, more for long ones
const slack = (w) => (w.length >= 9 ? 2 : w.length >= 6 ? 1 : 0)

const near = (want, got) => got.some((g) => lev(want, g) <= slack(want) || (want.length >= 6 && g.startsWith(want.slice(0, -1))))
// hard mode: the word itself, spelled the way the recogniser spells it
const exact = (want, got) => got.includes(want)

// did they say anything at all (not just "um", a cough, "the")?
export const saidSomething = (text) => words(text).length > 0

export function alternatives(answer) {
  return answer.split(/\s+\/\s+|;/).map((a) => a.trim()).filter(Boolean)
}

// transcripts: what the recogniser heard (its best guess and alternatives).
// strict: no spelling slack (hard mode)
export function heardAnswer(answer, transcripts, { strict = false } = {}) {
  if (!answer) return false
  const close = strict ? exact : near
  const heard = transcripts.flatMap((t) => words(t))
  // also allow two spoken words run together ("upside down" → "upsidedown")
  const pairs = heard.slice(1).map((w, i) => heard[i] + w)
  const got = [...heard, ...pairs]
  return alternatives(answer).some((alt) => {
    const need = words(alt)
    // "Young-hee" may come back as one word: "younghee"
    return need.length > 0 && (need.every((w) => close(w, got)) || (need.length > 1 && close(need.join(''), got)))
  })
}
