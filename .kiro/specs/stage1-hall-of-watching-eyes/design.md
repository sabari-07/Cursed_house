# Design: Stage 1 — The Hall of Watching Eyes

## Overview

The cinematic and Stage 1 are one scene class, `HallScene`, so the hall never
reloads. `HallStage` (React) owns the rules and the UI; `HallScene` owns the
picture and the sound; `stage1Data.ts` owns the content and the pure rule functions.

```
MainMenu ── outside: LandingCanvas ── ENTER ──► inside: HallStage
                                                   │  rules, HUD, panels
                                                   ▼
                                                HallScene  (intro → play → won | dying)
                                                   │  shaders: hall/doorShader.ts, hall/hallShader.ts
                                                   ▼
                                                stage1Data.ts  (PORTRAITS, JOURNAL, SOLUTION, checkOrder, saves)
```

## Scene modes

| Mode | Driven by | What happens |
| --- | --- | --- |
| `intro` | AudioContext clock | Door slam shot → hall shot → voice → laugh → `title` event |
| `play` | frame time | Camera drift, hover, inspect zoom, eyes, candles, scripted scares |
| `won` | frame time | Candles out, portrait falls, door opens, THE EYE |
| `dying` | frame time, audio scheduled at start | Laugh, witch glide and lunge, scream, shatter, blood, `gameover`, `exit` |

The scene reports to React with events: `title`, `gameover`, `exit`.

## Rendering

- **Hall plate**: `grand-hall-clean.png` (the painted figure removed by an offline
  multi-scale Laplace fill). A fullscreen quad maps screen px to painting px.
- **Arjun**: `ArjunModel` is rendered to a render target with lights matched to the
  painting (teal moonlight rim from the windows, a faint warm lamp edge, his
  lantern), then composited in the hall shader (edge softening, colour grade,
  mist in front of his legs). He is hidden while a portrait is inspected.
- **Portraits**: each one is a quad of four painting-px corners. The CPU computes
  the inverse homography (painting px → picture uv) and passes it as a `mat3`. The
  shader draws a gilded frame around the uv square and the painting inside it.
- **Watching eyes**: for each portrait, eye centres and iris radius are measured in
  image px. The shader pulls the pixels inside each eye toward a look offset
  computed on the CPU from the cursor's position in painting px.
- **Candles**: procedural wax, flame and light pool; the wax height follows the time
  left; smoke curls up for two seconds after a candle goes out.
- **Death**: the witch is a luminance-keyed photo drawn in screen space with
  burning eyes. The shatter is a Voronoi shard field around the impact (shifting
  the picture per shard) plus eleven jagged radial hairline cracks and ring cracks.
  The blood is a lobed splat, two layers of stretched droplets, and drips whose
  length grows over time.

## Rules (React)

- `lives` starts at 3, and `timeLeft` at 300 s, counting down once a second during play.
- `checkOrder(order)` returns `incomplete | wrong | right`. An incomplete order
  costs nothing.
- A wrong order means `lives - 1` and `scene.wrong()`; at zero lives, `scene.fail()`.
- A right order means `scene.solve()`, then `saveProgress({ stage1Complete, symbols: ['eye'] })`,
  then the reward card.
- `timeLeft === 0` calls `scene.fail()`.

## Puzzle

Portrait positions on the bookcase: Collector (top left), Son (top right),
Caretaker (bottom left), Wife (bottom right). Journal clues:

1. The one who kept the hours (hourglass → Caretaker) was there first.
2. The boy who carried the key (Son) came in after his mother.
3. She held the white flower (Wife).
4. The master with the gold watch (Collector) came in last.

The only consistent order is Caretaker, Wife, Son, Collector.

## Audio

| Clip | When |
| --- | --- |
| door slam | the front doors close (intro), a muffled rattle at 50 s, the portrait landing, the witch's impact |
| voice | intro, at 2.1 s |
| witch laugh | straight after the voice; quietly (1.1 s, lowpassed) on a wrong answer; in full on death |
| heartbeat | wrong answer, death build-up |
| scream, glass shatter | death: lunge, impact |

## Error handling

- If audio fails to decode or the context is blocked, the intro runs on the wall
  clock after 2.5 s, so the game never stalls.
- Missing clips are skipped (`play()` returns `null`).
