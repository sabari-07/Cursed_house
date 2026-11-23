# Design: Levels, Treasures, Accounts and Leaderboard

## Overview

Three changes, in this order:

1. **A stage engine.** The single Stage 1 riddle becomes a registry of levels.
   Each level has a room, five stages, rules and a treasure. `HallStage`
   becomes a generic `RoomStage` that plays the current stage of the current
   level.
2. **Accounts and progress.** These are JSON in `localStorage`, plus a
   read-only seed file deployed under `public/data/`.
3. **The landing page:** SIGN IN, CREATE ACCOUNT, LEADERBOARD, the player's
   treasures, and the Level 4 "coming soon" card.

Level 1 is built in full first, in the existing hall. Levels 2 and 3 each need
a room painting from the project owner (prompts are in *Assets*). Each gets its
own spec once its painting exists.

## Architecture

```
            landing page ── sign in / create / leaderboard (accounts.ts)
                 │ ENTER THE BUNGALOW
                 ▼
  progress.ts ──► current { level, stage } ──► levels.ts: LEVELS[level]
                                                   │ room, rules, stages[stage]
                                                   ▼
                       RoomStage (React) ── riddle.generate(seed, rules) ── RiddleRun
                           │                                      │
                           │ question bar, ANSWER, 15 s window    │ scene setup
                           ▼                                      ▼
                     win → next stage in place          RoomScene (HallScene today)
                     5th win → treasure → landing
                     death → witch → landing (resume same stage)
```

| Module | File | Owns |
| --- | --- | --- |
| Level registry | `src/game/levels.ts` | `LEVELS`: room id, name, rules, stage list, treasure |
| Riddles | `src/stage1/riddles.ts` → `src/riddles/*.ts` | One file per riddle; each exports `generate(seed, rules)` and `solve(run)` |
| Progress | `src/game/progress.ts` | Per-account progress, version 2, migration from version 1 |
| Accounts | `src/game/accounts.ts` | Sign-up, sign-in, session, PBKDF2 hashing, the seed-file merge, export |
| Leaderboard | `src/game/leaderboard.ts` | Pure ranking function |
| UI | `src/components/RoomStage.tsx` (from `HallStage.tsx`), `AccountPanel.tsx`, `Leaderboard.tsx`, `TreasureCard.tsx` | |
| Scene | `src/scenes/HallScene.ts` (Level 1) | Later `LibraryScene.ts` and `CryptScene.ts`, sharing the witch death |

## Components and Interfaces

### Levels

```ts
interface LevelRules { timeLimit: number; answerWindow: number; minClues: number; minHerrings: number }
interface LevelDef {
  id: 1 | 2 | 3 | 4
  room: 'hall' | 'library' | 'crypt' | 'attic'
  name: string                       // 'The Grand Hall'
  rules: LevelRules
  stages: RiddleId[]                 // 5 entries; [] for Level 4
  treasure: { id: TreasureId; name: string; line: string } | null
  comingSoon?: true
}
```

| Level | Room | Rules: stage time, answer time, clues, herrings | Stages |
| --- | --- | --- | --- |
| 1 | The Grand Hall | 180 s, 15 s, 2, 1 | blink, clock, word, moved, marked |
| 2 | The Library of Whispers | 150 s, 15 s, 3, 2 | Stage ideas below; its own spec |
| 3 | The Crypt Beneath | 120 s, 12 s, 3, 3 | Stage ideas below; its own spec |
| 4 | The Attic | Coming soon | — |

### New Level 1 riddles

**Stage 4, Who Moved? (answer: a portrait)**

- **Before:** when the stage begins, the wall is lit brightly for 10 s, with the
  prompt "Remember the wall."
- **The swap:** the candles gutter and the room goes black for 1.2 s, with a
  scraping sound. Two seeded portraits have swapped places when the lights
  return.
- **Question:** "In the dark, two portraits swapped places. Which portrait hung
  at the top left before?"
- **Clues:** the remembered wall, plus the empty nail marks. A paler square of
  wallpaper shows where each frame used to hang, and the notes panel mentions
  "the frame is crooked, as if just hung".
- **Red herring:** a third portrait tilts slightly but doesn't move.
- **Fairness:** the before-view always lasts 10 s. The pale squares stay until
  the stage ends.

**Stage 5, The Marked Page (answer: a word)**

- The journal shows five seeded lines. Five letters across them are marked
  with small drops of blood, numbered 1 to 5 in the margin.
- **Question:** "Five letters in the journal are marked with blood. Read them in
  order of their numbers. What word do they spell?"
- **Red herring:** one smudge with no number, on a letter that can't make
  another word from the pool.
