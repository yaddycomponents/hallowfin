import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Smartphone } from 'lucide-react'
import { IconBtn } from './IconBtn'

// The phone remote's QR code: scan it and the phone runs the game (spin,
// start, not here, pass, fail, next) and shows the host the answer. Through
// AWS any phone on any network can; through this laptop, the same Wi-Fi.
export function RemoteBtn({ remote }) {
  const [open, setOpen] = useState(false)
  const [qr, setQr] = useState(null)
  const url = remote.info?.urls[0]
  useEffect(() => {
    if (url) QRCode.toDataURL(url, { margin: 1, width: 520, color: { dark: '#0b0d0f', light: '#ffffff' } }).then(setQr)
  }, [url])
  // a phone just joined: let the host see "connected", then close by itself
  const seen = useRef(remote.phones)
  useEffect(() => {
    const joined = remote.phones > seen.current
    seen.current = remote.phones
    if (!open || !joined) return
    const t = setTimeout(() => setOpen(false), 1200)
    return () => clearTimeout(t)
  }, [remote.phones, open])
  if (!remote.info) return null
  const n = remote.phones
  const local = remote.info.where === 'local'
  return (
    <>
      <IconBtn icon={Smartphone} label={n ? `Phone remote · ${n} connected` : 'Phone remote'} on={n > 0 ? true : undefined} onClick={() => setOpen(true)} />
      {open && (
        <div className="remote-wrap" onClick={() => setOpen(false)}>
          <div className="remote-card" onClick={(e) => e.stopPropagation()}>
            <b>Phone remote</b>
            {url ? (
              <>
                {qr && <img src={qr} alt="QR code for the phone remote" />}
                {local
                  ? <p>Scan with your phone on the <em>same Wi-Fi</em> (AWS is out of reach: using this laptop).</p>
                  : <p>Scan with your phone: <em>any network</em> works.</p>}
                <code>{url}</code>
                <p className={`remote-status ${n ? 'on' : ''}`}>{n ? `${n} phone${n > 1 ? 's' : ''} connected` : 'Waiting for a phone…'}</p>
                {local && <p className="remote-tip">Not connecting? The office Wi-Fi may block it: turn on your phone's hotspot and join it from this laptop, then scan again.</p>}
              </>
            ) : (
              <p>This laptop isn't on a network. Join the Wi-Fi (or your phone's hotspot) and restart the game with <code>npm run dev</code>.</p>
            )}
            <button className="remote-close" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </>
  )
}
