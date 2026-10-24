import { useEffect, useRef, useState } from 'react'

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

  useEffect(() => {
    // this tab's session: opening it makes a fresh key (the QR code); closing
    // the tab ends it and lets the phones go. No relay (a built copy): nothing
    const events = new EventSource('/remote/game')
    events.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.type === 'session') setInfo(m)
      if (m.type === 'phones') setPhones(m.n)
      // a player carving dalgona on their phone: the big screen follows it
      if (m.type === 'carve') dispatchEvent(new CustomEvent('remote-carve', { detail: m }))
      const k = m.type === 'cmd' && KEYS[m.cmd]
      if (k && k.in.includes(phase.current)) dispatchEvent(new KeyboardEvent('keydown', { key: k.key, code: k.code }))
    }
    // the line dropped (the dev server restarted): the next session is new
    events.onerror = () => { setInfo(null); setPhones(0) }
    return () => events.close()
  }, [])

  const json = JSON.stringify(state)
  useEffect(() => {
    if (info) fetch(`/remote/state?k=${info.key}`, { method: 'POST', body: json }).catch(() => {})
  }, [info, json])

  return { info, phones }
}
