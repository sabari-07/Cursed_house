# The Cursed House

**Play it now: https://play.d2vl7mp975kfo5.amplifyapp.com**
(desktop browser, or a phone held sideways; no install, no account needed)

*Three cursed rooms. Fifteen riddles. One chance at each.*

Arjun's grandfather vanished from a haunted bungalow thirty years ago. His
treasure is still inside. You walk Arjun into the house, room by room, and each
room asks one riddle at a time. Answer right and the lights blink and the next
riddle is asked. Answer wrong and the witch comes for him.

## Why it exists

**The problem.** Horror games usually ask for a download, a console or an
evening. Horror in a browser is usually a jump scare with nothing to solve.
Escape-room puzzles have the opposite problem: they are often unfair, and the
answer depends on guessing what the designer meant.

**Who it is for.**
- **Horror fans** who want a short, polished scare they can start in a browser
  tab in seconds, on a laptop or a phone.
- **Puzzle players** who want riddles that play fair: every answer follows from
  clues you can find and read in the room.
- **Students and casual players.** Every question is written in plain English
  that a 16-year-old can read (short sentences, common words), and a test
  checks each one.

**What makes it different.**
- **Fair by proof.** Every riddle is generated from a random seed, so every
  attempt has a new answer and memorising doesn't help. A solver that reads only
  what the room shows (never the stored answer) proves, over 1,000 seeds for
  each of the 15 riddles, that there is exactly one answer, and that taking
  away any single clue breaks it. That is 15,000 generated riddles checked on
  every test run.
- **Nothing hidden behind sound or darkness.** Every clue you hear is also shown
  as a subtitle at the same moment. A carried candle lights dark rooms, and the
  stages where small letters hide round the hall offer a one-time hint showing
  every place to look.
- **Sound drives the picture.** Lightning is lit by the loudness of a real
  thunder recording. The door opens with the energy of its creak. Bells,
  falling books and the witch's laugh fire their visuals on the audio clock.
- **Paintings brought to life.** Each scene is one painting animated in a
  shader (drifting storm clouds, steady candlelight, fog), with a 3D Arjun
  composited into it and portraits that blink only when you look away.

**Hackathon category:** Costume Contest. The haunting interface is the game: the
fear, the darkness and the sound are how each puzzle is asked.

## Play

1. Open https://play.d2vl7mp975kfo5.amplifyapp.com and tap the ghost bride's
   board (it unlocks sound; browsers keep pages silent until a tap).
2. The title card types itself in blood, and the bungalow appears.
3. Press **PLAY AS GUEST**, or **SIGN UP** to keep your progress on any device
   and join the shared leaderboard. Then **ENTER THE BUNGALOW**.
4. In each room: read the question, look and inspect, then press **ANSWER**.
   You get one chance.

| Desktop | Phone (held sideways) | Action |
| --- | --- | --- |
| Mouse, click or `E` | Tap | Inspect a portrait, an object or the page |
| `C` | Tap the candle, then drag | Carry the candle: its light follows the pointer or finger |
| `A` | ANSWER | Your one chance |
| `J` | JOURNAL | The torn journal page (the hall) |
| `Esc` | STEP BACK | Close a panel (an open answer is kept) |

On a phone, the first tap goes full screen and turns the game sideways (Android
Chrome; iPhone Safari can't hide its bars, but **Add to Home Screen** opens the
game without them). Held upright, the game asks you to turn the phone.

To run it locally:

```bash
npm install
npm run dev        # http://localhost:5178 (accounts are kept in the browser)
npm run build      # production build in dist/
```

## What's in it

**The entry screen.** A ghost bride holds up a board: TAP ANYWHERE TO ENTER.
The tap unlocks sound for the whole visit, so nothing else needs a tap.

**The title card** (about 10 s). THE CURSED HOUSE types itself one letter at a
time in dripping blood, each letter struck by a real typewriter key on the
audio clock, over a painted graveyard under a blood moon. A hand pushes up out
of a grave to the sound of digging dirt, the painting's own witch flies on her
broom, clouds drift, bats wheel, and lightning strikes with the thunder on the
last letter. A loading bar fills with the witch's head riding its edge.

