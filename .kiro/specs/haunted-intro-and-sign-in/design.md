# Design: the haunted intro letter and the sign-in popup

## Flow

```
App → MainMenu
        ├── LandingCanvas (mounts at once, loads behind the letter)
        ├── IntroLetter (5 s, over everything; pointer events pass through, so
        │                 a click reaches the landing and starts its sound)
        └── AccountPanel (SIGN IN | SIGN UP)
              ├── WitchSky (canvas behind the form: the flying witch, the lunge)
              └── the form (username, password, confirm on sign up)
```

## Components

| Module | Owns |
| --- | --- |
| `components/IntroLetter.tsx` | The letter: words appear one by one (CSS, staggered `animation-delay`), a candle glow, the fade at 4.4–5.0 s; `onDone`. Skip on Enter/Escape/click. |
| `components/WitchSky.tsx` | A 2D canvas: the witch on her broom flying a gentle arc across the top of the screen every 9 s, alternating direction, with motion blur (ghost copies along her path), moonlit rim (blurred blue shadow) and a smoke trail of fading particles. `scare()` makes `witch-reaching.webp` (the death witch, already credited) rush at the screen. |
| `components/AccountPanel.tsx` | Tabs SIGN IN / SIGN UP, the fields, the confirm check, the crack and the light dip on a failed sign-in. |
| `scenes/LandingScene.ts` | `playClip(url, gain)` on its AudioContext, so the laugh goes through the landing's master gain and mute. |
| `components/LandingCanvas.tsx` | Starts the sound on the first key too, not only on a click. |

## The witch on the broom

Until the owner's painting arrives, she is a silhouette drawn as one canvas path
(a bent pointed hat, hair and cloak streaming back, a long broom with fanned
bristles). A silhouette is how a witch against a night sky actually looks, and
it stays dark like the rest of the painting. `WITCH_BROOM_URL` (null now) swaps
in the painted image.

## The wrong-password scare (1.2 s)

| t (s) | What happens |
| --- | --- |
| 0.00 | The laugh starts (Web Audio, 5 ms attack). The flier vanishes. The backdrop darkens to 80%. |
| 0.00–0.55 | The witch's face grows from 40% to 150% of the screen height out of the dark, eyes red. |
| 0.30 | A hairline crack (SVG, 1–1.5 px) appears across the password box. |
| 0.55–1.20 | She fades into the dark. The light returns. The error stays. |

## Testing

- Browser: the letter shows for 5 s and fades. A key press during it starts the
  AudioContext. SIGN UP with mismatched passwords is refused. A wrong password
  draws the crack and the witch and plays the laugh. The flying witch is
  captured mid-flight. The Level 1–3 runs pass with the new popup.

## Change: the title card replaces the letter

The owner asked for a title card instead of a letter that names the hero:
`components/TitleCard.tsx`. GHOSTWRITER is typed one letter every 0.3 s in
Creepster, each letter struck with a real typewriter key (two strikes from
Pixabay 22815, alternating, pitch varied slightly). Blood runs from each letter
and some drops fall. "THE HAUNTED BUNGALOW" and three lines about the game
follow; the card fades at 6.7 s and ends at 7.4 s, and the landing's own
loading brings the total to about 8 s.

- The keys are scheduled on the AudioContext clock and the letters follow that
  clock (minus the output latency). Before any gesture the browser blocks
  sound, so the letters follow the page clock and the first click or key ties
  the rest to the audio clock.
- The landing mounts only once the title is typed: its loading blocks the page
  for about 2 s, which made the letters jump ahead when both ran together.
- `TITLE_BG` is the background; the owner's painting replaces the darkened
  landing painting when it arrives.

- The background is the owner's graveyard painting (`public/landing/title-graveyard.webp`). A blood-red loading bar fills over the card's length, with the death witch's face (cropped from `witch-reaching.webp`) riding its leading edge, bobbing. Both use transform-only CSS animations, so they keep moving while the landing loads.
