// The painted rooms, as data: the painting, where Arjun stands, the camera,
// the lamps, windows and floor mist the shader lights, and the objects that
// can be inspected. All positions are painting px, measured on a 50 px grid.
// One scene class (HallScene) renders every room from this data.

import type { RoomId } from '../../game/levels'

export interface RoomLamp {
  x: number; y: number
  /** Glow radii, painting px. */
  rx: number; ry: number
  color: [number, number, number]
  /** Strength. */
  k: number
}

export interface RoomObject {
  id: string
  label: string
  /** x0, y0, x1, y1 */
  rect: [number, number, number, number]
}

export interface RoomDef {
  id: RoomId
  name: string
  art: { url: string; w: number; h: number }
  /** Shoulder line centre and px per model unit (the hall's 680 px on a 718 px painting sets the scale). */
  arjun: { x: number; shoulderY: number; unit: number }
  cam: {
    play: { zoom: number; fx: number; fy: number }
    introFrom: { zoom: number; fx: number; fy: number }
    dying: { fx: number; fy: number }
  }
  lamps: RoomLamp[]
  /** Soft rectangles where the painting's bright windows are (x0, y0, x1, y1), and the edge softness. */
  windows: [number, number, number, number][]
  winSoft: [number, number]
  /** Where moonlight shafts come from, or null. */
  shafts: [number, number] | null
  /** The floor-mist band: fade in from y0 to y1, out from y2 to y3. */
  mist: [number, number, number, number]
  /** Lightning lights this ellipse most: centre and radii. */
  flash: [number, number, number, number]
  /** How the room begins: the hall's door slam and voice, or a fade in. */
  intro: 'hall' | 'fade'
  objects: RoomObject[]
}

const WARM: [number, number, number] = [1.0, 0.62, 0.3]
const TEAL: [number, number, number] = [0.35, 0.95, 0.9]