- **Second clue (Level 1 needs two):** the numbers are not in the journal. They
  are scratched on the five shelf candles (1 to 5, left to right is NOT their
  order). The journal's drops are colour-matched to the candles' wax.

### Level 2 and Level 3 stage ideas (each detailed in its own spec)

- **Library (Level 2), three clues each:**
  - The Whispered Book: symbols on book spines, with the order from a diary
    and a whisper that lies.
  - Shelf Sums: numbers on red-spined books, minus the ladder rung number.
  - Mirror Writing: a message readable only in the mirror.
  - The Moving Ladder: the shelf letters where the ladder stops.
  - The Ledger: date arithmetic.
- **Crypt (Level 3), three clues and three herrings each:**
  - Who Died Youngest: dates on coffin plates.
  - The Bell: tolls counted by sound, swing and subtitles.
  - The Symbols: the Eye, Raven, Hourglass and Key from earlier stages, mapped
    to a lock.
  - Lightning Writing: a message seen only in flashes, which come every 8 s or
    less.
  - The Final Lock: combines this level's earlier answers.

### Stage flow (`RoomStage`)

1. **Enter the house:** the level's intro plays. The Level 1 intro is the
   current door slam and voice. Levels 2 and 3 get short "deeper into the
   house" intros.
2. **Stage title:** "LEVEL n · STAGE m", then the question bar, ANSWER and the
   timer.
3. **Win, stages 1 to 4:**
   - the room's win beat (in the hall, a portrait falls)
   - a 1.5 s blackout with a scraping or rumble sound
   - a new seed and `setRiddle()` for the next stage
   - the title "STAGE m+1" and the new question

   Nothing reloads, and Arjun stays.
4. **Win, stage 5:** the treasure card. Progress is saved. CONTINUE goes to the
   landing page.
5. **Death:** the witch sequence, then the landing page. Progress keeps the
   same level and stage.

### Accounts (`src/game/accounts.ts`)

```ts
signUp(name: string, password: string): Promise<Account>       // throws NameTaken | BadName | BadPassword
signIn(name: string, password: string): Promise<Account>       // throws BadCredentials (one message)
signOut(): void
current(): Account | null
saveProgress(p: ProgressV2): void                               // for the signed-in account
allPlayers(): Promise<PlayerRow[]>                              // seed file + local accounts, merged by name
exportSeed(): string                                            // development only: JSON without hashes
```

**Hashing:** `crypto.subtle.deriveBits` with PBKDF2, SHA-256, 100,000
iterations and a 16-byte salt from `crypto.getRandomValues`. The hash and salt
are stored as base64. The comparison takes the same time whatever the input.

### Leaderboard (`src/game/leaderboard.ts`)

`rank(rows: PlayerRow[]): RankedRow[]` is a pure function. It sorts by
treasures (descending), then the furthest point reached (`(level - 1) * 5 +
stage`, descending), then the total of the best stage times (ascending), then
deaths (ascending), then the name.

## Data Models

```ts
// localStorage 'ghostwriter_users_v1'
interface UsersFileV1 { version: 1; users: Account[] }
interface Account {
  id: string                     // crypto.randomUUID()
  name: string
  salt: string; hash: string     // base64; never leaves this browser
  createdAt: string              // ISO date
  progress: ProgressV2
}

interface ProgressV2 {
  version: 2
  level: 1 | 2 | 3 | 4           // the level being played (4 = everything done)
  stage: 1 | 2 | 3 | 4 | 5       // the stage being played
  treasures: TreasureId[]        // 'gold-watch' | 'raven-codex' | 'heart-of-the-house'
  bestTimes: Record<string, number>   // 'L1S2' → seconds
  deaths: number
}

// localStorage 'ghostwriter_session_v1'
interface Session { version: 1; userId: string }

// public/data/users.json (deployed, read-only, public)
interface SeedFileV1 { version: 1; players: { name: string; progress: ProgressV2 }[] }
```

**Migration from `ghostwriter_progress_v1`:** `stage1Complete: true` becomes
`{ level: 1, stage: 2 }`. The old key is kept and not deleted.

## Correctness Properties

1. **One answer.** For every level, every stage and 1,000 seeds, `solve(run)`
   returns exactly one answer, and it equals `run.answer`.
2. **Difficulty holds.** Every generated run has at least
   `rules.minClues` clues and at least `rules.minHerrings` red herrings. No red
   herring changes the answer.
3. **Plain English.** Every question passes the existing plain-English check.
4. **Progress only moves forward on a win.** A win at stages 1 to 4 moves one
   stage on. A win at stage 5 advances the level, adds exactly one treasure and
   resets the stage to 1. A death sends the player back to Stage 1 of the same
   level (levels already cleared stay cleared) and counts one death. Over any
   history of wins and deaths, levels never go back, no treasure is lost, and
   every save reads back unchanged. (Changed from the first version, where a
   death changed only `deaths`: the owner asked that a death restart the level.)
