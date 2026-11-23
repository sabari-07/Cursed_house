// Draws the painted rooms' clue glyphs (riddles/types.ts Glyph) into overlay
// atlas cells: letters in dust or brass, book spines, carved signs, soft
// blobs (an unlit lamp's shade, a flame in glass) and a wiping hand.

import type { CellPainter } from '../hall/riddleArt'
import { OV_CELL } from '../hall/riddleArt'
import type { Glyph, SymbolId } from '../../riddles/types'

const S = OV_CELL

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** A sign, drawn as one path in a 100 × 100 box centred on (0, 0). */
export function symbolPath(g: CanvasRenderingContext2D, s: SymbolId): void {
  g.beginPath()
  switch (s) {
    case 'moon':
      g.arc(0, 0, 40, 0.35 * Math.PI, 1.65 * Math.PI, false)
      g.arc(16, -4, 34, 1.55 * Math.PI, 0.45 * Math.PI, true)
      g.closePath(); g.fill(); break
    case 'eye':
      g.moveTo(-46, 0); g.quadraticCurveTo(0, -38, 46, 0); g.quadraticCurveTo(0, 38, -46, 0); g.closePath()
      g.lineWidth = 7; g.stroke()
      g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.fill(); break
    case 'key':
      g.lineWidth = 9
      g.arc(-24, 0, 16, 0, Math.PI * 2); g.stroke()
      g.beginPath(); g.moveTo(-8, 0); g.lineTo(44, 0); g.moveTo(30, 0); g.lineTo(30, 16); g.moveTo(42, 0); g.lineTo(42, 14); g.stroke(); break
    case 'crown':
      g.moveTo(-40, 26); g.lineTo(-44, -22); g.lineTo(-20, 0); g.lineTo(0, -34); g.lineTo(20, 0); g.lineTo(44, -22); g.lineTo(40, 26); g.closePath(); g.fill(); break
    case 'hourglass':
      g.lineWidth = 7
      g.moveTo(-28, -42); g.lineTo(28, -42); g.moveTo(-28, 42); g.lineTo(28, 42); g.stroke()
      g.beginPath(); g.moveTo(-22, -38); g.lineTo(22, -38); g.lineTo(3, 0); g.lineTo(22, 38); g.lineTo(-22, 38); g.lineTo(-3, 0); g.closePath(); g.stroke()
      g.beginPath(); g.moveTo(-12, 36); g.lineTo(12, 36); g.lineTo(0, 18); g.closePath(); g.fill(); break
    case 'skull':
      g.arc(0, -8, 32, Math.PI * 0.85, Math.PI * 2.15); g.lineTo(18, 34); g.lineTo(-18, 34); g.closePath(); g.fill()
      g.globalCompositeOperation = 'destination-out'
      g.beginPath(); g.arc(-13, -6, 9, 0, Math.PI * 2); g.arc(13, -6, 9, 0, Math.PI * 2); g.fill()
      g.beginPath(); g.moveTo(0, 6); g.lineTo(-5, 16); g.lineTo(5, 16); g.closePath(); g.fill()
      g.globalCompositeOperation = 'source-over'; break
    case 'rose':
      g.lineWidth = 6
      for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(0, -12, 10 + k * 9, k, k + Math.PI * 1.6); g.stroke() }
      g.beginPath(); g.moveTo(0, 14); g.lineTo(0, 46); g.moveTo(0, 30); g.quadraticCurveTo(16, 22, 22, 30); g.stroke(); break
    case 'raven':
      // a perched raven, facing right
      g.moveTo(-44, 10); g.quadraticCurveTo(-20, -6, 4, -10); g.quadraticCurveTo(14, -34, 30, -28)
      g.lineTo(46, -24); g.lineTo(32, -18); g.quadraticCurveTo(30, 6, 12, 20); g.lineTo(20, 40); g.lineTo(14, 40); g.lineTo(6, 24)
      g.lineTo(-2, 24); g.lineTo(2, 40); g.lineTo(-4, 40); g.lineTo(-10, 22); g.quadraticCurveTo(-30, 22, -44, 10); g.closePath(); g.fill(); break
  }
}

