# Requirements: Levels, Treasures, Accounts and Leaderboard

## Introduction

The game grows from one stage into **three playable levels of five stages
each**. Level 4 is shown as "coming soon".

- **One room per level.** All five stages of a level are played in the same
  room. Each stage asks a new question about that room. The room changes when
  the level changes.
- **Harder each level.** Later levels give less time, need more clues per
  answer and plant more red herrings.
- **One treasure per level.** Finishing all five stages of a level wins its
  treasure.
- **Accounts.** Players sign in, so their level, stage, treasures and times are
  kept and ranked on a leaderboard. Accounts are stored as JSON in the browser.

The rules from `stage1-riddle-of-the-hall` apply to every stage:
- one question, kept at the top of the screen
- one chance
- the ANSWER button, then a fixed number of seconds to answer
- a seeded, dynamic answer
- the witch death on failure

## Glossary

- **Level:** one room and its five stages, ending in a treasure.
- **Stage:** one question in that room.
- **Run:** one attempt at a stage.
- **Treasure:** the reward for finishing a level.
- **Account:** a player's name, password hash and progress, stored in the
  browser.
- **Seed file:** `public/data/users.json`, a read-only list deployed with the
  game.

## Requirement 1: Levels and rooms

**User story:** As a player, I want each level to take place in its own room,
so that progress feels like going deeper into the house.

#### Acceptance criteria

1. THE game SHALL have these levels:

   | Level | Room |
   | --- | --- |
   | 1 | The Grand Hall (the existing hall) |
   | 2 | The Library of Whispers |
   | 3 | The Crypt Beneath |
   | 4 | The Attic (coming soon) |

2. All five stages of a level SHALL take place in that level's room, without
   loading another page.
3. WHEN a stage is won and it is not the fifth THEN the system SHALL change the
   room in place and ask the next stage's question. The change is a short
   blackout with a sound, after which the room's clues have been rearranged.
4. WHEN Level 4 is reached, or selected, THEN the system SHALL show a "Coming
   soon" card over the landing page, and SHALL NOT start a stage.

## Requirement 2: Level 1 stages

#### Acceptance criteria

1. Level 1 SHALL play these stages, in this order, in the Grand Hall:

   | Stage | Riddle | Answer |
   | --- | --- | --- |
   | 1 | **The One Who Blinks** (the portrait puzzle) | A portrait |
   | 2 | **The Stopped Clock** | A number |
   | 3 | **The Scratched Word** | A word |
   | 4 | **Who Moved?**: two portraits swap places in the dark | A portrait |
   | 5 | **The Marked Page**: letters marked in the journal spell a word | A word |

2. Each stage SHALL keep its question, its clues and its answer seeded per run.

## Requirement 3: Difficulty per level

**User story:** As a player, I want each level to be harder than the last, so
that the game stays challenging.

#### Acceptance criteria

1. THE rules SHALL differ by level:

   | Rule | Level 1 | Level 2 | Level 3 |
   | --- | --- | --- | --- |
   | Time for the stage | 180 s | 150 s | 120 s |
   | Time to answer, once ANSWER is pressed | 15 s | 15 s | 12 s |
   | Clues needed for the answer | at least 2 | at least 3 | at least 3 |
   | Red herrings | at least 1 | at least 2 | at least 3 |
   | Chances | 1 | 1 | 1 |

2. Every answer SHALL still follow from clues the player can find. Every
   question SHALL be in plain English (sentences of at most 20 words, common
   words).

## Requirement 4: Treasures

#### Acceptance criteria

1. Each level SHALL award one treasure when its fifth stage is won:

   | Level | Treasure |
   | --- | --- |
   | 1 | **The Collector's Gold Watch.** It stopped the night he vanished. |
   | 2 | **The Raven Codex.** His book of secrets. |
   | 3 | **The Heart of the House.** The ruby that kept the house alive. |

2. WHEN a treasure is won THEN the system SHALL show it on a reveal card over
   the room, save it to the account, and offer CONTINUE.
3. CONTINUE SHALL return to the landing page. The next ENTER THE BUNGALOW SHALL
   lead into the next level's room.
4. THE landing page SHALL show the signed-in player's treasures.

## Requirement 5: Progress and death

#### Acceptance criteria

1. THE system SHALL save the account's progress after every stage won: level,
   stage, treasures, and the best time per stage.
2. WHEN the player dies THEN the death sequence SHALL play and the game SHALL
   return to the landing page. The next attempt SHALL resume at the same stage,
   with a new seed.
3. Deaths SHALL be counted per account.
4. Progress saved by the current Stage 1 (`ghostwriter_progress_v1`) SHALL be
   migrated into the account's progress the first time an account signs in on
   that browser.

## Requirement 6: Accounts (JSON in the browser)

**User story:** As a player, I want to sign in, so that my levels and
treasures are remembered and ranked.

#### Acceptance criteria

1. THE landing page SHALL offer SIGN IN and CREATE ACCOUNT before ENTER THE
   BUNGALOW.
2. A new account SHALL need a name (3 to 16 letters, digits, spaces, `-` or
   `_`, unique ignoring case) and a password (at least 6 characters).
3. Accounts SHALL be stored in `localStorage` under `ghostwriter_users_v1`, as
   versioned JSON.
4. Passwords SHALL NOT be stored. Only a salted hash SHALL be stored
   (PBKDF2-SHA-256 with a random 16-byte salt and 100,000 iterations, through
   the Web Crypto API).
5. A session (`ghostwriter_session_v1`) SHALL keep the player signed in until
   they choose SIGN OUT.
6. Wrong credentials SHALL show one message that doesn't say whether the name
   or the password was wrong.
7. A deployed `public/data/users.json` (the seed file) SHALL be read at
   start-up. It SHALL list leaderboard entries only (names and progress, no
   passwords), and accounts created in the browser SHALL be added to it on that
   browser.
8. In development only, the leaderboard SHALL offer EXPORT USERS.JSON, which
   downloads the browser's accounts in the seed-file format, without any
   password hash, so they can be committed and deployed.

## Requirement 7: Leaderboard

#### Acceptance criteria

1. THE landing page SHALL have a LEADERBOARD button that opens a ranked table.
2. Players SHALL be ranked by:
   1. treasures, most first
   2. then level and stage reached, highest first
   3. then the total of their best stage times, lowest first
   4. then deaths, fewest first
3. Each row SHALL show the rank, name, treasures, level and stage, total time
   and deaths.
4. The signed-in player's row SHALL be highlighted.

## Requirement 8: Honest limits

1. THE README SHALL state that accounts are stored per browser. They are not a
   secure login, and the leaderboard only includes the seed file and the
   accounts on that browser.
2. THE seed file SHALL never contain passwords or password hashes, because
   every file under `public/` can be downloaded by anyone.
