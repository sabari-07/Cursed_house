# Design: Stage 1 — The Riddle of the Hall

## Overview

One question, one chance, 180 seconds. A seed picks a riddle and its values at
the start of every run. The riddle module returns two things:

- what the React UI shows (question, answer kind, right answer, explanation)
- what `HallScene` must draw so the answer can be found (clock time, lit
  candles, scratched letters, which portraits blink)

The rules are pure functions, so they can be tested without a browser.

### What stays and what goes

| Kept | Removed |
| --- | --- |
| Cinematic, title card, SKIP | Portrait ordering, `SOLUTION`, `checkOrder` |
| Hall shader, portraits, eyes that follow the cursor | Lock with four slots |
| Inspect zoom and notes panel | Three lives (one chance now) |
| Journal page on the pedestal (now a clue surface) | Wrong-answer laugh and red eyes |
| Study door, THE EYE, save format | |
| Witch death and return to the landing page | |

## Architecture

```
seed ──► generateRiddle(seed) ──► RiddleRun
                                   ├─ question / short / kind / answer / explain ──► HallStage (HUD, answer panel, GAME OVER)
                                   └─ scene: SceneSetup ─────────────────────────► HallScene.setRiddle()
```

| Layer | File | Owns |
| --- | --- | --- |
| Rules | `src/stage1/riddles.ts` | Seeded RNG, the three riddles, `checkAnswer`, `solve` |
| Rules | `src/stage1/stage1Data.ts` | Portraits, journal text, `STAGE1_RULES`, versioned save |
| UI | `src/components/HallStage.tsx` | Phases, timer, question card, HUD, answer panel, confirmation, win and GAME OVER |
| Scene | `src/scenes/HallScene.ts` | Drawing the clues, blink timing, inspect camera, death sequence |
| Shader | `src/scenes/hall/hallShader.ts` | Portraits, lids, clock, candles, scratches |
| Art | `src/scenes/hall/riddleArt.ts` | Clock face URL, scratch-letter atlas |

**Run lifetime:**

1. `HallStage` makes the run once, when it mounts (`makeRun`). A new seed is
   chosen every time the hall is entered.
2. When the title ends, or SKIP is pressed, `HallScene.startPlay()` and then
   `setRiddle(run.scene)` are called.
3. The answer is checked in React with `checkAnswer`. The scene only hears
   `solve()` (win) or `fail()` (death).

In development, `?seed=123&riddle=clock` reproduces a run, for tests and
screenshots.

## Components and Interfaces

### The riddles

All three need at least two clues and contain a red herring (Requirement 2).

#### 1. The Stopped Clock (answer: a number)

- **Question:** "The clock stopped on the night the Collector vanished. Add the
  hour on the clock to the number of candles still burning. What is the number?"
- **Short form:** "Clock hour + burning candles = ?"
- **Seeded values:**
  - The clock's hour H, from 1 to 12. The minute is 0, 10 or 20, so the hour
    hand clearly points at H.
  - Five candles on the shelf. L of them are lit (2 to 4), and the rest are cold
    stubs.
- **Answer:** H + L, which ranges from 3 to 16.
- **Clues:**
  - The wall clock, which can be read best when inspected up close.
  - The candles, which can be counted from the wide view.
- **Red herring:** the Collector's pocket watch. His notes say it shows a
  different hour, which never equals H.
- **Explanation on GAME OVER:** "The clock said H o'clock and L candles were
  burning: H + L = N."

#### 2. The Scratched Word (answer: a word)

- **Question:** "Someone scratched a five-letter word into this hall. There is
  one letter in each place, with a small number next to it. Find all five
  letters and spell the word."
- **Short form:** "Find the 5 letters with numbers."
- **Seeded values:**
  - **The word:** one of GHOST, GRAVE, CURSE, WITCH, BLOOD, NIGHT or DEATH.
  - **The surfaces:** five of the eight surfaces below are chosen. Each gets one
    letter and its number, 1 to 5.
  - **Placement:** a random spot on each chosen surface.
- **Surfaces:**
  - the four portrait frames
  - the journal page
  - the study door
  - the clock rim
  - the stone newel at the foot of the banister
- **Clues:**
  - At least two letters are on portrait frames, which can only be read when
    the portrait is inspected.
  - At least one letter can be read from the wide view.
- **Red herring:** a sixth scratched letter with no number. It can't be swapped
  in to spell another word from the pool.
- **Answer input:** five letter wheels.
- **Explanation on GAME OVER:** "The letters 1 to 5 spelled WORD."

#### 3. The One Who Blinks (answer: a portrait)

- **Question:** "Two of the portraits blink, but only when you are not looking at
  them. Of those two, choose the one who PROPERTY."
- **Short form:** "Two blink. Which one PROPERTY?"
- **Property:** one of the following. Each is clear from the portrait and its
  notes.
  - "holds something that measures time": the Collector (watch) and the
    Caretaker (hourglass)
  - "holds something that opens a lock": the Son (key)
  - "holds a flower": the Wife
