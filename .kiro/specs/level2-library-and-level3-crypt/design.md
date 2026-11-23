# Design: Level 2 (The Library of Whispers) and Level 3 (The Crypt Beneath)

## Overview

Level 1 runs on `HallScene`, which is written for one painting: its shader
knows the hall's portraits, candles and door. Two more rooms would mean two more
copies of that. Instead, this design pulls the parts every room shares into a
`RoomScene`, and describes each room as **data**:

- its painting
- the objects that can be inspected
- the overlays the stages draw
- Arjun's place and the lights

The hall itself stays on `HallScene`, which already works and is tested. It can
move to `RoomScene` later.

## Architecture

```
levels.ts ── LEVELS[2|3]: room id, rules, stage ids
   │
RoomStage (React, from HallStage)
   │  question bar, ANSWER, the answer window, the choice and sequence panels
   │
   ├── riddles/library.ts, riddles/crypt.ts ── generate(seed) → RiddleRun (scene setup + answer)
   │
   └── RoomScene (three.js)
         ├── plate: the painting, cover-fit, with camera drift and inspect zoom
         ├── overlays: drawn from the run's scene setup (canvas textures hung by homography)
         ├── lights: per-room lamps and candles (one flicker value per light)
         ├── ArjunFigure: the shared ArjunModel, rendered and composited (from HallScene)
         └── WitchDeath: the shared death (witch layer, grip, blackout, shatter, blood, from HallScene)
```

| New module | Owns |
| --- | --- |
| `src/scenes/room/RoomScene.ts` | Plate, camera, inspecting, overlays, lights, render loop, precompile |
| `src/scenes/room/rooms.ts` | `ROOMS.library`, `ROOMS.crypt`: objects, overlay areas, lights, Arjun's place (all in painting px) |
| `src/scenes/room/roomShader.ts` | The plate shader and overlay compositing (one loop over N overlays; no per-object copies) |
| `src/scenes/shared/ArjunFigure.ts` | Moved from HallScene: the render target, the lights matched to the room, the halo |
| `src/scenes/shared/WitchDeath.ts` | Moved from HallScene: the DEATH timeline, witch and grip layers, blackout, shatter, blood, sounds |
| `src/riddles/library.ts`, `src/riddles/crypt.ts` | Ten riddles; each exports `generate(seed)` and `solve(run)` |
| `src/components/answers/ChoicePanel.tsx`, `SequencePanel.tsx` | The two new answer kinds |

## Components and Interfaces

### The rooms (painting px, measured on a 50 px grid)

**The library (`library.webp`):**

| Object | Where | Used by |
| --- | --- | --- |
| Shelves by the ladder (left) | x 130–560, y 60–700, 8 rows | Red Books, Whispering Book, Ladder |
| Shelves on the right | x 1020–1250 and 1420–1660, y 200–700 | Red Books (herring), Ladder |
| Rolling ladder | x 200–420, y 20–760 | Wandering Ladder |
| Tall clock face | centre (622, 380), radius 22 | Red Books |
| Mirror glass | x 785–920, y 290–520 | Mirror |
| Wall lamps | (120, 250) (485, 370) (718, 390) (980, 400) (1545, 350) | Red Books, Whispering Book |
| Diary (open, on the table) | x 550–730, y 620–660 | Mirror, Whispering Book, Cabinet |
| Locked cabinet | x 740–880, y 505–640, keyhole (802, 575) | Locked Cabinet |
| Globe, angel statue, two busts | (1000, 520) (1075, 480) (105, 470) (1190, 470) | Locked Cabinet (symbols) |
| Arched window (right) | x 1290–1400, y 260–540 | Mirror (herring writing) |
| Arjun | open floor, centre x 1260, feet at y 880 | |

**The crypt (`crypt.webp`):**

| Object | Where | Used by |
| --- | --- | --- |
| Name plates (6, blank brass) | left: (295, 520) 130×75, (575, 555) 45×40, (665, 575) 25×25; right: (1470, 545) 100×55, (1210, 560) 55×45, (1120, 570) 30×25 | Who Died Youngest, Order of the Dead, Sealed Door |
| Bell | body x 735–905, y 110–290; clapper (818, 295) | The Bell |
| Sealed door | centre (830, 470), radius 150; eye (795, 425), raven (895, 425), hourglass (800, 520), key (885, 525) | Order of the Dead, Sealed Door |
| Candles | candelabras at (100, 270) (335, 390) (540, 450) (640, 505) (1100, 480) (1230, 480) (1400, 390); floor at (120, 760) (550, 680) | The Bell |
| Wet floor | x 600–1500, y 680–900 | Words in the Water |
| Arjun | open floor, centre x 1180, feet at y 900 | |

### Level 2 riddles (at least 3 clues and 2 herrings each)

