import { useEffect, useRef } from 'react'
import { symbolPath } from '../../scenes/room/roomArt'
import type { SymbolId } from '../../riddles/types'

/** A carved sign, drawn by the same code as the signs in the paintings. */
export function SymbolIcon({ symbol, size = 40 }: { symbol: SymbolId; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = c.height = Math.round(size * dpr)
    const g = c.getContext('2d')!
    g.scale((size * dpr) / 110, (size * dpr) / 110)
    g.translate(55, 55)
    g.fillStyle = g.strokeStyle = '#e2bd6a'
    g.lineCap = 'round'
    g.lineJoin = 'round'
    symbolPath(g, symbol)
  }, [symbol, size])
  return <canvas ref={ref} className="symbol-icon" style={{ width: size, height: size }} aria-hidden="true" />
}
