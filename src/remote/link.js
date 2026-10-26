// The game's line to its phones: a WebSocket to the relay. On AWS by default
// (window.SQUID_WS, from public/backend.js), so the phones can be on any
// network; under `npm run dev`, if AWS can't be reached, the relay on this
// laptop instead (phones on the same Wi-Fi). Either way the same messages:
// see relay/core.js.
//
// The session lives as long as the tab: closing or reloading it ends the
// session and lets the phones go. A line that merely drops (Wi-Fi, a sleeping
// laptop, API Gateway's 2-hour limit) comes back to the same session.
const AWS = typeof window !== 'undefined' ? window.SQUID_WS : null
const LOCAL = import.meta.env.DEV ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/remote-ws` : null
// Under `npm run dev`, the relay's phone links (made for the live site) point
// at this laptop instead, so the phone gets the pages being worked on
const HERE = import.meta.env.DEV ? `${location.protocol}//${__LAN__}:${location.port}` : null
// (and the laptop's own relay, if that's the one in use, by its Wi-Fi address:
// "localhost" on a phone is the phone)
const here = (u) => {
  if (!HERE) return u
  const url = new URL(u.slice(new URL(u).origin.length), HERE)
  const w = url.searchParams.get('w')
  if (w) { const r = new URL(w); r.hostname = __LAN__; url.searchParams.set('w', r.href) }
  return url.href
}
const WAIT = 4000 // ms to reach a relay before trying the next

export function openLink({ onSession, onMessage }) {
  let ws = null
  let key = null
  let hostToken = null
  let closed = false
  let n = 0
  const waiting = new Map() // request id → its reply

  const send = (msg) => { if (ws?.readyState === 1) ws.send(JSON.stringify(msg)) }
  const as = (action, body) => ({ action, key, hostToken, ...body })

  // one relay: open, then claim (or reclaim) the session
  const attempt = (url, where) => new Promise((done) => {
    const sock = new WebSocket(url)
    const give = setTimeout(() => { sock.close(); done(false) }, WAIT)
    sock.onopen = () => {
      clearTimeout(give)
      if (closed) { sock.close(); return done(true) } // the tab moved on meanwhile
      ws = sock
      sock.onmessage = (e) => {
        const m = JSON.parse(e.data)
        if (m.urls) m.urls = m.urls.map(here)
        if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); return }
        onMessage(m)
      }
      sock.onclose = () => { if (ws === sock) { ws = null; onSession(null); if (!closed) setTimeout(start, 1500) } }
      request('host').then((m) => {
        key = m.key
        hostToken = m.hostToken
        onSession({ key, urls: m.urls, where })
      }, () => sock.close())
      done(true)
    }
    sock.onerror = () => { clearTimeout(give); done(false) }
  })

  async function start() {
    // dev: the laptop's relay first (AWS turns away phone pages not on the live site)
    const relays = LOCAL ? [[LOCAL, 'local'], [AWS, 'aws']] : [[AWS, 'aws']]
    for (const [url, where] of relays) {
      if (closed) return
      if (url && (await attempt(url, where))) return
    }
    if (!closed) setTimeout(start, 5000) // nowhere to reach: keep trying
  }

  function request(action, body) {
    const id = String(++n)
    return new Promise((ok, no) => {
      waiting.set(id, ok)
      send({ ...as(action, body), id })
      setTimeout(() => { if (waiting.delete(id)) no(new Error(`${action}: no reply`)) }, 8000)
    })
  }

  // API Gateway hangs up after 10 quiet minutes
  const ping = setInterval(() => send({ action: 'ping' }), 4 * 60 * 1000)
  // the tab is going: end the session (a reload starts a fresh one)
  const bye = () => close()
  addEventListener('pagehide', bye)

  function close() {
    if (closed) return
    closed = true
    clearInterval(ping)
    removeEventListener('pagehide', bye)
    if (key) send(as('end'))
    ws?.close()
  }

  start()
  return {
    request,
    send: (action, body) => send(as(action, body)),
    close,
  }
}
