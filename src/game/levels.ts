// The level registry: one room per level, five stages per level, the rules
// that make each level harder, and the treasure it awards.
// See .kiro/specs/levels-and-leaderboard.

export type LevelId = 1 | 2 | 3 | 4
export type StageNo = 1 | 2 | 3 | 4 | 5
export type RoomId = 'hall' | 'library' | 'crypt' | 'attic'
export type TreasureId = 'gold-watch' | 'raven-codex' | 'heart-of-the-house'

export interface LevelRules {
  /** Seconds to find the answer. */
  timeLimit: number
  /** Seconds to answer once ANSWER is pressed. */
  answerWindow: number
  /** Clues every answer needs, at least. */
  minClues: number
  /** Red herrings every stage plants, at least. */
  minHerrings: number
  /** Seconds left when the heartbeat starts and the timer turns red. */
  warnAt: number
}

export interface Treasure {
  id: TreasureId
  name: string
  line: string
  /** Image shown on the reveal card (credited in README). */
  image: string
}

export interface LevelDef {
  id: LevelId
  room: RoomId
  name: string
  rules: LevelRules
  /** Riddle ids, stage 1 to 5. */
  stages: string[]
  treasure: Treasure | null
  /** False until the room exists (its painting and scene): the level shows as "coming soon". */
  ready: boolean
}

export const TREASURES: Record<TreasureId, Treasure> = {
  'gold-watch': {
    id: 'gold-watch',
    name: "The Collector's Gold Watch",
    line: 'It stopped the night he vanished. It has been waiting for you.',
    image: '/stage1/clock-face.webp',
  },
  'raven-codex': {
    id: 'raven-codex',
    name: 'The Raven Codex',
    line: 'His book of secrets, bound in black, closed with a raven clasp.',
    image: '/treasures/raven-codex.webp',
  },
  'heart-of-the-house': {
    id: 'heart-of-the-house',
    name: 'The Heart of the House',
    line: 'The ruby that kept the house alive. It is still warm.',
    image: '/treasures/heart-of-the-house.webp',
  },
}

export const LEVELS: Record<LevelId, LevelDef> = {
  1: {
    id: 1, room: 'hall', name: 'The Grand Hall',
    rules: { timeLimit: 180, answerWindow: 15, minClues: 2, minHerrings: 1, warnAt: 30 },
    stages: ['blink', 'clock', 'word', 'moved', 'marked'],
    treasure: TREASURES['gold-watch'],
    ready: true,
  },
  2: {
    id: 2, room: 'library', name: 'The Library of Whispers',
    rules: { timeLimit: 180, answerWindow: 15, minClues: 3, minHerrings: 2, warnAt: 30 },
    stages: ['redbooks', 'mirror', 'whisper', 'falling', 'cabinet'],
    treasure: TREASURES['raven-codex'],
    ready: true,
  },
  3: {
    id: 3, room: 'crypt', name: 'The Crypt Beneath',
    rules: { timeLimit: 180, answerWindow: 12, minClues: 3, minHerrings: 3, warnAt: 30 },
    stages: ['youngest', 'bell', 'water', 'order', 'sealed'],
    treasure: TREASURES['heart-of-the-house'],
    ready: true,
  },
  4: {
    id: 4, room: 'attic', name: 'The Attic',
    rules: { timeLimit: 120, answerWindow: 12, minClues: 3, minHerrings: 3, warnAt: 30 },
    stages: [],
    treasure: null,
    ready: false,
  },
}

/** The stage names shown on the title card ("LEVEL 1 · STAGE 2 · The Stopped Clock"). */
export const STAGE_TITLES: Record<string, string> = {
  blink: 'The One Who Blinks',
  clock: 'The Stopped Clock',
  word: 'The Scratched Word',
  moved: 'Who Moved?',
  marked: 'The Marked Page',
 redbooks: 'The Red Books',
 mirror: 'The Mirror',
 whisper: 'The Whispering Book',
 falling: 'The Falling Books',
 cabinet: 'The Locked Cabinet',
 youngest: 'Who Died Youngest',
 bell: 'The Bell',
 water: 'Words in the Water',
 order: 'The Order of the Dead',
 sealed: 'The Sealed Door',
}

/** Can this level be played now? */
export const playable = (level: LevelId): boolean => LEVELS[level].ready && LEVELS[level].stages.length === 5
