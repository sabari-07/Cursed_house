# Implementation plan: Level 2 (The Library of Whispers) and Level 3 (The Crypt Beneath)

> Changed during the build (see design.md, "Decisions made while building"):
> one room renderer (`HallScene` with room data) instead of separate
> `RoomScene` / `ArjunFigure` / `WitchDeath` modules, and **The Falling Books**
> instead of The Wandering Ladder.

- [x] 1. Share Arjun and the witch death
  - `HallScene` takes a room id; Arjun's place, the camera, the witch's loom and
    grip come from `scenes/room/rooms.ts` (`deathPlaces`). Level 1's browser
    test still passes; its frames match the earlier baseline.
  - _Requirements: 1.2, 1.3_

- [x] 2. The painted rooms
  - `rooms.ts`: the library and the crypt (painting, lamps, windows, mist,
    objects measured on a 50 px grid). Shader: lamps as an array of 8, overlays
    in one loop (16 in the rooms, 8 in the hall), the room's own clock, the bell
    swing. Fade-in intro with the room's sound (whispers, or one bell toll).
  - _Requirements: 1.1, 1.4, 1.5_

- [x] 3. Choice and sequence answers
  - `components/answers/ChoicePanel.tsx`, `SequencePanel.tsx`, `SymbolIcon.tsx`;
    `checkRoomAnswer` (choice ids, sequence ids joined with `-`; numbers up to 4
    digits for a year).
  - _Requirements: 5.1–5.3_

- [x] 4. Level 2 riddles and tests
  - `riddles/library.ts`: Red Books, Mirror, Whispering Book, Falling Books,
    Locked Cabinet. `riddles/rooms.test.ts`: Properties 1–7 over 1,000 seeds.
  - _Requirements: 3, 6.1–6.4_

- [x] 5. Level 2 in the browser
  - Spines, unlit lamps, mirror dust, the whisper with subtitles, the books
    falling in the dark, the brass shelf numbers, the cabinet pages. Level 2 is
    `ready`; a full run through the real UI passes with no frame over 300 ms.
  - _Requirements: 2, 3, 6.2–6.3_

- [x] 6. Level 3 riddles and tests
  - `riddles/crypt.ts`: Who Died Youngest, The Bell, Words in the Water, Order
    of the Dead, The Sealed Door, with the same property tests.
  - _Requirements: 4, 6.1–6.4_

- [x] 7. Level 3 in the browser
  - Plates, the bell's swing and rings with subtitles, candles going out, water
    letters and the flare, the door rim. Level 3 is `ready`; a full run passes.
  - _Requirements: 2, 4, 6.2–6.3_

- [x] 8. Treasures for Levels 2 and 3
  - The Raven Codex and the Heart of the House images (prompts given to the
    owner), keyed and credited. Until then the treasure card shows an empty gold ring.
  - _Requirements: 7_

- [x] 9. Sounds
  - Bell toll, whispers, book fall and candle snuff from Pixabay, trimmed and
    credited in README. (No ladder sound: The Falling Books replaced the ladder.)

- [x] 10. README and Kiro write-up (levels, riddles, tests, and the decisions in design.md)
