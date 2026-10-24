import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { sfx } from '../audio/sound'
import { DONE, GLYPH, LIVES, NAMES, SECONDS, outline, pathOf, shards } from '../game/dalgona'
import { Patch } from './Panels'

// A dalgona turn on the big screen: the player scans the QR, carves on their
// phone, and the room watches it here, scrape by scrape, crack by crack. The
// phone says when it's carved out or broken; the clock here says time's up;
// the host can still call it (A / F, or the remote).
export function DalgonaPanel({ shape, player, no, remote, onVerdict }) {
  const strokes = useMemo(() => outline(shape), [shape])
  const [qr, setQr] = useState(null)
  const [url, setUrl] = useState(null)
  const [stage, setStage] = useState('scan') // scan → ready (phone has it) → carving → done
  const [left, setLeft] = useState(SECONDS)
  const [cracks, setCracks] = useState(0)
  const [progress, setProgress] = useState(0)
  const [lines, setLines] = useState([]) // the needle's strokes, as drawn on the phone
  const [splits, setSplits] = useState([]) // where it cracked
  const [gone, setGone] = useState(false)
  const [result, setResult] = useState(null)
  const [pieces, setPieces] = useState(null) // the candy in pieces, once it breaks
  const decided = useRef(false)
  const broke = useRef(false)
  const lastCrack = useRef([0.5, 0.5])
  const key = remote.info?.key
  // the listeners below are set up once: they read these fresh
  const latest = useRef()
  latest.current = { key, onVerdict }

  const decide = (result) => {
    if (decided.current) return
    decided.current = true
    setStage('done')
    setResult(result)
    const { key } = latest.current
    if (key) fetch(`/remote/carve-close?k=${key}`, { method: 'POST', body: JSON.stringify({ result: result === 'answered' ? 'passed' : 'failed' }) }).catch(() => {})
    // a beat for the room to see it: the shape carved out, or the candy in pieces
    setTimeout(() => latest.current.onVerdict(result), broke.current ? 2200 : 1500)
  }

  // open this turn's candy: a one-time link for the player's phone
  useEffect(() => {
    if (!key) return
    let live = true
    fetch(`/remote/carve-open?k=${key}`, { method: 'POST', body: JSON.stringify({ shape, strokes, seconds: SECONDS, lives: LIVES, done: DONE, no, name: player }) })
      .then((r) => r.json())
      .then(({ urls }) => { if (live && urls[0]) { setUrl(urls[0]); QRCode.toDataURL(urls[0], { margin: 1, width: 440 }).then(setQr) } })
      .catch(() => {})
    return () => {
      live = false
      // left early (the host judged it, or went home): the phone's round is over
      if (!decided.current) fetch(`/remote/carve-close?k=${key}`, { method: 'POST', body: '{}' }).catch(() => {})
    }
  }, [key, shape])

  // the phone, as it carves
  useEffect(() => {
    const on = (e) => {
      const m = e.detail
      if (m.ev === 'claimed') { setStage((s) => (s === 'scan' ? 'ready' : s)); setGone(false) }
      if (m.ev === 'gone') setGone(true)
      if (m.ev !== 'move') return
      if (m.start) setStage('carving')
      if (m.pts?.length) {
        setLines((ls) => {
          const out = ls.slice()
          for (const [x, y, s] of m.pts) (out[s] ??= []).push([x, y])
          return out
        })
      }
      if (m.crack?.length) { setSplits((c) => [...c, ...m.crack.map(crackAt)]); sfx.crack(); lastCrack.current = m.crack.at(-1) }
      setCracks(m.cracks ?? 0)
      setProgress(m.progress ?? 0)
      if (m.status === 'done') decide('answered')
      if (m.status === 'broken') {
        // the last crack: the whole candy gives way
        broke.current = true
        setTimeout(() => { sfx.shatter(); setPieces(shards(lastCrack.current)) }, 250)
        decide('failed')
      }
    }
    addEventListener('remote-carve', on)
    return () => removeEventListener('remote-carve', on)
  }, [])

  // the clock runs once they've pressed start; the last five seconds thump
  useEffect(() => {
    if (stage !== 'carving') return
    const end = performance.now() + SECONDS * 1000
    let beat = -1, sent = -1
    const id = setInterval(() => {
      const s = Math.max(0, (end - performance.now()) / 1000)
      setLeft(s)
      const whole = Math.ceil(s)
      if (whole <= 5 && whole > 0 && whole !== beat) { beat = whole; sfx.heart() }
      if (whole !== sent && key) { sent = whole; fetch(`/remote/carve-tick?k=${key}`, { method: 'POST', body: JSON.stringify({ left: s }) }).catch(() => {}) }
      if (s === 0) { clearInterval(id); decide('failed') }
    }, 100)
    return () => clearInterval(id)
  }, [stage])

  // the host's call: A passes, F fails
  useEffect(() => {
    const k = (e) => {
      if (e.key === 'a') decide('answered')
      if (e.key === 'f') decide('failed')
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [])

  const tip = lines.at(-1)?.at(-1)
  // the candy as it stands: drawn whole, or once per piece when it breaks
  const candy = (
    <>
      <circle cx=".5" cy=".5" r=".46" fill="url(#candy)" />
      <circle cx=".5" cy=".5" r=".46" fill="none" stroke="rgba(90,50,10,.5)" strokeWidth=".008" />
      <path d={pathOf(strokes)} className="groove light" />
      <path d={pathOf(strokes)} className="groove" />
      {lines.map((l, i) => l.length > 1 && <polyline key={i} points={l.map((p) => p.join(',')).join(' ')} className="scrape" />)}
      {splits.map((l, i) => <polyline key={i} points={l.map((p) => p.join(',')).join(' ')} className="split" />)}
      {tip && stage === 'carving' && <circle cx={tip[0]} cy={tip[1]} r=".012" className="needle" />}
    </>
  )
  return (
    <div className={`dalgona ${stage} ${result === 'failed' ? 'broke' : result === 'answered' ? 'carved' : ''}`}>
      <div className="dalgona-candy">
        <svg viewBox="0 0 1 1">
          <defs>
            <radialGradient id="candy" cx=".45" cy=".42" r=".55">
              <stop offset="0" stopColor="#f0c36c" />
              <stop offset=".7" stopColor="#d99a3e" />
              <stop offset="1" stopColor="#a86d22" />
            </radialGradient>
            {pieces?.map((p, i) => <clipPath key={i} id={`shard-${i}`}><polygon points={p.points.map((q) => q.join(',')).join(' ')} /></clipPath>)}
          </defs>
          {pieces
            // broken: the same candy, once per piece, each cut out and falling away
            ? pieces.map((p, i) => (
              <g key={i} className="shard" style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--turn': `${p.turn}deg`, '--d': `${i * 0.02}s`, transformOrigin: `${p.at[0]}px ${p.at[1]}px` }}>
                <g clipPath={`url(#shard-${i})`}>{candy}</g>
              </g>
            ))
            : candy}
        </svg>
      </div>

      <div className="dalgona-side">
        <div className="dalgona-title">DALG<span>○</span>NA</div>
        <div className="dalgona-who"><Patch no={no} mini /> <b>{player}</b></div>
        <div className="dalgona-shape"><i>{GLYPH[shape]}</i>{NAMES[shape]}</div>

        {stage === 'scan' && (
          qr
            ? <div className="dalgona-qr"><img src={qr} alt="Scan to carve" /><p>Scan with your phone to get your candy</p></div>
            : <p className="dalgona-note">{key ? 'Making your candy…' : 'Carving needs the phone remote (run the game with npm run dev, on Wi-Fi). Judge with A / F.'}</p>
        )}
        {stage === 'ready' && <p className="dalgona-note big">Got it. Press <b>Start carving</b> on your phone…</p>}
        {(stage === 'carving' || stage === 'done') && (
          <>
            <div className={`dalgona-time ${left <= 10 ? 'low' : ''}`}>{Math.ceil(left)}</div>
            <div className="dalgona-lives">{Array.from({ length: LIVES }, (_, i) => <i key={i} className={i < cracks ? 'gone' : ''} />)}</div>
            <div className="dalgona-progress"><i style={{ width: `${Math.min(100, (progress / DONE) * 100)}%` }} /></div>
          </>
        )}
        {result && <div className={`dalgona-result ${result === 'answered' ? 'win' : 'lose'}`}>{result === 'answered' ? 'Carved out' : cracks >= LIVES ? 'It broke' : 'Time’s up'}</div>}
        {gone && stage !== 'done' && <p className="dalgona-note warn">Their phone dropped out… it reconnects if they reopen the link</p>}
      </div>
    </div>
  )
}

// a crack on the big screen: a jagged split from where the candy gave
function crackAt([x, y]) {
  let a = Math.atan2(y - 0.5, x - 0.5) + (Math.random() - 0.5)
  const pts = [[x, y]]
  for (let i = 0; i < 6; i++) {
    a += (Math.random() - 0.5) * 1.1
    const [px, py] = pts.at(-1)
    pts.push([px + Math.cos(a) * 0.025, py + Math.sin(a) * 0.025])
  }
  return pts
}
