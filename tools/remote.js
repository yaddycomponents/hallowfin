// The relay on this laptop, for when AWS can't be reached: the dev server
// takes WebSocket connections at /remote-ws and runs the same rules as the
// Lambda (relay/core.js), keeping sessions in memory. Phones join over the
// Wi-Fi, so the links it hands out point at this laptop's address. Dev server
// only: a built copy has no relay of its own (it uses AWS).
import { randomBytes } from 'node:crypto'
import { networkInterfaces } from 'node:os'
import { WebSocketServer } from 'ws'
import { relay } from '../relay/core.js'

const PATH = '/remote-ws'

const lanIps = () =>
  Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address)

export function remote() {
  return {
    name: 'squid-remote',
    configureServer(server) {
      const items = new Map()
      const store = {
        get: async (pk) => structuredClone(items.get(pk) ?? null),
        put: async (item) => { items.set(item.pk, structuredClone(item)) },
        del: async (pk) => { items.delete(pk) },
      }
      const sockets = new Map() // connection id → socket
      const send = async (to, msg) => {
        const ws = sockets.get(to)
        if (!ws || ws.readyState !== ws.OPEN) return false
        ws.send(JSON.stringify(msg))
        return true
      }
      const close = async (to) => sockets.get(to)?.close()
      // the phone pages, from this laptop, told to talk to this relay
      const base = () => {
        const port = server.httpServer?.address()?.port ?? 5173
        return lanIps().map((ip) => [`http://${ip}:${port}`, encodeURIComponent(`ws://${ip}:${port}${PATH}`)])
      }
      const links = {
        remote: (key) => base().map(([site, w]) => `${site}/remote.html?k=${key}&w=${w}`),
        carve: (t) => base().map(([site, w]) => `${site}/dalgona.html?c=${t}&w=${w}`),
      }
      const r = relay({ store, send, close, links })

      const wss = new WebSocketServer({ noServer: true, maxPayload: 24 * 1024 })
      // only our path: Vite's own hot-reload socket shares this server
      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (new URL(req.url, 'http://x').pathname !== PATH) return
        wss.handleUpgrade(req, socket, head, (ws) => {
          const id = randomBytes(9).toString('base64url')
          sockets.set(id, ws)
          ws.on('message', (data) => {
            let m
            try { m = JSON.parse(data) } catch { return }
            r.message(id, m).catch((e) => console.error('[remote]', e))
          })
          ws.on('close', () => { sockets.delete(id); r.disconnect(id).catch(() => {}) })
        })
      })
    },
  }
}
