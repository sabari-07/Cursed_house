# Implementation plan: Stage 1 â€” The Riddle of the Hall

- [x] 1. Riddle module and tests
  - `src/stage1/riddles.ts`: seeded RNG, `generateRiddle`, `checkAnswer`,
    `solve`, and the three riddles (clock, word, blink).
  - Property tests over 1,000 seeds: one answer per seed, the red herrings never
    give another answer, the question text is plain English, and the checker
    trims spaces and ignores case.
  - _Requirements: 1.1, 1.3â€“1.5, 2.2â€“2.4, 4.6, 8.1â€“8.3_

- [x] 2. Remove the ordering puzzle
  - Remove `SOLUTION`, `checkOrder`, the four-slot lock, lives and the
    wrong-answer sequence. Keep the portraits, notes, journal, door and save.
  - Update the old spec's tests that depended on them.
  - _Requirements: 4.1_

- [x] 3. Question card and HUD
  - The `question` phase (full card for 6 s or until clicked), the short
    question in the HUD, a 180 s timer that turns red at 30 s, and the heartbeat.
  - _Requirements: 1.2, 1.4, 5.1â€“5.5_

- [x] 4. Answer panel and confirmation
  - A number keypad, letter wheels and a portrait choice, picked by `kind`.
  - The one-chance confirmation. Cancelling loses nothing.
  - _Requirements: 4.1â€“4.5_

- [x] 5. Scene: five candles and the wall clock
  - Five candle positions with seeded lit flags. The clock quad with a painted
    face and shader hands. The clock becomes an inspect target.
  - Wait for the clock face image from the project owner, and credit it in README.
  - _Requirements: 2.1, 3.1â€“3.3, Riddle 1_

- [x] 6. Scene: scratched letters
  - Scratch textures per surface (hairline strokes with a light edge), hung by
    homography. Measure the sizes in the wide view and when inspected.
  - _Requirements: 2.1, 2.5, Riddle 2_

- [x] 7. Scene: blinking portraits
  - A lid band in the portrait shader. The blink only happens while the cursor
    is far away and the portrait is not being inspected. The touch-screen rule.
  - _Requirements: 2.1, 2.5, Riddle 3_

- [x] 8. Win and death wiring
  - Right answer: the door opens, THE EYE, the save, the "Stage 1 complete"
    card with Continue.
  - Wrong answer or time out: the existing witch death. GAME OVER shows the
    answer and the explanation, then returns to the landing page.
  - _Requirements: 6.1â€“6.3, 7.1â€“7.2_

- [x] 9. Browser verification
  - For each riddle, with a fixed seed:
    - play the win path and the wrong-answer path through the real UI
    - capture the question card, the clue close-ups and the answer panel
    - capture the death and the win
  - Check that every clue can be read in the screenshots.
  - Check that no frame takes longer than 300 ms.

- [x] 10. README and Kiro write-up
  - Credit the clock face. Describe the riddle pool and how the seeds work.
  - Note in the Kiro usage section that this spec replaced the ordering puzzle.
