import { useEffect, useState } from 'react'

// Full screen for the big screen. Browsers only allow it from a click.
export const isFull = () => !!document.fullscreenElement

export function enterFull() {
  if (!isFull()) document.documentElement.requestFullscreen?.().catch(() => {})
}

export function toggleFull() {
  if (isFull()) document.exitFullscreen?.()
  else enterFull()
}

export function useFullscreen() {
  const [full, setFull] = useState(isFull)
  useEffect(() => {
    const on = () => setFull(isFull())
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  return full
}
