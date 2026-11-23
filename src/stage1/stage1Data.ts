// Stage 1 — The Hall of Watching Eyes. All puzzle content is data so the
// rules stay deterministic and testable.

export type PortraitId = 'collector' | 'wife' | 'son' | 'caretaker'

export interface PortraitDef {
  id: PortraitId
  /** Image in /public (public-domain paintings, see README). */
  image: string
  imageSize: [number, number]
  /** Where it hangs in the hall painting: corners TL, TR, BR, BL (painting px). */
  quad: [[number, number], [number, number], [number, number], [number, number]]
  /** Eye centres in image px and iris radius (for the eyes that follow you). */
  eyes: [[number, number], [number, number]]
  eyeRadius: number
  /** What is left of the brass name plate. */
  plaque: string
  /** What Arjun notices when he looks closely. */
  details: string[]
}

export const PORTRAITS: PortraitDef[] = [
  {
    id: 'collector',
    image: '/stage1/portraits/collector.jpg',
    imageSize: [960, 1196],
    quad: [[991, 366], [1065, 362], [1065, 452], [991, 455]],
    eyes: [[425, 350], [515, 345]],
    eyeRadius: 15,
    plaque: 'E D · · · D   A S · · W O · · H',
    details: [
      'A broad black hat and a stiff white collar. A man used to being obeyed.',
      'A gold pocket watch lies open in his right hand.',
      'The varnish over his eyes is worn thin, as if someone kept touching them.',
    ],
  },
  {
    id: 'son',
    image: '/stage1/portraits/son.jpg',
    imageSize: [960, 1173],
    quad: [[1093, 361], [1167, 357], [1167, 447], [1093, 451]],
    eyes: [[523, 235], [580, 233]],
    eyeRadius: 10,
    plaque: 'T · · M · S   A · · · W · R T ·',
    details: [
      'A young man in polished armour, long hair over his shoulders.',
      'In his left hand, against the stone, he holds a small key.',
      'Someone has scratched a tiny keyhole into the corner of the canvas.',
    ],
  },
  {
    id: 'caretaker',
    image: '/stage1/portraits/caretaker.jpg',
    imageSize: [673, 768],
    quad: [[991, 472], [1065, 469], [1065, 559], [991, 561]],
    eyes: [[290, 240], [330, 232]],
    eyeRadius: 10,
    plaque: 'S · L · ·   C · · N E',
    details: [
      'An old servant with a white beard, looking up at something above the frame.',
      'He holds an hourglass. The sand has all run to the bottom.',
      'This frame is plainer than the others, as if he was never quite family.',
    ],
  },
  {
    id: 'wife',
    image: '/stage1/portraits/wife.jpg',
    imageSize: [960, 1182],
    quad: [[1093, 468], [1167, 465], [1167, 555], [1093, 558]],
    eyes: [[390, 315], [480, 315]],
    eyeRadius: 14,
    plaque: 'E L · · N · R   · S H · · R · H',
    details: [
      'A young woman in a tartan jacket and a lace cap.',
      'She holds a single white flower against her chest.',
      'There are faint scratches on the glass in front of her face, like fingernails.',
    ],
  },
]

export const NAMES: Record<PortraitId, string> = {
  collector: 'The Collector',
  wife: "The Collector's Wife",
  son: 'The Son',
  caretaker: 'The Caretaker',
}

/**
 * The grandfather's torn journal page. Story only: the riddle's clues are in
 * the hall (see riddles.ts), and the page itself may carry a scratched letter.
 */
export const JOURNAL = {
  title: 'A torn page — your grandfather’s hand',
  lines: [
    'The night the vault was sealed, every clock in this house stopped at once.',
    'The house asks one question of everyone who enters. It asks only once.',
    'Look at everything. The answer is always in the room with you.',
    'Do not trust the first thing you see. Something here is meant to fool you.',
    'And when the candles are gone, so are you.',
  ],
}

export const STAGE1_RULES = {
  /** One answer only: a wrong answer is death. */
  chances: 1,
  /** Seconds of play; the shelf candles burn down with it. */
  timeLimit: 180,
  /** Seconds left when the heartbeat starts and the timer turns red. */
  warnAt: 30,
  /** Once ANSWER is pressed there is no going back: this many seconds to answer. */
  answerWindow: 15,
}

const PROGRESS_KEY = 'ghostwriter_progress_v1'

export interface Progress {
  version: 1
  stage1Complete: boolean
  symbols: string[]
}

export function loadProgress(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null')
    if (p && p.version === 1) return p as Progress
  } catch { /* corrupt save: start fresh */ }
  return { version: 1, stage1Complete: false, symbols: [] }
}

export function saveProgress(p: Progress): void {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(p))
}
