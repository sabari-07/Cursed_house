import { useEffect } from 'react'

/**
 * Phones: the game fills the screen without the browser's bars. The first
 * finished tap (the entry screen's) asks for full screen and turns the game
 * sideways; if the player later leaves full screen, the next tap asks again.
 * There is no button: browsers allow full screen only from a finished tap
 * (touchend / click), so every tap is the chance to ask.
 *
 * Browsers without page full screen (iPhone Safari) simply keep their bars;
 * added to the home screen, the game opens without them anyway
 * (public/manifest.webmanifest and the apple-mobile-web-app meta tags).
 * Desktop and an installed copy: nothing happens.
 */
const TOUCH = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
const installed = () => window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export function FullscreenButton() {
  useEffect(() => {
    const el = document.documentElement
    if (!TOUCH || installed() || !el.requestFullscreen) return
    let asking = false
    const ask = () => {
      if (document.fullscreenElement || asking) return
      asking = true
      el.requestFullscreen({ navigationUI: 'hide' })
        .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
        .catch(() => undefined)
        .finally(() => { asking = false })
    }
    window.addEventListener('touchend', ask)
    window.addEventListener('click', ask)
    return () => { window.removeEventListener('touchend', ask); window.removeEventListener('click', ask) }
  }, [])
  return null
}
