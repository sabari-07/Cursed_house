// The painted rooms' riddles, by id (Level 2 and Level 3).

import { CRYPT_IDS, generateCrypt, solveCrypt } from './crypt'
import { LIBRARY_IDS, generateLibrary, solveLibrary } from './library'
import type { CryptRiddleId, LibraryRiddleId, RoomRiddleId, RoomRun } from './types'

export * from './types'
export const ROOM_RIDDLE_IDS: RoomRiddleId[] = [...LIBRARY_IDS, ...CRYPT_IDS]
export const isRoomRiddle = (id: string): id is RoomRiddleId => (ROOM_RIDDLE_IDS as string[]).includes(id)

export function generateRoomRiddle(seed: number, id: RoomRiddleId): RoomRun {
  return (LIBRARY_IDS as string[]).includes(id) ? generateLibrary(seed, id as LibraryRiddleId) : generateCrypt(seed, id as CryptRiddleId)
}
export function solveRoom(run: RoomRun): string[] {
  return run.room === 'library' ? solveLibrary(run) : solveCrypt(run)
}
