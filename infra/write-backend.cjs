// After a deploy: put the relay's WebSocket address where the game and the
// phone pages read it (public/backend.js)
const fs = require('node:fs')
const path = require('node:path')

const out = JSON.parse(fs.readFileSync(path.join(__dirname, 'out.json'), 'utf8'))
const url = out.SquidDareRelay?.Url
if (!url) throw new Error('no Url in out.json: did the deploy finish?')
const file = path.join(__dirname, '../public/backend.js')
const src = fs.readFileSync(file, 'utf8').replace(/window\.SQUID_WS = .*/, `window.SQUID_WS = '${url}'`)
fs.writeFileSync(file, src)
console.log(`public/backend.js → ${url}`)
