// The relay's rules: who may say what to whom. The same rules run in two
// places, each giving them somewhere to keep things and a way to send:
//
//   AWS            relay/lambda.js   API Gateway WebSocket → Lambda → DynamoDB
//   this laptop    tools/remote.js   the dev server's own WebSocket, in memory
//
// Three kinds of connection talk through it:
//
//   game    the game's tab. It opens a session and gets its key (the QR code)
//           and a host token, a secret only it holds: only it can change the
//           session (its state, its dalgona rounds, ending it)
//   phone   the host's remote: with the key it can press the game's buttons
//           and sees who's up
//   carver  a player carving a dalgona: a one-turn link; the first phone to
//           open it claims it, and gets a pass its moves must carry
//
// Everything is JSON with an `action`. Replies to a request carry its `id`.
// Kept: S#<key> a session, C#<connection> who a connection is, K#<token> a
// dalgona round; each expires on its own (the store's TTL) after a party.
import { randomBytes } from 'node:crypto'

export const HOURS = 8 // how long anything is kept, at most
const token = () => randomBytes(12).toString('base64url')

// store: { get(pk), put(item), del(pk) }
// send(connection, message) → false once that connection has gone
// close(connection): hang up on it (optional)
// links: { remote(key) → [urls], carve(token) → [urls] }
export function relay({ store, send, close = async () => {}, links }) {
  const session = async (key) => (typeof key === 'string' ? store.get(`S#${key}`) : null)
  // a game's request: the right key and its host token, or nothing
  const mine = async (m) => {
    const s = await session(m.key)
    return s && s.hostToken === m.hostToken ? s : null
  }
  const reply = (conn, m, msg) => send(conn, m.id ? { ...msg, id: m.id } : msg)
  const toGame = (s, msg) => (s.game ? send(s.game, msg) : true)
  const phonesTo = (s) => toGame(s, { type: 'phones', n: s.phones.length })

  async function toPhones(s, msg) {
    const alive = []
    for (const p of s.phones) if (await send(p, msg)) alive.push(p)
    if (alive.length !== s.phones.length) {
      s.phones = alive
      await store.put(s)
      await phonesTo(s)
    }
  }

  async function endCarve(s, result) {
    if (!s.carve) return
    const k = await store.get(`K#${s.carve}`)
    if (k?.phone) { await send(k.phone, { type: 'over', result }); await close(k.phone) }
    await store.del(`K#${s.carve}`)
    s.carve = null
  }

  const actions = {
    ping: async () => {},

    // a game opens its session, or comes back to it after its line dropped
    async host(conn, m) {
      let s = await mine(m)
      if (!s) {
        const key = token()
        s = { pk: `S#${key}`, key, hostToken: token(), phones: [], state: null, carve: null }
      }
      s.game = conn
      await store.put(s)
      await store.put({ pk: `C#${conn}`, role: 'game', key: s.key })
      await reply(conn, m, { type: 'session', key: s.key, hostToken: s.hostToken, urls: links.remote(s.key) })
      await phonesTo(s)
    },

    // what the phones show: who's up, the question and its answer
    async state(conn, m) {
      const s = await mine(m)
      if (!s) return
      s.state = m.state ?? null
      await store.put(s)
      await toPhones(s, { type: 'state', state: s.state })
    },

    // the game's tab closed: the session is over, its phones let go
    async end(conn, m) {
      const s = await mine(m)
      if (!s) return
      await endCarve(s, 'closed')
      for (const p of s.phones) { await send(p, { type: 'ended' }); await close(p) }
      await store.del(s.pk)
    },

    // a dalgona round: a fresh one-turn link for the called player
    async carveOpen(conn, m) {
      const s = await mine(m)
      if (!s) return
      await endCarve(s, 'closed')
      const t = token()
      await store.put({ pk: `K#${t}`, key: s.key, setup: m.setup ?? {}, phone: null, pass: null })
      s.carve = t
      await store.put(s)
      await reply(conn, m, { type: 'carveOpened', urls: links.carve(t) })
    },

    // the round's clock, ticking on the player's phone
    async carveTick(conn, m) {
      const s = await mine(m)
      const k = s?.carve && (await store.get(`K#${s.carve}`))
      if (k?.phone) await send(k.phone, { type: 'tick', left: m.left })
    },

    // the round is decided (or the host moved on)
    async carveClose(conn, m) {
      const s = await mine(m)
      if (!s) return
      await endCarve(s, m.result ?? 'closed')
      await store.put(s)
    },

    // the host's phone joins with the key from the QR code
    async phone(conn, m) {
      const s = await session(m.key)
      if (!s) return reply(conn, m, { type: 'ended' })
      if (!s.phones.includes(conn)) s.phones.push(conn)
      await store.put(s)
      await store.put({ pk: `C#${conn}`, role: 'phone', key: s.key })
      await reply(conn, m, { type: 'state', state: s.state })
      await phonesTo(s)
    },

    // a button on the host's phone: pressed on the game
    async cmd(conn, m) {
      const s = await session(m.key)
      if (!s) return reply(conn, m, { type: 'ended' })
      if (typeof m.cmd !== 'string' || m.cmd.length > 20) return
      await toGame(s, { type: 'cmd', cmd: m.cmd })
      await reply(conn, m, { type: 'sent' })
    },

    // a player's phone opens the candy: theirs if nobody has it
    async carve(conn, m) {
      const k = typeof m.c === 'string' && (await store.get(`K#${m.c}`))
      if (!k || (k.phone && k.phone !== conn)) return reply(conn, m, { type: 'denied' })
      k.phone = conn
      k.pass = token()
      await store.put(k)
      await store.put({ pk: `C#${conn}`, role: 'carver', c: m.c })
      await reply(conn, m, { type: 'setup', ...k.setup, pass: k.pass })
      const s = await session(k.key)
      if (s) await toGame(s, { type: 'carve', ev: 'claimed' })
    },

    // the player's needle, a few times a second: to the big screen
    async move(conn, m) {
      const k = typeof m.c === 'string' && (await store.get(`K#${m.c}`))
      if (!k || !k.pass || m.pass !== k.pass) return
      const s = await session(k.key)
      if (!s) return
      const { action, c, pass, id, ...move } = m
      await toGame(s, { type: 'carve', ev: 'move', ...move })
    },
  }

  return {
    async message(conn, m) {
      const act = m && typeof m.action === 'string' && Object.hasOwn(actions, m.action) && actions[m.action]
      if (act) await act(conn, m)
    },

    // a connection closed: tidy up after it
    async disconnect(conn) {
      const who = await store.get(`C#${conn}`)
      if (!who) return
      await store.del(`C#${conn}`)
      if (who.role === 'game') {
        // its line dropped (or the tab went without saying): the session waits
        // for it to come back, and expires on its own if it never does
        const s = await session(who.key)
        if (s?.game === conn) { s.game = null; await store.put(s) }
      }
      if (who.role === 'phone') {
        const s = await session(who.key)
        if (s) { s.phones = s.phones.filter((p) => p !== conn); await store.put(s); await phonesTo(s) }
      }
      if (who.role === 'carver') {
        const k = await store.get(`K#${who.c}`)
        if (k?.phone === conn) {
          k.phone = null // they can reopen the link and carry on
          await store.put(k)
          const s = await session(k.key)
          if (s) await toGame(s, { type: 'carve', ev: 'gone' })
        }
      }
    },
  }
}
