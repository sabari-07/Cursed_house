# Product: The Cursed House (project GHOSTWRITER)

A cinematic horror puzzle game that runs in the browser, no install. Arjun's
grandfather vanished from a haunted bungalow thirty years ago; his treasure is
still inside. Three rooms, five stages each: every stage is one fair,
clue-based riddle wrapped in scripted horror, answered once.

**Who it is for:** horror fans who want a ten-minute cinematic scare they can
play straight away in a browser tab, and puzzle players who want riddles that
are fair: every answer follows from clues in the room, and the tests prove it.

The original design is in `plan.txt` at the repo root.

## The journey (what exists today)

1. **Title card** (8 s): THE CURSED HOUSE types itself in dripping blood to real
   typewriter keys, over the graveyard painting; a loading bar with the witch's head.
2. **Landing page**: an animated matte painting of the bungalow at night. Arjun
   (3D) on the path with a lantern; storm clouds, bats, rain, fog, lightning synced
   to a real thunder clap, wolf howls. SIGN IN, SIGN UP, or PLAY AS GUEST.
3. **Sign in popup**: a wrong password shakes the box with a thud; the second
   wrong try shakes it and closes it. FORGOT PASSWORD sets a new password for a
   username (accounts are in this browser only).
4. **ENTER THE BUNGALOW**: the camera pushes in, the door creaks open in sync with
   the recording, Arjun walks in.
5. **Level 1, the Grand Hall** (door slam, the voice, the laugh, then five stages),
   **Level 2, the Library of Whispers**, **Level 3, the Crypt Beneath**. Each level
   awards a treasure. Level 4 shows "coming soon".
6. **Death** (any stage): the witch drops from above, Arjun screams, black, her
   grip, shattered glass and blood, GAME OVER, back to the landing. The level
   starts again from its Stage 1.
7. **Leaderboard**: levels cleared, then the best whole-level times.

## Non-negotiables (learned from the project owner's feedback)

- **Realism over decoration.** Procedural primitives that look "cartoon" were
  rejected repeatedly. Prefer painted or photographic plates brought to life with
  shaders, and real recordings over synthesised sound.
- **Continuity.** No jumps to unrelated pages. Every scene change is a cinematic
  transition inside the same world, and Arjun always looks the same (fedora, long
  coat, scarf, lantern), using one shared model (`src/three/ArjunModel.ts`).
- **Sound and picture stay in sync.** Visual events that match a sound are driven
  by the AudioContext clock or by the recording's loudness envelope, never by
  `setTimeout`.
- **Fair puzzles.** Every answer must follow from clues that the player can find
  and read. Scares never block or hide a clue. Every heard clue is also shown.
- **Plain English.** Questions and explanations are short and readable by anyone.
- **No barrier to play.** A visitor can play as a guest; an account is only
  needed to keep progress and appear on the leaderboard.
- **Light that doesn't "wave".** Firelight is steady, or flickers as one value for
  the whole light. Never use moving spatial noise on lamps.
