# Tech and conventions

## Stack

- React 19 + TypeScript (strict) + Vite.
- Plain Three.js (no React Three Fiber). Each scene is a class that owns its own
  `WebGLRenderer` and has `start()`, `resize()` and `dispose()`. React components
  mount the canvas and render the UI over it.
- Web Audio API for all sound. The AudioContext is created or resumed inside a
  user gesture (browser autoplay rules).
- Vitest for unit and property tests; Playwright (headless Chrome on Direct3D)
  for browser checks in `tests/browser/`.

## Commands

- Type-check: `npm run typecheck`.
- Unit and property tests: `npm test` (167 tests, ~15 s; fast-check property tests in `progress.test.ts` and `leaderboard.test.ts`).
- Dev server: `npm run dev` (port 5178 during development).
- Browser checks (dev server running): `npm run test:browser` (Level 1 end to
  end), `npm run test:browser -- signin`, `... level` (LEVEL=2|3), `... death`,
  `... lights` (the landing's lantern, pumpkins and window act where measured),
  `... responsive` (text size and fit on five laptop sizes, two phones, a tablet),
  `... pumpkins` (the landing's jack-o'-lanterns visibly flicker).
- Asset credits: `npm run audit:credits` (every file in `public/` must have a
  README credit row; exits 1 if not).
- Production build: `npm run build`.

## Where things live

| Path | What |
| --- | --- |
| `src/components/MainMenu.tsx` | The journey: title card → landing → sign in or guest → the level's room |
| `src/components/TitleCard.tsx` | 8 s title card: typed title with typewriter keys, blood drips, loading bar |
| `src/components/AccountPanel.tsx` | Sign in / sign up / forgot password popup; a wrong password shakes it (closes after 2) |
| `src/components/HallStage.tsx` | The stage engine for every room: phases, timer, one-chance answer, panels, subtitles |
| `src/components/answers/*` | Choice and sequence answer panels |
| `src/scenes/LandingScene.ts` | Landing painting shader, Arjun's walk, bats, rain, thunder, wolves, door |
| `src/scenes/HallScene.ts` | One renderer for every room (hall, library, crypt): intro, clues, events on the audio clock, the witch death |
| `src/scenes/room/rooms.ts` | Room data: painting, Arjun's place, camera, lamps, objects (painting px) |
| `src/scenes/hall/*.ts`, `room/roomArt.ts` | GLSL (variants by define: `HALL_PLAY`, `ROOM_PLAY`, `HALL_DEATH`) and overlay art |
| `src/stage1/riddles.ts` | Level 1's five seeded riddles and their solver |
| `src/riddles/*.ts` | Levels 2–3: ten seeded riddles (`library.ts`, `crypt.ts`) and their solvers |
| `src/game/levels.ts`, `progress.ts` | Levels, rules, treasures; progress (a death restarts the level) |
| `src/game/accounts.ts`, `leaderboard.ts` | Browser accounts (PBKDF2), guest play, ranking by levels cleared |
| `src/three/ArjunModel.ts` | The one shared Arjun model and his walk cycle |
| `public/` | Art, audio, fonts (every file must be credited in README.md) |
| `tests/browser/` | Playwright checks; `scripts/audit-credits.mjs` |

## Patterns to follow

- **Painting plates**: a fullscreen quad whose fragment shader maps screen px to
  painting px (`uScale`, `uOffset`, cover-fit). Animate the painting in the shader
  and measure positions in painting pixels on a 50 px grid.
- **One room renderer**: a new room is data in `rooms.ts` plus riddles, not a new
  scene class. Clues are overlays (one atlas, one shader loop, `OV_N`), lamps are
  a uniform array of 8.
- **3D on a painting**: render the figure to a render target and composite it in
  the painting's shader.
- **Data-driven, seeded riddles**: pure functions `generate(seed)` and
  `solve(run)`. `solve` works from what the room shows, never from `run.answer`;
  tests prove exactly one answer over 1,000 seeds and that removing any clue breaks it.
- **Every heard clue is also shown**: room events carry a subtitle and are fired
  on the AudioContext clock (`HallScene.runEvents`).
- **Shader cost**: compile variants with `compileAsync` during an intro, upload
  textures one per frame; no frame over 300 ms during play.
- **UI sizes in rem**: component CSS is in `rem`; `index.html` sets the root size (16 px on phones and
  below 761 x 561, growing with the screen on laptops, 17-26 px). Keep `@media` conditions and 1-2 px hairlines in px.
- **Saves**: accounts in `localStorage` (`ghostwriter_users_v1`, session
  `ghostwriter_session_v1`, guest `ghostwriter_guest_v1`), versioned JSON.

## Verifying a change

Type-check, run the tests, then check the change in a real browser. Capture
frames at the exact moments that matter (for example 0.02 s after a thunder
clap), and check audio by logging the AudioContext time next to the visual value.
A command that exits without an error is not proof that a scene looks or sounds right.
