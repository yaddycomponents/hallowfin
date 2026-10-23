// Cut one Fish Audio take into the announcer's 13 words. In Fish's Text To
// Speech page, generate this text in one go (one word per line) and download it:
//
//   Player.
//   Zero.
//   One.
//   …
//   Nine.
//   Eliminated.
//   Passed.
//
//   node tools/split_voice.mjs ~/Downloads/take.mp3
//
// It finds the pauses between words with ffmpeg's silencedetect and writes
// public/voice/parts/<word>.mp3. The game strings those together:
// "player" "zero" "six" "three" "eliminated".
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { PARTS } from '../src/audio/speech.js'

const src = process.argv[2]
const noise = process.argv[3] ?? '-38dB' // quieter than this counts as a pause
if (!src || !fs.existsSync(src)) {
  console.error('usage: node tools/split_voice.mjs <take.mp3> [silence threshold, e.g. -38dB]')
  process.exit(1)
}

// silencedetect prints silence_start / silence_end pairs to stderr
const { stderr: log } = spawnSync('ffmpeg', ['-hide_banner', '-i', src, '-af', `silencedetect=noise=${noise}:d=0.18`, '-f', 'null', '-'], { encoding: 'utf8' })

const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1])
const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1])
const duration = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], { encoding: 'utf8' })

// speech runs between the end of one silence and the start of the next
const words = []
let from = 0
// leading silence before the first word
if (starts[0] < 0.05) { starts.shift(); from = ends.shift() ?? 0 }
for (let i = 0; i <= starts.length; i++) {
  const to = starts[i] ?? duration
  if (to - from > 0.12) words.push([from, to])
  from = ends[i] ?? duration
}

if (words.length !== PARTS.length) {
  console.error(`found ${words.length} words, expected ${PARTS.length} (${PARTS.join(', ')}):`)
  words.forEach(([a, b], i) => console.error(`  ${i + 1}. ${a.toFixed(2)}–${b.toFixed(2)}s`))
  console.error('Try a different threshold (e.g. -32dB if words run together, -45dB if they split), or regenerate with longer pauses.')
  process.exit(1)
}

const out = path.resolve(import.meta.dirname, '../public/voice/parts')
fs.mkdirSync(out, { recursive: true })
words.forEach(([a, b], i) => {
  // a little air either side so consonants aren't clipped
  const start = Math.max(0, a - 0.04)
  const end = Math.min(duration, b + 0.06)
  const file = path.join(out, `${PARTS[i]}.mp3`)
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-ss', start.toFixed(3), '-to', end.toFixed(3), '-c:a', 'libmp3lame', '-q:a', '3', file])
  console.log(`${PARTS[i].padEnd(11)} ${(end - start).toFixed(2)}s`)
})
console.log(`→ public/voice/parts/ (${PARTS.length} clips)`)
