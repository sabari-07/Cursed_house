# Implementation plan: Landing page and ENTER THE BUNGALOW

- [x] 1. The painting plate
  - `LandingScene` painting shader: clouds, storm layers, fog, steady firelight,
    the blinking window, bicubic sampling and grain.
  - `preparePainting`: painted figure, lantern haze and bats removed; baked by
    `scripts/prepare-landing.cjs`.
  - _Requirements: 1.1, 1.4_
- [x] 2. Arjun on the path
  - The shared `ArjunModel`, sized by perspective, turning to the house; face and
    hair baked by `scripts/bake-arjun.cjs`.
  - _Requirements: 1.2_
- [x] 3. Bats, rain and lightning
  - 19 animated bats; rain; a jagged bolt; the flash from the thunder envelope.
  - _Requirements: 1.1, 2.2_
- [x] 4. Blinking lights
  - One tree lantern and two pumpkins (second from the left, third from the
    right), each going fully dark on its own schedule.
  - _Requirements: 1.3_
- [x] 5. Sound
  - The shared AudioContext (`game/audioUnlock.ts`), wolves with a forest reverb,
    the sound button.
  - _Requirements: 2.1, 2.3, 2.4_
- [x] 6. ENTER THE BUNGALOW
  - Door clip with the knocks cut out (`DOOR_KEEP`), the door following the
    creak's energy, the walk, the push-in, the fade.
  - _Requirements: 3.1–3.5_
- [x] 7. Inside
  - The slam, the cut to the hall, the voice and the laugh with the lights
    stuttering, the Stage 1 title (in `HallScene`).
  - _Requirements: 4.1–4.3_
- [x] 8. Phones
  - Built behind the entry screen and paused during the title card; the
    turn-sideways card; full screen on the first tap.
  - _Requirements: 5.1, 5.2_
- [x] 9. Checks
  - Level 1 end to end, `phonesound`, `phoneperf`, frames of ENTER at set moments.