/** The painter for one glyph, in an overlay of w × h painting px (so letters keep their shape). */
export function glyphPainter(glyph: Glyph, w: number, h: number): CellPainter {
  const aspect = w / h
  return (g, x0) => {
    g.save()
    g.translate(x0, 0)
    // draw in a box that is S wide and S / aspect high, squashed back into the cell
    g.scale(1, aspect)
    const H = S / aspect
    switch (glyph.type) {
      case 'text': {
        const lines = glyph.text.split('\n')
        const lh = H / lines.length
        const fam = glyph.font === 'script' ? '"Segoe Script", "Brush Script MT", cursive' : 'Georgia, "Times New Roman", serif'
        let size = lh * 0.82
        g.font = `${glyph.font === 'caps' ? 'bold ' : ''}${size}px ${fam}`
        const widest = Math.max(...lines.map(l => g.measureText(l).width))
        if (widest > S * 0.92) { size *= (S * 0.92) / widest; g.font = `${glyph.font === 'caps' ? 'bold ' : ''}${size}px ${fam}` }
        if (glyph.bg) {
          g.fillStyle = glyph.bg
          g.fillRect(S * 0.04, H * 0.04, S * 0.92, H * 0.92)
          g.strokeStyle = 'rgba(0,0,0,.6)'
          g.lineWidth = S * 0.05
          g.strokeRect(S * 0.04, H * 0.04, S * 0.92, H * 0.92)
        }
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillStyle = glyph.color ?? '#fff'
        g.translate(S / 2, H / 2)
        g.scale(glyph.mirror ? -1 : 1, glyph.flip ? -1 : 1)
        lines.forEach((l, i) => g.fillText(l, 0, (i - (lines.length - 1) / 2) * lh))
        break
      }
      case 'spine': {
        // a leather spine: the colour, two raised bands, worn edges
        g.fillStyle = glyph.color
        g.fillRect(S * 0.08, H * 0.02, S * 0.84, H * 0.96)
        g.fillStyle = 'rgba(0,0,0,.35)'
        g.fillRect(S * 0.08, H * 0.18, S * 0.84, H * 0.04)
        g.fillRect(S * 0.08, H * 0.78, S * 0.84, H * 0.04)
        g.fillStyle = 'rgba(255,230,180,.18)'
        g.fillRect(S * 0.12, H * 0.02, S * 0.12, H * 0.96)
        break
      }
      case 'symbol': {
        if (glyph.bg) {
          g.fillStyle = glyph.bg
          g.fillRect(S * 0.06, H * 0.01, S * 0.88, H * 0.98)
          g.fillStyle = 'rgba(0,0,0,.4)'
          g.fillRect(S * 0.06, H * 0.12, S * 0.88, H * 0.025)
          g.fillRect(S * 0.06, H * 0.86, S * 0.88, H * 0.025)
        }
        const k = Math.min(S, H) / 110
        g.translate(S / 2, H / 2)
        g.scale(k, k)
        g.fillStyle = glyph.color ?? '#fff'
        g.strokeStyle = glyph.color ?? '#fff'
        g.lineCap = 'round'
        g.lineJoin = 'round'
        symbolPath(g, glyph.symbol)
        break
      }
      case 'blob': {
        const hex = (glyph.color ?? '#ffffff').replace('#', '')
        const [cr, cg, cb] = [0, 2, 4].map(k => parseInt(hex.slice(k, k + 2), 16))
        const gr = g.createRadialGradient(S / 2, H / 2, 0, S / 2, H / 2, Math.min(S, H) / 2)
        gr.addColorStop(0, `rgba(${cr},${cg},${cb},1)`)
        gr.addColorStop(0.55, `rgba(${cr},${cg},${cb},.75)`)
        gr.addColorStop(1, `rgba(${cr},${cg},${cb},0)`)
        g.fillStyle = gr
        g.fillRect(0, 0, S, H)
        break
      }
      case 'hand': {
        // a smear where a palm wiped the dust: soft streaks, a little uneven
        g.strokeStyle = 'rgba(255,255,255,.55)'
        g.lineCap = 'round'
        for (let k = 0; k < 5; k++) {
          g.lineWidth = S * (0.1 + 0.04 * hash(k, 2))
          g.beginPath()
          g.moveTo(S * (0.18 + k * 0.15), H * (0.12 + 0.08 * hash(k, 1)))
          g.quadraticCurveTo(S * (0.2 + k * 0.14), H * 0.5, S * (0.24 + k * 0.12), H * (0.86 - 0.1 * hash(k, 3)))
          g.stroke()
        }
        break
      }
    }
    g.restore()
  }
}