| # | Riddle | Question (plain English) | Clues | Red herrings | Answer |
| --- | --- | --- | --- | --- | --- |
| 1 | **The Red Books** | "Count the red books on the shelves beside the ladder. Add the hour on the tall clock. Take away the lamps that are not lit. What is the number?" | R red spines (3 to 7) on the left shelves; the tall clock's hour H; U unlit lamps (1 to 3) of 5 | Red books on the right-hand shelves; a lamp's flame reflected in the mirror | R + H − U |
| 2 | **The Mirror** | "A word is written backwards in the dust on the mirror. A hand wiped one letter away. The diary underlines the missing letter. What is the word?" | Mirrored letters on the glass; the gap left by the handprint; the underlined letter in the diary | A four-letter word scrawled on the arched window; a second underline in the diary that isn't a letter (a date) | The 5-letter word |
| 3 | **The Whispering Book** | "A voice tells you which book to take. Do not trust it. The diary says where the right book is. Which book is it?" | The diary: "directly above the lamp that is out"; which lamp is out; the symbol on the spine above it | The whisper names the wrong book (also in subtitles); a book with the same symbol on another shelf, not above a lamp | One of 4 spine symbols (raven, moon, key, crown) |
| 4 | **The Wandering Ladder** | "The ladder moved on its own. Read the shelf number where it started and where it stopped. What is the difference?" | The ladder's place at the start (shown for 8 s); where it stops; the brass numbers on the shelf ends | A book falls from another shelf as it moves; a number scratched on the floor | The two numbers' difference |
| 5 | **The Locked Cabinet** | "The cabinet opens with four symbols. The diary lists them, but the pages are out of order. The page numbers tell the order. What is the order?" | Four torn diary pages, each with a symbol and a page number; the four symbols on the globe, angel and busts | A fifth page with no number; a symbol on the cabinet itself that isn't in the lock | A sequence of 4 symbols |

### Level 3 riddles (at least 3 clues and 3 herrings each)