**The landing page** is an animated matte painting of the bungalow at night:
storm clouds across the full moon, rain and ground fog, 19 animated bats (the
bats painted into the art are removed), lightning driven by the thunder
recording, real wolf howls, a stuttering upstairs window, and a tree lantern
and two pumpkins that blink. Arjun, a 3D figure in a fedora and long coat with
a lantern, stands where the painting's own figure stood.

**ENTER THE BUNGALOW.** The camera pushes in while Arjun walks up the path with
a real gait (knees, planted feet, arm swing, swinging lantern, moving coat). A
ghostly drone plays, the door creaks open in step with the creak, and he steps
inside. The doors slam behind him, a voice whispers *"Welcome back… I've
waited"*, a witch laughs while the lights stutter, and the Stage 1 title bleeds
onto the screen.

**Signing in, or not.** Guests play straight away. A guest's progress stays in
the browser and off the leaderboard; SAVE MY PROGRESS turns it into an account,
treasures included. A wrong password shakes the box with a thud; the second
wrong try shakes it and closes it.

**Levels and stages.** Each level is one room with five stages, and each level
awards a treasure:

| Level | Room | Time per stage | Treasure | Status |
| --- | --- | --- | --- | --- |
| 1 | The Grand Hall | 3 min | The Collector's Gold Watch | Playable |
| 2 | The Library of Whispers | 3 min | The Raven Codex | Playable |
| 3 | The Crypt Beneath | 3 min | The Heart of the House | Playable |
| 4 | The Attic | | | Coming soon |

Every stage works the same way:

- The house asks **one question** in plain English. It stays on screen until
  the stage ends (on a phone it folds to one line).
- The answer is hidden in the room, and you find it by looking and inspecting.
- You have **one chance**. You can open the answer panel, step back and look
  again; once you press YES, there is no going back.
- Every attempt is **different**: a random seed picks the hidden values.

**Level 1, the Grand Hall:**

1. **The One Who Blinks.** Two portraits blink, but only while you are not
   looking at them. Which of the two holds a key, a flower, or something that
   tells time?
2. **The Stopped Clock.** Add the hour on the wall clock to the number of
   candles still burning. The Collector's pocket watch shows a different hour,
   to mislead you.
3. **The Scratched Word.** Five numbered letters are scratched round the hall,
   on portrait frames, the door, the clock rim, the journal and the stair post.
   One extra letter has no number.
4. **Who Moved?** Remember the wall. In the dark, two portraits swap places and
   are left hanging crooked. Which portrait hung there before?
5. **The Marked Page.** Letters in the journal are circled in blood, and one is
   hidden under a blot. That hidden letter is scratched somewhere else in the
   hall.

**Level 2, the Library of Whispers** (at least 3 clues and 2 traps per stage):

1. **The Red Books.** Count the red books left of the ladder, add the hour on
   the tall clock, and take away the wall lamps that are out. Red books on the
   far shelves and a flame reflected in the mirror are traps.
2. **The Mirror.** A word is written backwards in the dust on the mirror, and a
   hand wiped one letter away. The diary underlines the missing letter (and a
   date, to mislead you).
3. **The Whispering Book.** A whisper names a book. The diary says the right one
   stands right above the lamp that is out.
