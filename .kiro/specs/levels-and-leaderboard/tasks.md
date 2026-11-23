# Implementation plan: Levels, Treasures, Accounts and Leaderboard

- [x] 1. Level registry and progress model
  - `src/game/levels.ts` (Levels 1–4, rules, treasures) and
    `src/game/progress.ts` (ProgressV2, win/death transitions, migration from
    `ghostwriter_progress_v1`).
  - Tests: `levels.test.ts` (examples, migration), `progress.test.ts` (Property 4, fast-check).
  - _Requirements: 1.1, 3.1, 4.1, 5.1–5.4_

- [x] 2. Accounts in the browser
  - `src/game/accounts.ts`: sign-up, sign-in, session, PBKDF2 hashing, corrupt-
    store backup, the seed-file merge, dev-only export.
  - `public/data/users.json` seed (a few starter rows, no secrets).
  - Tests: `accounts.test.ts` (Properties 6–8).
  - _Requirements: 6.1–6.8, 8.2_

- [x] 3. Leaderboard
  - `src/game/leaderboard.ts` `rank()` plus `leaderboard.test.ts` (Property 5, fast-check) and examples in `accounts.test.ts`.
  - _Requirements: 7.2_

- [x] 4. Landing page: account, leaderboard, treasures, Level 4 card
  - `AccountPanel.tsx`, `Leaderboard.tsx`; ENTER THE BUNGALOW needs a signed-in
    player and opens the current level; Level 4 shows "Coming soon".
  - _Requirements: 1.4, 4.4, 6.1, 6.5, 6.6, 7.1–7.4_

- [x] 5. Stage engine in the hall
  - `HallStage` → `RoomStage`: plays `LEVELS[level].stages[stage]` with the
    level's rules; "LEVEL n · STAGE m" title; win → in-place stage change
    (blackout, new seed, `setRiddle`); stage 5 → treasure card; death → resume.
  - Level 1 order: blink, clock, word, then 6 and 7 below.
  - _Requirements: 1.2, 1.3, 2.1, 2.2, 3.1, 4.2, 4.3, 5.2_

- [x] 6. Level 1 Stage 4: Who Moved?
  - Riddle + tests; "remember the wall" phase; the swap in the dark; pale
    squares; the tilting herring.
  - _Requirements: 2.1, 3.1–3.2_

- [x] 7. Level 1 Stage 5: The Marked Page
  - Riddle + tests; seeded journal lines with blood-marked letters; numbers on
    the candles; the unnumbered smudge.
  - _Requirements: 2.1, 3.1–3.2_

- [x] 8. Treasure card for Level 1
  - The Collector's Gold Watch (image from the owner, keyed and credited).
  - _Requirements: 4.1–4.3_

- [x] 9. Browser verification for Level 1 end to end
  - Account → L1S1 … L1S5 → treasure → landing → Level 2 shows its state;
    death and resume; leaderboard; no frame > 300 ms on stage changes.

- [x] 10. README and Kiro write-up
  - Levels, treasures, the honest limits of browser accounts (Requirement 8.1),
    asset credits.

- [x] 11. Level 2: The Library of Whispers (built in its own spec: `level2-library-and-level3-crypt`)
- [x] 12. Level 3: The Crypt Beneath (built in its own spec: `level2-library-and-level3-crypt`)