- **Seeded values:**
  - The property.
  - The answer: a portrait that has the property.
  - The decoy: a second blinker that does not have it.
- **Blinking:**
  - A blinker's lids close every 3 to 6 seconds, for 250 ms.
  - It only blinks while the cursor is more than 150 screen px from its frame,
    and never while anything is being inspected.
- **Seen from afar:** each painted eye has a pin-point catch-light that goes out
  while the lids are closed.
- **Red herring:** candlelight slides across a third portrait's glass every 4 to
  8 seconds. That is not a blink.
- **Explanation on GAME OVER:** "NAME and NAME blinked. Only NAME PROPERTY."

### Rules interface (`src/stage1/riddles.ts`)

```ts
export function generateRiddle(seed: number, id?: RiddleId): RiddleRun  // without id, the seed picks the riddle
export function checkAnswer(run: RiddleRun, given: string): boolean     // trims, ignores case, rejects ''
export function solve(run: RiddleRun): string[]                         // every answer the clues allow, from run.scene (+ run.property)
export function rng(seed: number): () => number                         // mulberry32
export function newSeed(): number                                       // crypto.getRandomValues
```

Nothing in the rules calls `Math.random()`, so a seed always reproduces the
same run.

### Scene interface (`HallScene`)

| Method | Called by | Does |
| --- | --- | --- |
| `startPlay()` | HallStage, when the question is shown | Stops the intro sounds and switches to play mode |
| `setRiddle(setup)` | HallStage, right after `startPlay` | Sets the clock hands, candle flags and stubs, scratch atlas and placements, blinkers and glint |
| `setWax(left)` | HallStage, every second | Burns the lit candles down with the timer |
| `inspect(i)` / `inspectClock(on)` | HallStage | Moves the camera close, dims everything else |
| `heartbeat()` | HallStage, in the last 30 s | One heartbeat and a short dip in the lights |
| `solve()` / `fail()` | HallStage, after the confirmed answer | Win sequence, or the witch death |

The new pick target is `{ kind: 'clock' }`. Its position comes from `CLOCK`,
painting px `{ x: 742, y: 392, r: 21 }`, on the misty wall between the study
door and Arjun.

### Shader (`hallShader.ts`, `HALL_PLAY` variant)

- **`uCandleLit[5]`, `uCandleWax[5]`, `uCandleSmoke[5]`:** the five shelf
  candles, drawn in a loop.
- **`uBlink`, `uGlint` (vec4, one component per portrait):** lid closure and
  glass sheen.
- **`uClock`:** centre, radius and visibility. **`uClockHands`:** hour and
  minute angles. **`uClockTex`:** the painted dial.
- **`uScr[6]`, `uScrN`, `uScratchTex`:** where each scratched letter goes
  (centre, height and angle in painting px). Every letter comes from one
  6-cell atlas.

### UI (`HallStage.tsx`)

- **Phases:** `intro | title | question | play | won | dead`. The confirmation
  is a state inside `play`, so the timer keeps running.
- **Question card:** stays for 6 s, or until it is clicked or BEGIN is pressed.
- **HUD:** the timer (red and pulsing under 30 s), a ONE CHANCE badge, JOURNAL,
  and the short question.
- **Answer panel (study door):**
  - **Number:** a two-digit keypad, or the number keys.
  - **Word:** five letter wheels, or typing and the arrow keys.
  - **Portrait:** the four faces.
- **Confirmation:** "You have one chance. Is this your answer?" with NOT YET
  and YES.
- **Win card:** "STAGE 1 COMPLETE" with the explanation. Until Stage 2 exists,
  CONTINUE returns to the landing page with the progress saved.
- **GAME OVER:** shows the right answer and the explanation.

## Data Models

```ts
export type AnswerKind = 'number' | 'word' | 'portrait'
export type RiddleId = 'clock' | 'word' | 'blink'
export type SurfaceId =
  | 'frame-collector' | 'frame-wife' | 'frame-son' | 'frame-caretaker'
  | 'journal' | 'door' | 'clock' | 'banister'

export interface Scratch {
  surface: SurfaceId
  letter: string
  number: number | null        // 1..5, or null for the red herring
  u: number; v: number         // where on the surface, 0.15..0.85
}

export interface SceneSetup {
  clock: { hour: number; minute: number }      // shown in every run
  candles: boolean[]                            // 5 entries: lit, or a cold stub
  scratches: Scratch[]                          // 6 in the word riddle, else empty
  blinkers: PortraitId[]                        // 2 in the blink riddle, else empty
  flicker: PortraitId | null                    // the glass-sheen red herring
  notes: Partial<Record<PortraitId, string[]>>  // seeded notes (the pocket watch hour)
}

export interface RiddleRun {
  id: RiddleId
  seed: number
  kind: AnswerKind
  question: string
  short: string
  answer: string                // '12', 'GHOST', or a portrait id
  explain: string
  property: BlinkProperty | null
  scene: SceneSetup
}
```