| # | Riddle | Question (plain English) | Clues | Red herrings | Answer |
| --- | --- | --- | --- | --- | --- |
| 1 | **Who Died Youngest** | "Each coffin has a name, and the years of birth and death. Who died the youngest?" | Six plates, each with a name and born–died years; the small far plates must be inspected | Two people died in the same year; one plate has wax over its death year, and the year is cut again lower on the same plate; one plate says "aged" with a number that is a decoy (the age of the coffin) | One of 6 names |
| 2 | **The Bell** | "The bell will ring. Count the rings. Add the candles on the coffin nearest to you. Take away the candles that go out. What is the number?" | The rings (heard, the bell swings, and the subtitles count them); the candles on the nearest coffin; the candles that go out, with smoke | A quieter echo after the last ring (subtitled "(echo)"); a candle seen only in its reflection in the water; a candle that flickers but does not go out | rings + candles − out |
| 3 | **Words in the Water** | "Letters show in the wet floor where candlelight falls. They read upside down. What word do they spell?" | Upside-down letters in the reflections; their order (near to far); a missing letter that shows only while a candle on that side burns brighter | Letters drawn in the mist that move (not in the water); a reflection of the door symbols; one letter twice as large that belongs to no word | A 5-letter word |
| 4 | **The Order of the Dead** | "The door opens with its four symbols in the right order. The dead decide the order: oldest grave first. What is the order?" | Each plate has a small symbol and a death year; the door's symbols; the oldest year comes first | A plate with a symbol but no year; two symbols scratched on the floor; a plate whose name matches a portrait in the hall | A sequence of 4 symbols |
| 5 | **The Sealed Door** | "The Collector sealed this door the year he vanished. His plate gives his birth year. The door says how old he was. What year was it sealed?" | The Collector's plate (born year); the age carved on the door's rim; both must be added | His son's plate with a similar year; the hall clock's hour (an earlier riddle's number); a year on the bell | birth year + age |

### Answer kinds

The kinds now are `number | word | choice | sequence`. The `portrait` kind is
kept and becomes a choice whose options are the four portraits.

- **`ChoicePanel`** gets `{ id, label, image? }` options.
- **`SequencePanel`** gets four symbol options and fills four slots.

`checkAnswer` compares choices by id, and sequences as ids joined with `-`.

### RoomScene interface (the same calls HallStage makes on HallScene)

`start()`, `startPlay()`, `setRiddle(setup)`, `setWax(left)`, `inspect(objectId | null)`,
`pick(x, y)`, `anchor(target)`, `setPointer`, `setHover`, `heartbeat()`, `solve()`,
`fail()`, `nextStage()`, `setReducedMotion()`, `resize()`, `dispose()`.

Room-specific events, such as the ladder rolling, the bell ringing, a candle
going out or the whisper, come from the scene setup. They are played on the
audio clock, with subtitles sent to the UI through `onEvent('subtitle', text)`.

## Data Models

```ts
// rooms.ts
interface RoomDef {
  id: 'library' | 'crypt'
  art: { url: string; w: number; h: number }
  arjun: { x: number; feetY: number; unit: number; turn: number }
  objects: { id: string; label: string; rect: [number, number, number, number]; zoom: number }[]
  lights: { id: string; x: number; y: number; r: number; color: [number, number, number] }[]
  /** Areas that overlays can be drawn into: four corners in painting px. */
  surfaces: Record<string, Quad>
}

// the scene setup a room riddle hands to RoomScene
interface RoomSetup {
  overlays: { surface: string; kind: 'text' | 'spine' | 'symbol' | 'mirrorText' | 'waterText'; text?: string; color?: string; u: number; v: number; h: number }[]
  lights: Record<string, number>                  // 1 lit, 0 out
  events: { at: number; kind: 'ring' | 'echo' | 'snuff' | 'ladder' | 'whisper' | 'fall'; target?: string; text?: string }[]
  clock?: { hour: number; minute: number }
  ladder?: { from: number; to: number }
}
```

`RiddleRun` gains a `room` field and `kind: 'choice' | 'sequence'`, plus
`options` for choices.

## Correctness Properties

For each of the ten riddles, over 1,000 seeds:

1. **One answer.** `solve(run)` uses only the scene setup, and returns exactly
   one answer, which equals `run.answer`.
2. **Clues and herrings.** The setup contains at least the level's minimum
   number of clues and red herrings. Removing any one clue gives either no
   answer or more than one, so every clue is needed.
3. **No herring gives another answer.** Swapping in any herring never produces
   a different valid answer.
4. **Plain English.** The question passes the plain-English check (common
   words, sentences of at most 20 words).
5. **Readable.** Every text overlay is at least 9 px high in the wide view, or
   it sits on an inspectable object and is at least 30 px high when inspected.
6. **Heard clues are also seen.** Every audio clue has a visible event and a
   subtitle at the same time on the audio clock.
7. **Dates make sense.** Births come before deaths, and ages at death are
   between 1 and 99. No two people share a death year when the question asks
   for an order.

## Error Handling

| Situation | Behaviour |
| --- | --- |
| A room painting fails to load | The level shows "coming soon" again, and nothing crashes. |
| Audio is off or blocked | The bell, the whisper and the candles still show their events and subtitles. The riddles stay solvable. |
| A room shader is still compiling when play starts | The draw waits for the compile already under way. Precompiling during the intro keeps this rare. |
| An overlay would fall outside its surface | It is clamped inside. The tests check that every overlay fits. |

## Testing Strategy

- **Unit and property tests:** `riddles/rooms.test.ts` checks Correctness
  Properties 1 to 7 for all ten library and crypt riddles over 1,000 seeds each. The answer-kind tests cover choices and sequences.
- **Browser tests:** for each level, play all five stages through the real UI
  using a fixed seed. Capture every clue close up and check that each one can
  be read. Check one death and the resume. Check the treasure, and that Level 4
  shows "coming soon". Log frame gaps over 300 ms.
- **Compile cost:** run `shadercost.cjs` on the room shader. It must compile in
  under 2 s, and before play can start.

## Assets

- **The library and the crypt:** the owner's paintings (credited).
- **New sounds** (Pixabay, credited before use):
  - a bell toll
  - a whisper, or the existing voice slowed down and filtered
  - a ladder rolling on a rail
  - a book falling
  - a candle snuffed
- **Treasure images:** the Raven Codex and the Heart of the House,
  AI-generated by the owner (prompts will be given), cut out and credited.

## Decisions made while building

- **One room renderer.** Instead of a new `RoomScene` with `ArjunFigure` and
  `WitchDeath` modules, `HallScene` takes a room id and reads everything
  room-specific from `scenes/room/rooms.ts`. Level 1 keeps running on tested
  code, and the death is the same in every room. The shader picks variants by
  define: `HALL_PLAY` (the hall's portraits, candles, journal) and `ROOM_PLAY`
  (lamps, overlays, the room's clock, the bell swing), with `OV_N` overlays (8
  in the hall, 16 in the rooms).
- **The Falling Books replaces The Wandering Ladder.** The ladder is part of
  the painting and can't move convincingly. The new stage keeps the same idea
  (remember the room, something changes in the dark, read the shelf numbers):
  the shelves are shown for 10 s, books fall in the dark (heard, and subtitled
  "A book falls."), and the answer is the sum of the brass numbers of the
  shelves with new gaps. Traps: a gap that was there before, a number scratched
  in the floor, old books lying by the right-hand shelves.
- **Clues in two places.** Every clue is drawn on the painting (overlays) and
  also stated in plain words in the inspect panel, so small brass plates stay
  fair. The panel opens on the side away from the object.
- **The crypt's question bar sits top left**, because the bell (a clue) hangs
  top centre. Its subtitles show at the top.
- **The library's trap word** is written in the dust on the tabletop, not on
  the round window, which the question bar covers.
- **Events run on the audio clock.** `HallScene.runEvents()` schedules each
  sound on the AudioContext and fires the picture (bell swing, a flame going
  out, a gap appearing, a letter flaring) and its subtitle when that clock
  reaches it. Without sound, the same events run on the page clock.
