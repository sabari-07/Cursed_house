# Design: Landing page and ENTER THE BUNGALOW

## Overview

One scene class, `src/scenes/LandingScene.ts`, owns a `WebGLRenderer` and draws
the whole landing: a fullscreen painting plate whose fragment shader brings the
painting to life, with Arjun, bats, rain and the lightning bolt drawn over it.
`src/components/LandingCanvas.tsx` mounts it and renders the sound button.
`MainMenu.tsx` puts the player card and ENTER THE BUNGALOW over it.

## The painting plate

- **Source:** `public/landing/bungalow.webp` (the owner's painting, 1536 × 1024).
  Every position is measured on it in painting px on a 50 px grid: the door,
  the moon, the tree lantern, the two blinking pumpkins, the blinking window,
  the painted figure, her lantern's haze and 13 painted bats.
- **Preparation** (`preparePainting`): the painted figure, the haze and the bats
  are removed by mask-based inpainting (Laplace fill plus mirrored detail), then
  compression blocks are smoothed and an unsharp mask is applied. The result is
  baked once into `public/landing/bungalow-prepared.webp` by
  `scripts/prepare-landing.cjs`, so phones skip that work. The raw painting is
  the fallback.
- **Shader:** maps screen px to painting px (`uScale`, `uOffset`, cover-fit) and
  samples the painting with a 9-tap Catmull-Rom bicubic, so the push-in stays
  smooth. In order: sky clouds warped and two storm layers drifting with
  parallax, ground fog, steady firelight, then the blinking lights, the window,
  the door leaf, lightning, a lifted-shadow grade and fine film grain that grows
  with the zoom. Firelight never uses moving spatial noise.
- **Blinking lights:** each is one value for the whole light (`uLampOn`,
  `uPumpAOn`, `uPumpBOn`), driven by keyframes in `updateBlinker`. A light's
  mask covers its warm glow and its white-hot core, so the flame goes out too.

## Arjun

The one shared model, `src/three/ArjunModel.ts`, is rendered as a 3D figure on
the painting. His size follows `heightAt(y)`, a perspective fit from his size at
the start of the path to his size at the door step. His painted face and hair
are baked images (`public/arjun/`) so phones do not paint them pixel by pixel.

## Sound

- `game/audioUnlock.ts`: one AudioContext for the visit, created inside the
  entry screen's finished tap (touchend, click or key). The landing, the title
  card and the rooms play through it, so a phone needs no second tap.
- Thunder: the clap's loudness envelope (10 ms steps) drives the flash.
- Wolves: four National Park Service recordings, lowpassed and panned, through a
  short forest reverb made once.
- The door clip: `DOOR_KEEP` lists the kept ranges of the recording (the drone
  pieces and the creak); the knocks are cut out when it is decoded.

## ENTER THE BUNGALOW

`enter()` starts the door clip on the AudioContext clock and `updateEnter`
follows that clock (or a timed fallback without sound):

- The camera pushes in to the door (`updateMapping`, at most about 2.7× the
  painting before the step inside).
- Arjun walks `WALK_PATH` to the step beside the door, turns, and steps in along
  `STEP_IN_PATH`.
- The door leaf opens with the creak's cumulative energy, so it moves exactly
  when the creak is heard.
- The fade plane goes to black and the hall scene takes over.

## Loading without freezes

`LandingCanvas` builds the scene behind the entry screen, about 0.7 s after it
appears. `start()` builds in steps with a frame between each, waits while the
title card plays (`setBuildAllowed`), compiles shaders with `compileAsync`,
uploads the textures and draws one hidden frame. The scene stays paused
(`setActive(false)`) until the card ends.

## Testing

- `npm run test:browser`: Level 1 end to end, starting from this landing.
- `tests/browser/phonesound.cjs`: sound on a phone under the browser's real
  autoplay rule (title card, then the landing's storm with no second tap, then
  the hall).
- `tests/browser/phoneperf.cjs`: frame times on a slowed phone for the entry
  screen, the title card and the landing.
- Frames captured at set moments of ENTER (1 s, 5 s, 9.8 s, 10.9 s) check the
  walk, the door and the zoom by eye.
