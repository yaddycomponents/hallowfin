import { useEffect, useMemo, useRef, useState } from 'react'
import { openLink } from './link'

// The phone remote, game side. The phone's buttons arrive as commands and are
// pressed as the keys the host would press, so they run exactly the keyboard's
// logic; each only in the moment it's meant for.
const KEYS = {
  spin: { key: ' ', code: 'Space', in: ['pick'] },
  play: { key: ' ', code: 'Space', in: ['picked'] },
  next: { key: ' ', code: 'Space', in: ['survived', 'dare'] },
  dalgona: { key: 'd', code: 'KeyD', in: ['picked'] },
  absent: { key: 'n', code: 'KeyN', in: ['picked'] },
  pass: { key: 'a', code: 'KeyA', in: ['question', 'redlight', 'dalgona'] },
  fail: { key: 'f', code: 'KeyF', in: ['question', 'redlight', 'dalgona'] },
  music: { key: 'm', code: 'KeyM', in: ['pick', 'picked', 'survived', 'eliminated', 'dare', 'end'] },
}

// state: what the phone shows (who's up, the question and its answer)
export function useRemote(state) {
  const [info, setInfo] = useState(null)
  const [phones, setPhones] = useState(0)
  const phase = useRef(state.phase)
  phase.current = state.phase
  const link = useRef(null)

  useEffect(() => {
    // this tab's session: opening it makes a fresh key (the QR code); closing
    // the tab ends it and lets the phones go
    const l = openLink({
      onSession: (s) => { setInfo(s); if (!s) setPhones(0) },
      onMessage: (m) => {
        if (m.type === 'phones') setPhones(m.n)
        // a player carving dalgona on their phone: the big screen follows it
        if (m.type === 'carve') dispatchEvent(new CustomEvent('remote-carve', { detail: m }))
        const k = m.type === 'cmd' && KEYS[m.cmd]
        if (k && k.in.includes(phase.current)) dispatchEvent(new KeyboardEvent('keydown', { key: k.key, code: k.code }))
      },
    })
    link.current = l
    return () => l.close()
  }, [])

  const json = JSON.stringify(state)
  useEffect(() => {
    if (info) link.current?.send('state', { state: JSON.parse(json) })
  }, [info, json])

  // for the dalgona round: ask the relay (and wait for its answer), or tell it
  const ask = useMemo(() => ({
    request: (action, body) => link.current?.request(action, body) ?? Promise.reject(new Error('no link')),
    send: (action, body) => link.current?.send(action, body),
  }), [])

  return { info, phones, ...ask }
}
