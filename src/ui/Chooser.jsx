// After "Yes": two envelopes on the table, the night's two games. The host
// picks one (1 / 2, a click, or the phone); it flips open, the other falls.
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Home } from 'lucide-react'
import { sfx } from '../audio/sound'
import { IconBtn } from './IconBtn'
import { Mark } from '../whoami/WhoAmI'

const GAMES = [
  { id: 'squid', key: '1', shape: 'o', title: 'Squid Dare', sub: 'Quiz · 달고나 · penalties', ko: '오징어 게임' },
  { id: 'whoami', key: '2', shape: 't', title: 'Who Am I?', sub: '3 teams · 60 seconds · clues', ko: '나는 누구?' },
]

export function Chooser({ onChoose, onLobby }) {
  const root = useRef()
  const busy = useRef(false)

  useGSAP(() => {
    gsap.timeline()
      .from('.choose-head', { opacity: 0, y: -20, duration: 0.6 })
      .from('.envelope', { y: innerHeight, rotation: (i) => (i ? 18 : -18), duration: 0.9, stagger: 0.15, ease: 'power4.out' }, 0.1)
      .from('.choose-hint', { opacity: 0, duration: 0.4 })
  }, { scope: root })

  const pick = (i) => {
    if (busy.current) return
    busy.current = true
    sfx.unlock()
    sfx.land()
    const els = root.current.querySelectorAll('.envelope')
    const other = els[1 - i]
    gsap.timeline({ onComplete: () => onChoose(GAMES[i].id) })
      .to(other, { y: innerHeight, rotation: i ? -30 : 30, opacity: 0, duration: 0.6, ease: 'power3.in' })
      .to(els[i], { x: (i ? -1 : 1) * (els[i].offsetWidth / 2 + 20), scale: 1.15, duration: 0.5, ease: 'power3.inOut' }, 0.15)
      .to(els[i].querySelector('.env-flap'), { rotationX: 180, duration: 0.45, ease: 'power2.in' })
      .to(els[i], { scale: 2.4, opacity: 0, duration: 0.5, ease: 'power3.in' }, '+=0.2')
      .to('.choose-head, .choose-hint', { opacity: 0, duration: 0.3 }, '<')
  }

  useEffect(() => {
    const k = (e) => {
      if (e.key === '1' || e.key === 'ArrowLeft') pick(0)
      if (e.key === '2' || e.key === 'ArrowRight') pick(1)
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [])

  return (
    <div className="chooser" ref={root}>
      <IconBtn icon={Home} label="Lobby" className="choose-home" onClick={onLobby} />
      <h2 className="choose-head">Choose tonight's game<small>오늘의 게임</small></h2>
      <div className="envelopes">
        {GAMES.map((g, i) => (
          <button key={g.id} className={`envelope ${g.shape}`} onClick={() => pick(i)} aria-label={`${g.title} (${g.key})`}>
            <span className="env-flap" />
            <span className="env-no">GAME {i + 1}</span>
            <Mark shape={g.shape} className="env-mark" />
            <span className="env-ko">{g.ko}</span>
            <b>{g.title}</b>
            <small>{g.sub}</small>
            <kbd>{g.key}</kbd>
          </button>
        ))}
      </div>
      <p className="choose-hint">Press 1 or 2</p>
    </div>
  )
}