export const ROOMS: Record<'hall' | 'library' | 'crypt', RoomDef> = {
  hall: {
    id: 'hall',
    name: 'The Grand Hall',
    art: { url: '/hall/grand-hall-clean.png', w: 1279, h: 718 },
    arjun: { x: 858, shoulderY: 396, unit: 680 },
    cam: {
      play: { zoom: 1.05, fx: 640, fy: 370 },
      introFrom: { zoom: 1.04, fx: 640, fy: 380 },
      dying: { fx: 760, fy: 380 },
    },
    lamps: [
      { x: 1062, y: 175, rx: 70, ry: 60, color: WARM, k: 0.55 },
      { x: 515, y: 463, rx: 26, ry: 30, color: WARM, k: 0.35 },
      { x: 555, y: 460, rx: 26, ry: 30, color: WARM, k: 0.35 },
      { x: 210, y: 305, rx: 30, ry: 26, color: WARM, k: 0.4 },
      { x: 698, y: 440, rx: 40, ry: 40, color: WARM, k: 0.25 },
      { x: 1158, y: 335, rx: 45, ry: 40, color: TEAL, k: 0.727 },
    ],
    windows: [[-2000, -2000, 560, 270]],
    winSoft: [40, 50],
    shafts: [370, -40],
    mist: [430, 560, 690, 740],
    flash: [360, 120, 520, 420],
    intro: 'hall',
    objects: [],                 // the hall's portraits, clock and journal are handled by the hall code
  },
  library: {
    id: 'library',
    name: 'The Library of Whispers',
    art: { url: '/rooms/library.webp', w: 1672, h: 941 },
    arjun: { x: 1395, shoulderY: 575, unit: 760 }, // right of the busts, clear of the clues
    cam: {
      play: { zoom: 1.04, fx: 836, fy: 470 },
      introFrom: { zoom: 1.16, fx: 830, fy: 430 },
      dying: { fx: 1000, fy: 470 },
    },
    // the five wall lamps first (the riddles put them out by index), then the moon window
    lamps: [
      { x: 130, y: 262, rx: 70, ry: 60, color: WARM, k: 0.5 },
      { x: 511, y: 389, rx: 50, ry: 45, color: WARM, k: 0.45 },
      { x: 757, y: 414, rx: 50, ry: 45, color: WARM, k: 0.45 },
      { x: 1032, y: 414, rx: 50, ry: 45, color: WARM, k: 0.45 },
      { x: 1628, y: 375, rx: 70, ry: 60, color: WARM, k: 0.5 },
      { x: 870, y: 80, rx: 120, ry: 110, color: TEAL, k: 0.5 },
    ],
    windows: [[740, -100, 925, 200], [1290, 260, 1400, 545]],
    winSoft: [30, 30],
    shafts: [830, 40],
    mist: [690, 790, 900, 960],
    flash: [830, 160, 700, 520],
    intro: 'fade',
    objects: [
      { id: 'shelves-left', label: 'The shelves left of the ladder', rect: [0, 120, 470, 680] },
      { id: 'clock', label: 'The tall clock', rect: [630, 370, 685, 430] },
      { id: 'mirror', label: 'The mirror', rect: [825, 300, 965, 535] },
      { id: 'diary', label: 'The open diary', rect: [575, 645, 772, 695] },
      { id: 'cabinet', label: 'The locked cabinet', rect: [779, 536, 927, 668] },
      { id: 'globe', label: 'The globe', rect: [1020, 505, 1090, 590] },
      { id: 'angel', label: 'The angel', rect: [1110, 455, 1160, 555] },
      { id: 'bust', label: 'The stone bust', rect: [80, 440, 150, 540] },
      { id: 'bust-right', label: 'The bust on the plinth', rect: [1220, 455, 1275, 535] },
      { id: 'table', label: 'The dusty tabletop', rect: [790, 688, 975, 730] },
      { id: 'shelves-right', label: 'The shelves on the right', rect: [1500, 190, 1665, 700] },
    ],
  },
  crypt: {
    id: 'crypt',
    name: 'The Crypt Beneath',
    art: { url: '/rooms/crypt.webp', w: 1672, h: 941 },
    arjun: { x: 1330, shoulderY: 553, unit: 820 },
    cam: {
      play: { zoom: 1.04, fx: 836, fy: 470 },
      introFrom: { zoom: 1.2, fx: 830, fy: 380 },
      dying: { fx: 1000, fy: 470 },
    },
    lamps: [
      { x: 100, y: 270, rx: 90, ry: 80, color: WARM, k: 0.5 },
      { x: 335, y: 390, rx: 50, ry: 45, color: WARM, k: 0.35 },
      { x: 540, y: 450, rx: 50, ry: 45, color: WARM, k: 0.35 },
      { x: 640, y: 505, rx: 40, ry: 35, color: WARM, k: 0.3 },
      { x: 1100, y: 480, rx: 45, ry: 40, color: WARM, k: 0.3 },
      { x: 1400, y: 390, rx: 70, ry: 60, color: WARM, k: 0.45 },
      { x: 120, y: 760, rx: 90, ry: 70, color: WARM, k: 0.45 },
      { x: 830, y: 20, rx: 200, ry: 90, color: TEAL, k: 0.35 },
    ],
    windows: [[640, -100, 1030, 60]],
    winSoft: [40, 30],
    shafts: [830, -20],
    mist: [640, 720, 900, 960],
    flash: [830, 300, 700, 520],
    intro: 'fade',
    objects: [
      // the six brass plates: the same rects as PLATES in riddles/crypt.ts, a little larger to pick
      { id: 'plate-1', label: 'A brass name plate', rect: [240, 507, 380, 589] },
      { id: 'plate-2', label: 'A brass name plate', rect: [578, 563, 634, 609] },
      { id: 'plate-3', label: 'A small brass name plate', rect: [688, 569, 724, 599] },
      { id: 'plate-4', label: 'A brass name plate', rect: [1493, 546, 1603, 610] },
      { id: 'plate-5', label: 'A brass name plate', rect: [1245, 566, 1295, 612] },
      { id: 'plate-6', label: 'A small brass name plate', rect: [1116, 582, 1154, 612] },
      { id: 'bell', label: 'The iron bell', rect: [760, 100, 960, 320] },
      { id: 'door', label: 'The sealed door', rect: [745, 336, 1045, 636] },
      { id: 'water', label: 'The wet floor', rect: [600, 680, 1500, 920] },
    ],
  },
}

/**
 * Where the witch looms and where her grip lands, from where Arjun stands:
 * the hall's measured offsets, scaled with his size.
 */
export function deathPlaces(room: RoomDef) {
  const { x, shoulderY, unit } = room.arjun
  const k = unit / 680
  return {
    loom: { x: x - 146 * k, y: shoulderY - 191 * k, size: 0.74 },
    dropFrom: -420 * k,
    gripFace: [x - 123 * k, shoulderY - 230 * k] as [number, number],
    gripScale: 0.58 * k,
  }
}
