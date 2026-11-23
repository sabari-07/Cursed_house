# Implementation plan: Stage 1 — The Hall of Watching Eyes

- [x] 1. Stage data and rules
  - `src/stage1/stage1Data.ts`: portraits (images, quads, eyes, plaques, details),
    journal, `SOLUTION`, `STAGE1_RULES`, `checkOrder`, versioned progress save.
  - _Requirements: 2.1, 2.6, 3.3, 4.2–4.5, 5.2, 6.2_

- [x] 2. Clean hall plate and Arjun in the hall
  - Paint the painted figure out of the hall art (offline multi-scale Laplace fill).
  - Extract `ArjunModel` from the landing scene; render it to a target and
    composite it in the hall shader with matched lights.
  - _Requirements: 1.3_

- [x] 3. One continuous hall scene
  - Merge the cinematic and Stage 1 into `HallScene` with `intro | play | won | dying`.
  - SKIP stops the scheduled intro sources and starts play.
  - _Requirements: 1.1, 1.2_

- [x] 4. Portraits, eyes and inspection
  - Homography quads, gilded frames, eyes that follow the cursor, hover highlight.
  - Picking in painting px; prompt anchored above the object; inspect zoom with
    focus dimming; the notes panel.
  - _Requirements: 2.1–2.5_

- [x] 5. Journal page and study door
  - Page texture on the pedestal (homography); the journal panel (J).
  - The door edge glow on hover; the lock panel with slots and faces.
  - _Requirements: 3.1, 3.2, 4.1–4.3_

- [x] 6. Candles, lives and time
  - Procedural candles with smoke; HUD candles and timer; wax follows the time left.
  - _Requirements: 5.1–5.3_

- [x] 7. Wrong answer and solve sequences
  - Red eyes, muffled laugh, heartbeat; the portrait falls, the door opens, THE EYE,
    the reward card, the save.
  - _Requirements: 4.4, 6.1–6.3_

- [x] 8. Death sequence
  - The witch's glide and lunge, scream, shatter cracks, blood splat and drips,
    GAME OVER, return to the landing page.
  - _Requirements: 7.1–7.4_

- [x] 9. Scripted scares
  - A shadow on the stairs at 22 s, the door rattle at 50 s, a light flicker at 95 s.
  - _Requirements: 8.1–8.3_

- [x] 10. Browser verification
  - Play the fail path (three wrong orders) and the win path through the real UI;
    capture frames for play, inspect, journal, lock, death and reward.

- [x] 11. Unit and property tests for the rules
  - Property: `checkOrder` returns `right` for exactly one of the 24 permutations.
  - Property: any order with a `null` is `incomplete`.
  - Property: saves round-trip, and corrupt saves fall back to a fresh state.
  - _Requirements: 3.3, 4.3–4.5, 6.2_

- [x] 12. Accessibility pass
  - Keyboard-only path to every object (Tab between targets), and reduced motion
    (no shake, softer witch lunge).
