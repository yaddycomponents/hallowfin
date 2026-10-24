// The phone remote: a tiny relay inside the dev server. The game (on this
// laptop) and the host's phone (on the same Wi-Fi) talk through it:
//
//   phone ──POST /remote/cmd──▶ relay ──events──▶ game   (spin, pass, …)
//   game  ──POST /remote/state─▶ relay ──events──▶ phone  (who's up, the answer)
//
// A session lives as long as the game's tab: opening the game makes a fresh
// key (its QR code); closing or reloading the tab ends it, disconnects its
// phones, and the old link stops working. The game's own calls must come from
// this laptop. Dev server only: a built copy has no relay.
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'

const PAGE = new URL('./remote.html', import.meta.url)
const CARVE_PAGE = new URL('./dalgona.html', import.meta.url)

const lanIps = () =>
  Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address)

const isLocal = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)

const line = (res, msg) => res.write(`data: ${JSON.stringify(msg)}\n\n`)

export function remote() {
  // key → { game: the tab's event stream, phones: theirs, state: the latest }
  const sessions = new Map()
  // dalgona: a one-turn token → { session, setup, phone, pass }. The player's
  // link can only carve; the first phone to open it claims it (and gets a
  // pass for its moves), so someone else scanning the screen can't take over
  const carvers = new Map()
  const token = () => randomBytes(9).toString('base64url')
  const closeCarve = (c, result) => {
    if (c.phone) { line(c.phone, { type: 'over', result }); c.phone.end() }
    for (const [t, v] of carvers) if (v === c) carvers.delete(t)
  }

  const open = (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
    // phones sleep and Wi-Fi drops: a ping keeps the line open
    const ping = setInterval(() => res.write(': ping\n\n'), 15000)
    req.on('close', () => clearInterval(ping))
  }

  const phonesChanged = (s) => line(s.game, { type: 'phones', n: s.phones.size })

  const body = (req) => new Promise((ok) => {
    let s = ''
    req.on('data', (c) => { s += c; if (s.length > 20000) req.destroy() })
    req.on('end', () => { try { ok(JSON.parse(s)) } catch { ok(null) } })
  })

  const handle = async (req, res, server) => {
    const url = new URL(req.url, 'http://x')
    const route = url.pathname.replace(/\/$/, '') || '/'
    const s = sessions.get(url.searchParams.get('k'))
    const c = carvers.get(url.searchParams.get('c'))
    const deny = (code = 403) => { res.statusCode = code; res.end() }

    // a game tab opens: a new session, its key and links sent first
    if (route === '/game') {
      if (!isLocal(req)) return deny()
      const key = randomBytes(9).toString('base64url')
      const session = { game: res, phones: new Set(), state: null }
      sessions.set(key, session)
      open(req, res)
      const port = server.httpServer?.address()?.port ?? 5173
      line(res, { type: 'session', key, lan: !!server.config.server.host, urls: lanIps().map((ip) => `http://${ip}:${port}/remote?k=${key}`) })
      // the tab closed (or reloaded): the session ends, its phones are let go
      req.on('close', () => {
        sessions.delete(key)
        for (const v of [...carvers.values()]) if (v.session === session) closeCarve(v, 'closed')
        for (const p of session.phones) { line(p, { type: 'ended' }); p.end() }
      })
      return
    }
    // the player's side of a dalgona turn
    if (c) {
      if (route === '/dalgona') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store') // a phone never keeps an old copy of the rules
        return res.end(readFileSync(CARVE_PAGE, 'utf8'))
      }
      if (route === '/carve-stream') {
        if (c.phone) return deny(409) // someone already has this candy
        open(req, res)
        c.phone = res
        c.pass = token()
        line(res, { type: 'setup', ...c.setup, pass: c.pass })
        line(c.session.game, { type: 'carve', ev: 'claimed' })
        req.on('close', () => {
          if (c.phone !== res) return
          c.phone = null
          if (carvers.has(url.searchParams.get('c'))) line(c.session.game, { type: 'carve', ev: 'gone' })
        })
        return
      }
      if (route === '/carve-move' && req.method === 'POST') {
        const msg = await body(req)
        if (!msg || msg.pass !== c.pass) return deny()
        delete msg.pass
        line(c.session.game, { type: 'carve', ev: 'move', ...msg })
        return res.end()
      }
      return deny(404)
    }
    if (!s) return deny()
    if (route === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      return res.end(readFileSync(PAGE, 'utf8'))
    }
    if (route === '/state' && isLocal(req) && req.method === 'POST') {
      s.state = await body(req)
      for (const p of s.phones) line(p, { type: 'state', state: s.state })
      return res.end()
    }
    if (route === '/phone') {
      open(req, res)
      s.phones.add(res)
      line(res, { type: 'state', state: s.state })
      phonesChanged(s)
      req.on('close', () => { s.phones.delete(res); if (sessions.has(url.searchParams.get('k'))) phonesChanged(s) })
      return
    }
    // the game opens a dalgona turn (its QR link), ticks its clock, closes it
    if (route === '/carve-open' && isLocal(req) && req.method === 'POST') {
      const setup = await body(req)
      for (const v of [...carvers.values()]) if (v.session === s) closeCarve(v, 'closed')
      const t = token()
      carvers.set(t, { session: s, setup, phone: null, pass: null })
      const port = server.httpServer?.address()?.port ?? 5173
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ urls: lanIps().map((ip) => `http://${ip}:${port}/remote/dalgona?c=${t}`) }))
    }
    if ((route === '/carve-tick' || route === '/carve-close') && isLocal(req) && req.method === 'POST') {
      const msg = (await body(req)) ?? {}
      const v = [...carvers.values()].find((v) => v.session === s)
      if (v && route === '/carve-tick' && v.phone) line(v.phone, { type: 'tick', left: msg.left })
      if (v && route === '/carve-close') closeCarve(v, msg.result)
      return res.end()
    }
    if (route === '/cmd' && req.method === 'POST') {
      const msg = await body(req)
      if (typeof msg?.cmd !== 'string') return deny(400)
      line(s.game, { type: 'cmd', cmd: msg.cmd })
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ sent: true }))
    }
    deny(404)
  }

  return {
    name: 'squid-remote',
    configureServer(server) {
      server.middlewares.use('/remote', (req, res) => { handle(req, res, server) })
    },
  }
}