5. **Ranking is a total order.** `rank` is deterministic and gives the same
   result for any input order. It never puts a player with fewer levels cleared
   above one with more; with equal levels, never a slower total of level times
   above a faster one. Equal players share a rank.
6. **No secrets in the seed file.** `exportSeed()` output never contains `hash`
   or `salt`. The seed reader ignores those fields if they are present.
7. **Accounts round-trip.** `signUp` and then `signIn` with the same password
   succeeds. Any other password fails with the same error as an unknown name.
8. **Names are unique.** `signUp` refuses a name that differs from an existing
   one only in case or in leading and trailing spaces.

## Error Handling

| Situation | Behaviour |
| --- | --- |
| `users.json` is missing or invalid | The leaderboard shows local accounts only. A quiet note says "Online scores unavailable." |
| The local users JSON is corrupt | It is backed up to `ghostwriter_users_v1_corrupt_<time>`, and a fresh store starts. Nothing is thrown at the player. |
| Web Crypto is unavailable (an insecure HTTP origin) | Sign-up is refused with "Use the https site to create an account." |
| `localStorage` is full or blocked | Play continues as a guest. Progress is not saved, and a notice says so. |
| The next level's painting is missing | The level is shown as "coming soon" instead of crashing. |
| The player reloads during a stage | The run is lost, and the same stage starts with a new seed. Progress only changes on a win or a death. |

## Testing Strategy

- **Unit and property tests (Vitest):**
  - `levels.test.ts`: every level has 5 stages, rules within bounds, and one
    treasure.
  - `riddles/*.test.ts`: Correctness Properties 1 to 3 per riddle and level.
  - `levels.test.ts`: worked examples of Property 4 and the migration.
  - `progress.test.ts`: Property 4 and save reading as property-based tests
    (fast-check): random progress round-trips through JSON, any input (even
    junk) reads as nothing or as valid progress, and random histories of wins
    and deaths keep every rule.
  - `leaderboard.test.ts`: Property 5 as property-based tests (fast-check):
    random boards with ties, in any order.
  - `accounts.test.ts`: Properties 6 to 8 (jsdom with Web Crypto).
- **Browser tests (Playwright, `?seed=` and `?stage=`):**
  - Create an account, sign out, sign in.
  - Play L1S1 and win. The next stage starts in place.
  - Win L1S5, see the treasure card, and get the next level on ENTER.
  - Die, return to the landing page, and resume the same stage.
  - The leaderboard order and the highlighted row.
  - The Level 4 card.
- **Smoothness:** no frame over 300 ms during a stage change in place. Each new
  room's shader variants are measured with `shadercost.cjs`.

## Assets

- **Level 2 room:** a painting of the Library of Whispers, made by the project
  owner in ChatGPT. Prompt:
  > A vast abandoned Victorian library at night, seen from a standing person's
  > eye level, wide shot. Tall dark wooden shelves to the ceiling, a rolling
  > ladder, a reading table with an open diary and a candle, a round stained
  > glass window with cold moonlight, dust in the air, cobwebs. Photorealistic,
  > dark teal and amber palette, no people, no text, 16:9, 2560 x 1440.
- **Level 3 room:** a painting of the Crypt Beneath. Prompt:
  > An underground stone crypt beneath an old mansion, eye level, wide shot.
  > Vaulted ceiling, stone coffins with brass name plates along both walls, an
  > iron bell hanging on a chain, a sealed stone door carved with four symbols
  > (an eye, a raven, an hourglass, a key), candles on the floor, mist, water on
  > the stones. Photorealistic, cold blue-grey with candle amber, no people, no
  > text, 16:9, 2560 x 1440.
- **Treasure images:** a gold pocket watch, a black leather book with a raven
  clasp, and a glowing ruby heart. Each is AI-generated, then keyed out like
  the witch images. Prompts are given when Level 1's treasure card is built.
- Every new file is credited in README (the steering rule).

## Change: a death restarts the level; the leaderboard ranks levels

Requested by the owner. `afterDeath` now sends the player to Stage 1 of the
level they are in (cleared levels and their treasures are kept), and clears
`run`, the seconds spent on the stages won so far in this run. `afterWin` adds
each stage's time to `run`; on Stage 5 the level's time (`levelTimes.L1`, the
best whole-level run) is recorded. The leaderboard ranks levels cleared, then
the sum of the best level times, then deaths, then the name. Where a player is
inside a level no longer counts. Saves from before this change get a level time
from their five stage times when that level was already cleared.