- **Rules (`STAGE1_RULES`):** `{ chances: 1, timeLimit: 180, warnAt: 30 }`.
- **Save:** unchanged. `localStorage` key `ghostwriter_progress_v1` holds
  `{ version: 1, stage1Complete, symbols }`, and a win adds `eye`.

## Correctness Properties

These hold for every seed. The tests check each one over 1,000 seeds per riddle.

1. **One answer.** `solve(run)` returns exactly one answer, and it equals
   `run.answer`. The scene alone determines the answer.
2. **Reproducible.** `generateRiddle(s, id)` deep-equals `generateRiddle(s, id)`.
3. **Two clues.**
   - **Clock:** 2–4 of the 5 candles are lit, and the answer is the hour plus
     the lit count.
   - **Word:** at least two numbered letters are on portrait frames, and at
     least one is readable from the wide view.
   - **Blink:** exactly one of the two blinkers has the property.
4. **The red herrings never give another answer.**
   - **Clock:** the pocket watch hour is never the clock's hour.
   - **Word:** the extra letter is not in the word, and swapping it into any
     position never spells another word from the pool.
   - **Blink:** the glinting portrait is never a blinker.
5. **Readable clock.** The minute is at most 20, so the hour hand never sits
   between two hours.
6. **Plain English.** No sentence is longer than 20 words. Every word is on a
   short list of common words. No placeholder is left in the text.
7. **Fair checker.** `checkAnswer` accepts the answer in any case with spaces
   around it, and rejects the empty string and every other number, word or
   portrait.
8. **Not memorisable.** Answers vary across seeds (more than 2 distinct
   answers per riddle), and every portrait can be the blink answer.

## Error Handling

| Situation | Behaviour |
| --- | --- |
| A riddle shader hasn't finished compiling when play starts or the player dies | The draw waits for the compile already under way (no second compile); this costs at most a short pause. The play variant is ready within about 2 s of entering the hall, the death variant within about 18 s. |
| A shader fails to compile | three.js logs it, and the material is compiled again on its first draw (`precompile` catches the error). |
| The clock face image fails to load | The dial is blank, but the hands are still drawn on it, so the clock riddle can still be answered. |
| The audio fails, or is blocked until a user gesture | The intro falls back to the performance clock after 2.5 s. Heartbeats and the death sounds are skipped, and the visuals still run. |
| The answer is submitted with an empty input | GIVE THIS ANSWER stays disabled (a number needs a digit; a word needs five letters; a portrait needs a choice). |
| The player opens a panel when time runs out | The timer keeps running. At zero, every panel closes and the death starts. |
| The save is corrupt or from another version | `loadProgress` returns a fresh state instead of throwing. |
| `?seed` or `?riddle` is invalid (development only) | An unknown riddle is ignored and the seed picks one. The seed is coerced to an unsigned 32-bit number. |

## Testing Strategy

**Unit and property tests (`npm test`, Vitest):**

- **`riddles.test.ts`:** every property in *Correctness Properties*, over
  1,000 seeds per riddle, plus the RNG's range and spread.
- **`stage1Data.test.ts`:** the rules constants, the journal free of the old
  ordering clues, save round-trips and corrupt-save fallback.

**In the browser** (Playwright with headless Chrome on ANGLE/Direct3D,
`?seed=` and `?riddle=` for fixed runs):

- **The full flow, for each riddle:**
  - SKIP → question card → BEGIN → HUD
  - study door → answer panel → confirmation
  - win card and save, or death, GAME OVER with the answer, and the return to
    the landing page
- **The clues:**
  - Crops of the candles, the clock, the door and the newel, in the wide view.
  - Inspect close-ups of the clock and of every portrait frame that holds a
    letter.
  - Blinks counted over 10 s with the cursor far away (only the blinkers may
    blink), and over 8 s with the cursor on a blinker (it must not blink).
- **Smoothness:** frame gaps over 250 ms, logged with the mode and which
  shader variants are ready. The target is no gap over 300 ms in play.
- **Compile cost:** the first-draw compile time of each shader variant
  (`shadercost.cjs`). Any new clue must not put back a long freeze.

### Shader compile time (Direct3D)

ANGLE on Windows inlines every function call before Direct3D compiles the
shader, so repeated calls multiply its size. Two rules keep Stage 1 free of
freezes:

- **One copy of the code per object type.** Each pixel finds which portrait it
  is in, then calls `portrait()` once. The candles and the scratched letters
  are loops.
- **Compile off the main thread during the intro.** The play and death
  variants compile there. The clock face is uploaded before play can begin.

Measured first-draw compile times: play went from 2.5 s to 1.2–1.9 s, and death
from 5.3 s to 3.6 s. With SKIP pressed at the earliest moment, no frame took
longer than 440 ms.

## Assets

- **Clock face:** `public/stage1/clock-face.webp`, a painted dial with no hands
  and plain numbers 1–12, AI-generated by the project owner and credited in
  README. The hands are drawn in the shader, so the time can be seeded.
- **Scratched letters:** drawn on a canvas at run time (no file).
- No new sound. The heartbeat and the witch sounds already exist.