4. **The Falling Books.** Study the shelves (25 s, or press I'M READY). Books
   fall in the dark. Add the brass numbers of the shelves they fell from (one
   gap was already there).
5. **The Locked Cabinet.** Four signs cut into the globe, the angel and the
   busts open it, in the order of the torn diary pages' numbers.

**Level 3, the Crypt Beneath** (at least 3 clues and 3 traps per stage):

1. **Who Died Youngest.** Six brass plates with years of birth and death. Two
   died the same year, one year is under wax, and an "aged 9" is someone else.
2. **The Bell.** Count the rings (heard, seen swinging, and subtitled), then the
   candles still burning on the big coffin. An echo, a reflection and a candle
   that only flickers are traps.
3. **Words in the Water.** Upside-down letters glow in the wet floor, near to
   far. One shows only when a candle flares.
4. **The Order of the Dead.** The door's four signs, ordered by the death years
   on the plates that carry them.
5. **The Sealed Door.** The Collector's birth year plus the age cut into the
   door's rim.

**Winning:** the lights blink three times, the next stage is asked in the same
room with no page change, and Stage 5 wins the treasure. The treasure card
leads straight into the next room.

**Failing:** a wrong answer or running out of time brings the witch. She drops
in front of Arjun, he screams, the screen goes black, out of the dark she has
him, and the glass shatters across the whole screen, spattered with blood.
GAME OVER shows the right answer and why. A death restarts the level from its
Stage 1; levels already cleared stay cleared.

**Accounts and the leaderboard:**

- The LEADERBOARD ranks players by levels cleared, then by the total of each
  level's best time (all five stages in one run), then deaths.
- **On the live site** accounts, progress and the leaderboard are kept online
  (`infra/`), so a player can sign in from any device and everyone shares one
  leaderboard:
  - An API Gateway HTTP API (throttled to 20 requests a second) calls one
    Lambda (`infra/lambda/index.mjs`, Node.js 20), which uses one DynamoDB
    table (`cursed-house`, on-demand, encrypted, point-in-time recovery).
  - Passwords are never stored: only a salted PBKDF2-SHA-256 hash (210,000
    iterations). A wrong name and a wrong password get the same answer, and
    8 wrong tries lock the account for five minutes.
  - Sign-up shows a one-time **recovery code**; Forgot password needs the
    name, that code and a new password. Sessions are random tokens that
    expire after 30 days (DynamoDB deletes them).
  - The Lambda's role may only read and write that table and its index.
    No AWS keys are in the game: the browser only knows the API's address.
- **Without the API** (`npm run dev`, or a build without `VITE_API_URL`)
  accounts are stored in this browser's localStorage, with the same hashing
  (Web Crypto), and the leaderboard adds the rows of `public/data/users.json`.

**Deploying** (`npm run deploy`): `scripts/deploy.mjs` reads AWS keys from
`config/.env` (git-ignored; copy `config/.env.example`), deploys the stack in
`infra/template.yaml` to ap-south-1, builds the game with the API address, and
uploads it to Amplify Hosting. `npm run test:live` checks the live API and site
end to end, then removes its test players.

## How Kiro was used

The whole game was built in the **Kiro IDE** by its agent, from a one-page plan
(`plan.txt`) and the owner's feedback, one request at a time. The owner
supplied the paintings (generated with ChatGPT), played every build and said
what was wrong. The agent wrote the code, ran the checks and drove
a real browser to prove its own work before reporting.

The approach in one line: **specs to decide, steering to remember, hooks to
enforce, tests to prove, a browser to see and hear.**

### At a glance

| Kiro feature | In this repo | What it did for the game |
| --- | --- | --- |
| Specs | 6 in `.kiro/specs/` | Each feature planned as requirements → design → tasks, including the *correctness properties* the tests prove |
| Steering | 4 in `.kiro/steering/` | The owner's feedback turned into standing rules (realism, sync to the audio clock, fair puzzles, licensing) |
| Agent hooks | 4 in `.kiro/hooks/` | Type-check on save, credit every new asset, guard scene and shader edits, build after each spec task |
| Custom agent | `.kiro/agents/asset-credit-auditor.md` | Audits every asset's licence before a submission |
| MCP | `tests/browser/playwright-mcp.json` | A Playwright MCP server, so the agent can drive the game through MCP tools |
| Tests the agent wrote and runs | 167 Vitest tests (7 files), 13 browser checks, 1 live check | Prove fairness, saves, the leaderboard, timing, phones and sound |

### Specs: deciding before building

Each spec has `requirements.md` (user stories with EARS-style acceptance
criteria), `design.md` (architecture, data, correctness properties, error
handling, testing strategy) and `tasks.md`.

- `stage1-hall-of-watching-eyes/`: the first Stage 1, a fixed portrait-ordering
  puzzle with three lives.
- `stage1-riddle-of-the-hall/` **replaced** it after playtesting. The owner
  found the fixed puzzle too easy and too static, so the new spec defines one
  plain-English question, one chance, a seeded answer and red herrings, and
  lists the properties the tests must prove ("every seed has exactly one
  answer", "no red herring gives another answer").
- `levels-and-leaderboard/`: 3 levels × 5 stages, treasures, accounts and the
  leaderboard. Its design records changes made on the owner's request: a death
  now restarts the level, and the leaderboard ranks levels cleared first.
- `level2-library-and-level3-crypt/`: the two painted rooms and their ten
  riddles. Its "Decisions made while building" section records why there is one
  room renderer instead of a scene class per room, and why The Falling Books
  replaced The Wandering Ladder (a painted ladder can't move convincingly).
- `haunted-intro-and-sign-in/`: the title card and sign-in, and how the owner's
  feedback turned an opening letter into a title card.
- `entrance-sequence/`: the landing scene, ENTER THE BUNGALOW, sound unlocking
  on phones and loading without freezes.

When the owner changed his mind, the spec changed first and the code followed.
The specs describe the game as it is, not as it was first planned.

### Steering: the owner's feedback as rules

Many first attempts were rejected ("looks cartoon", "the lamp light waves",
"the laugh and the witch are not in sync"). Each lesson became a rule in
`.kiro/steering/`, so it never had to be said twice:

- `product.md`: the story, the journey, and the non-negotiables: realism over
  procedural primitives, one continuous world with one shared Arjun model,
  sound and picture in sync on the audio clock, fair puzzles, plain English,
  no barrier to play, and firelight that never "waves".
- `tech.md`: the stack, where everything lives, the commands, and the
  techniques to reuse (painting plates in shaders, 3D composited into a
  painting, data-driven seeded riddles, the shader-cost rule).
- `horror-design.md`: palette, the dripping Creepster title, how cracks, blood
  and sound must behave. Included only when scene or component files are open.
- `assets-and-licensing.md`: which sources are allowed (the hackathon forbids
  material we have no right to use), and that every asset is credited here.

### Agent hooks: rules the agent can't forget

| Hook | Trigger | What it does |
| --- | --- | --- |
| `typecheck-on-save` | A file under `src/` is saved | Runs `npm run typecheck`, catching shader-uniform and scene API mismatches at once |
| `credit-new-assets` | A file is created under `public/` | Makes the agent add the README credit row, or ask if the source is unknown |
| `scene-shader-guard` | Before any edit | A script reads the edit's path and, only for `src/scenes` and `src/three`, reminds the agent of the no-waving-light and audio-clock rules |
| `verify-after-spec-task` | A spec task is marked complete | Runs the production build, so a finished task never leaves the game unbuildable |

### Custom agent and sub-agents

- **`.kiro/agents/asset-credit-auditor.md`** (made with Kiro's custom-agent
  creator, read-only by its instructions). Before a submission it runs
  `npm run audit:credits` (every file in `public/` must have a credit row, and
  every row must name a real file), then reads each row against the licensing
  steering and proposes fixes. Its first run found a real bug: a paragraph in
  the middle of the credits table that stopped the rows after it from rendering.
- **Sub-agents** in a clean context: the auditor, a context gatherer that mapped
  the code before larger changes, and the custom-agent creator.

### MCP

`tests/browser/playwright-mcp.json` sets up the Playwright MCP server for this
project (installed Chrome, headless, 1600 × 900, output to
`tests/browser/out/mcp`), so the agent can drive the game through MCP browser
tools. The agent is not allowed to write `.kiro/settings/` in this setup, so the
config lives here; to turn it on, copy it to `.kiro/settings/mcp.json`. The scripted browser checks below don't
need it. AWS documentation was read through the AWS MCP server while planning
the deployment (Amplify, the Lambda and DynamoDB).

### The workflow: build → look → listen → fix

The game depends on things a type-checker can't see: whether a shadow looks
cartoon, whether lamplight waves, whether a flash lands on the thunder. So
every visual or audio change ended with the agent proving it in a real browser.

- **Frames at exact moments.** Headless Chrome scripts drive the real UI and
  capture frames at set moments (0.02 s after a thunder clap, the frame the
  witch hits the glass, 9.8 s into ENTER). The agent looked at each frame and
  fixed what it saw. The first shattered glass looked like a spider web; after
  seeing the frame, it was rebuilt as hairline cracks with blood spatter.
- **Listening with numbers.** Scripts decode the recordings and print loudness
  envelopes, zero-crossing rates and onsets. This is how the agent found that
  the "booms" in the supplied door recording were knocks, located the real
  ghostly drone, and cut every knock out when the clip is decoded. It also logs
  the AudioContext time next to the flash and door values to prove they agree.
- **Measuring paintings.** Scripts lay a labelled 50 px grid over each painting,
  so doors, windows, lamps, pumpkins and shelves are placed by measurement.
  When the owner replaced the bungalow painting, every position was measured
  again on the new one.
- **Phones, measured.** A phone-sized browser with the CPU slowed 4× (about a
  mid-range phone) and a CPU profile showed where the title card froze for
  4.4 s (Arjun's face painted pixel by pixel, the bungalow cleaned up at load).
  Both are now baked once into images by scripts, and the longest stall on the
  title card dropped to 0.4–0.6 s.
- **Asset research.** The agent searched sources directly: the Wikimedia Commons
  API for public-domain portraits (checking each licence field), the National
  Park Service sound library for wolves, and Pixabay for sound effects.

### Tests: proving it, not assuming it

`npm test` runs **167 Vitest tests** in 7 files.

**Seed-sweep properties: the riddles are fair.**
- `src/stage1/riddles.test.ts` (Level 1) and `src/riddles/rooms.test.ts`
  (Levels 2 and 3) generate every riddle from 1,000 seeds each: 15,000 riddles.
- For each one, a solver works the answer out from what the room shows, and
  there must be exactly one answer, equal to the stored one.
- Taking away any single clue must remove or change the answer.
- There must be enough clues and traps, and no trap may give another answer.
- Every question must be plain English.
- Every overlay must sit inside the painting.
- Every sound must have a subtitle.
- Every date must make sense.

**Property-based tests with fast-check: saves and the leaderboard.**
- `src/game/progress.test.ts`:
  - random progress round-trips through JSON unchanged;
  - *any* input (fast-check's `anything()`, including junk) reads as nothing
    or as valid progress, never a crash;
  - random histories of up to 60 wins and deaths never move a level back,
    never lose a treasure, and every save reads back.
- `src/game/leaderboard.test.ts`: on random boards with frequent ties,
  - the ranking is the same for any input order;
  - fewer levels cleared never ranks above more;
  - the comparison is antisymmetric and transitive;
  - equal players share a rank.
- **This caught a real bug the example tests missed.** fast-check shrank a
  failure to a save whose `deaths` was `Infinity`. JSON reads a huge number
  such as `1e400` as `Infinity`, which passed the "is a number" check and would
  have reached the browser-only leaderboard. `parseProgress` now accepts finite
  numbers only. The online Lambda already capped the value, so the live
  leaderboard was never affected.

**Example tests.**
- `src/game/levels.test.ts`: levels, stages, win and death steps, and old
  saves.
- `src/game/accounts.test.ts`:
  - sign-up and sign-in round-trip;
  - a wrong password and an unknown name give the same error;
  - passwords are never stored;
  - a corrupt store is backed up;
  - the seed file never carries secrets;
  - guest progress moves into a new account.

**Browser checks** (`tests/browser/`, Playwright with headless Chrome; `npm run
test:browser -- all` with the dev server running). They drive the real UI, log
any frame over 300 ms and save screenshots.
- `level1`: sign-up to the treasure, plus a death.
- `level`: a whole Level 2 or 3 (`LEVEL=2`).
- `death`: a death in a painted room.
- `guest`: guest play and saving it into an account.
- `signin`: the shake, the close after two tries, and Forgot password.
- `titlecard`: the card's timing against the audio clock.
- `candle`: one press picks it up.
- `mobile`, `mobile2`, `mobile3`, `mobile4`: a phone held sideways, a room
  answered by touch alone, a phone held upright, and full screen.
- `phoneperf`: frame times on a slowed phone.
- `phonesound`: sound on a phone under the browser's **real** autoplay rule.
  The other checks switch that rule off, which is how phones went silent
  without any check noticing. This check now proves one tap gives sound in the
  title card, then the landing, then the hall.
- `npm run test:live`: checks the deployed API and site end to end, then
  removes its test players.
- `npm run audit:credits`: checks the asset credits.

## Asset credits

The MIT licence in `LICENSE` covers the source code. The assets below keep their
own licences.

| Asset | File(s) | Source | Licence |
| --- | --- | --- | --- |
| Landing painting (the bungalow at night) | `public/landing/bungalow.webp` (source: `art/bungalow-hires.png`; the first painting is kept as `art/bungalow-v1.png`) | AI-generated by the project owner with ChatGPT, 1536 × 1024; converted to WebP, quality 0.95. The painted witch, her lantern's haze and the painted bats are removed in code (`LandingScene.preparePainting`) | Owned by the project owner (OpenAI terms assign output to the user) |
| Landing painting, prepared | `public/landing/bungalow-prepared.webp` | The painting above after `LandingScene.preparePainting` (witch, lantern haze and painted bats removed, compression blocks smoothed, unsharp mask), baked by `scripts/prepare-landing.cjs` so phones don't do it while the title card plays; WebP quality 0.9 | Owned by the project owner |
| Arjun's face and hair textures | `public/arjun/skin.png`, `public/arjun/hair.png` | Painted in code by this project (`ArjunModel.paintHead`), baked to images by `scripts/bake-arjun.cjs` | MIT, this project |
| Grand hall painting | `public/hall/grand-hall.png`, `public/hall/grand-hall-clean.png` | AI-generated by the project owner with ChatGPT; in `grand-hall-clean.png` the painted figure is removed with a multi-scale Laplace fill so the 3D Arjun can stand there | Owned by the project owner |
| Thunder clap | `public/audio/thunder-hit.mp3` | [SoundDino](https://sounddino.com/) (`thunder-single-hit.mp3`), first 4 s | SoundDino: free for commercial use, no attribution required |
| Ghostly drone + door creak | `public/audio/door-enter.mp3` | [SoundDino](https://sounddino.com/) (`knocking-and-opening-the-door-gate.mp3`), trimmed to 18.7 s; the knocks are cut out at decode time (`DOOR_KEEP` in `LandingScene.ts`) | SoundDino: free for commercial use, no attribution required |
| "Welcome back… I've waited" | `public/audio/voice-welcome-back.mp3` | [Pixabay](https://pixabay.com/) — alesiadavina, *Female vampire voice line* (554050), trimmed | Pixabay Content License |
| Witch laugh | `public/audio/witch-laugh.mp3` | [Pixabay](https://pixabay.com/) — alesiadavina, *Dark witch evil laugh* (553609) | Pixabay Content License |
| Door slam | `public/audio/door-slam.mp3` | [Pixabay – door slam 172171](https://pixabay.com/sound-effects/film-special-effects-door-slam-172171/) | Pixabay Content License |
| Glass shatter | `public/audio/glass-shatter.mp3` | [Pixabay – glass shatter 263962](https://pixabay.com/sound-effects/film-special-effects-glass-shatter-263962/) | Pixabay Content License |
| Scream | `public/audio/arjun-scream.mp3` | [Pixabay – male horror scream 123080](https://pixabay.com/sound-effects/people-male-horror-scream-123080/) | Pixabay Content License |
| Heartbeat | `public/audio/heartbeat.mp3` | [Pixabay – heartbeat loop 96879](https://pixabay.com/sound-effects/horror-heartbeat-loop-96879/) | Pixabay Content License |
| Title card background (graveyard under the blood moon) | `public/landing/title-graveyard.webp` (source: `art/title-graveyard.png`) | AI-generated by the project owner with ChatGPT; converted to WebP at the original 1672 × 941, quality 0.97. The painted witch on the moon is cut out by a script (her dark shape against the moon, x 1398–1542, y 84–178) and the moon behind her filled from the texture just below, so she can fly. The painted zombie hand is cut out the same way (script `cuthand.cjs`: warm pixels connected to the palm in x 630–910, y 465–840, holes closed, edge feathered 2 px), and the place it stood above the soil (y 816) filled with a smooth fill from the hole's border plus soft value-noise mist, so it can rise | Owned by the project owner |
| The witch on the moon (title card) | `public/landing/title-witch.png` | Cut out of the owner's title painting above (alpha from her darkness against the moon, connected to her body only) | Owned by the project owner |
| The hand rising from the grave (title card) | `public/landing/title-hand.png` | Cut out of the owner's title painting above (box x 630–910, y 465–840; base faded over 14 px at the soil line) | Owned by the project owner |
| Entry screen (the ghost bride holding a blank board) | `public/landing/gate-bride.webp` (source: `art/ghost-bride.png`) | AI-generated by the project owner with ChatGPT; converted to WebP at the original 1672 × 941, quality 0.92. The words on the board are page text, not part of the image | Owned by the project owner |
| Level 2 treasure: The Raven Codex | `public/treasures/raven-codex.webp` (source: `art/raven-codex.png`) | AI-generated by the project owner with ChatGPT; scaled from 1254 × 1254 to 768 × 768, WebP quality 0.9 | Owned by the project owner |
| Level 3 treasure: The Heart of the House | `public/treasures/heart-of-the-house.webp` (source: `art/heart-of-the-house.png`) | AI-generated by the project owner with ChatGPT; scaled from 1254 × 1254 to 768 × 768, WebP quality 0.9 | Owned by the project owner |
| App icons (home screen) | `public/icons/icon-192.png`, `public/icons/icon-512.png` | Cropped from the owner's ghost bride painting above (her face, x 640–1040, y 0–400), brightened 1.25× (a canvas crop, no other edit) | Owned by the project owner |
| Web app manifest | `public/manifest.webmanifest` | Written for this project (name, full-screen display, icons) | MIT, this project |
| Hand digging in dirt (the hand's rise) | `public/audio/hand-dig.wav` | [Pixabay: Hand digging dirt, leaves crunch](https://pixabay.com/sound-effects/nature-hand-digging-dirt-leaves-crunch-32630/) by freesound_community; first 4.4 s, mono 22.05 kHz, 5 ms fade-in, 0.4 s fade-out, peak normalised | Pixabay Content License |
| Dry dirt crumble (the grave breaking) | `public/audio/dirt-crumble.wav` | [Pixabay: Dry Dirt Crumble Impact](https://pixabay.com/sound-effects/film-special-effects-dry-dirt-crumble-impact-351843/) by Soumages; 0.4–3.2 s, mono 22.05 kHz, 5 ms fade-in, 0.4 s fade-out, peak normalised | Pixabay Content License |
| Typewriter key (title card) | `public/audio/type-key-a.wav` | [Pixabay – freesound_community, *Typewriter 170428_1482* 22815](https://pixabay.com/sound-effects/household-typewriter-170428-1482-22815/); one strike, 34.478–34.600 s, cut at the attack and before the next key | Pixabay Content License |
| Bell toll (crypt) | `public/audio/bell-toll.mp3` | [Pixabay – Universfield, *Church Bell Toll* 156464](https://pixabay.com/sound-effects/film-special-effects-church-bell-toll-156464/), unedited | Pixabay Content License |
| Whispers (library) | `public/audio/library-whispers.mp3` | [Pixabay – freesound_community, *Ghost Whispers* 6030](https://pixabay.com/sound-effects/horror-ghost-whispers-6030/); only 0–6 s is played (`WHISPER_KEEP` in `HallScene.ts`) | Pixabay Content License |
| Book fall | `public/audio/book-fall.wav` | [Pixabay – freesound_community, *Book drop* 30016](https://pixabay.com/sound-effects/film-special-effects-book-drop-30016/), 22.68–24.00 s | Pixabay Content License |
| Candle snuffed | `public/audio/candle-snuff.wav` | [Pixabay – kai_audio, *Candle Blow Out* 446030](https://pixabay.com/sound-effects/film-special-effects-candle-blow-out-446030/), 6.96–7.90 s | Pixabay Content License |
| Wolf howls | `public/audio/wolf-*.mp3` | U.S. National Park Service sound library (Denali and Yellowstone recordings), trimmed | Public domain |
| Front door photo (slam shot) | `public/hall/entrance-hall.jpg` | [Pixabay – villa house stairwell 4873343](https://pixabay.com/photos/villa-house-stairwell-lost-places-4873343/), night-graded in a shader | Pixabay Content License |
| Witch seizing Arjun | `public/stage1/witch-grip.webp` (source: `art/witch-grip.png`) | AI-generated by the project owner with ChatGPT; the black background is keyed out (border flood fill, enclosed black pockets outside the figures removed, brightness alpha for rags and smoke) | Owned by the project owner |
| Witch | `public/stage1/witch-reaching.webp` (source: `art/witch-reaching.png`) | AI-generated by the project owner with ChatGPT; the black background is keyed out to transparency (silhouette mask plus brightness alpha for hair, rags and smoke) | Owned by the project owner |
| Level 2 room: the Library of Whispers | `public/rooms/library.webp` (source: `art/library.png`) | AI-generated by the project owner with ChatGPT; converted to WebP at the original 1672 × 941 | Owned by the project owner |
| Level 3 room: the Crypt Beneath | `public/rooms/crypt.webp` (source: `art/crypt.png`) | AI-generated by the project owner with ChatGPT; converted to WebP at the original 1672 × 941 | Owned by the project owner |
| Stopped wall clock (Stage 1 riddle) | `public/stage1/clock-face.webp` (source: `art/clock-face.png`) | AI-generated by the project owner with ChatGPT (a dial with no hands); resized from 1254 px to 1024 px WebP. The hands are drawn in the hall shader so the time changes every run | Owned by the project owner |
| Portrait: The Collector | `public/stage1/portraits/collector.jpg` | Frans Hals, *Portrait of a Man Holding a Watch*, Barnes Foundation, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Frans_Hals_-_Portrait_of_a_Man_Holding_a_Watch_-_BF262_-_Barnes_Foundation.jpg) | Public domain |
| Portrait: The Wife | `public/stage1/portraits/wife.jpg` | Attributed to Cosmo Alexander, *Unknown Jacobite Lady*, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Unknown_Jacobite_Lady,_c._1740%E2%80%9350,_attributed_to_Cosmo_Alexander.jpg) | Public domain |
| Portrait: The Son | `public/stage1/portraits/son.jpg` | British School, *Unknown Young Man in Armour with a Key of Office*, National Trust, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:British_(English)_School_-_Portrait_of_an_Unknown_Young_Man_in_Armour_with_a_Key_of_Office_-_996290_-_National_Trust.jpg) | Public domain |
| Portrait: The Caretaker | `public/stage1/portraits/caretaker.jpg` | Balthasar Denner, *Old Man with an Hourglass*, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Denner_Old_man_with_an_hourglass.jpg) | Public domain |
| Creepster font | `public/fonts/Creepster-Regular.ttf` | [Google Fonts – Creepster](https://fonts.google.com/specimen/Creepster) by Sideshow | SIL Open Font License 1.1 |

The `.wav` clips were cut in Chrome by a small script: decode, keep the stated range, mix to mono, a 5 ms fade-in (the attack is kept), a 0.2–0.4 s fade-out, peak normalised to 0.9, written as 16-bit PCM.

## Licence

Source code: [MIT](LICENSE).
