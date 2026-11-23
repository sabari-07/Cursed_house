# Requirements: Stage 1 — The Riddle of the Hall

## Introduction

This spec replaces the gameplay of `stage1-hall-of-watching-eyes` (the portrait
ordering puzzle). Everything around the gameplay stays: the entrance cinematic,
the hall, Arjun, the portraits with watching eyes, the HUD style and the witch
death sequence.

The new Stage 1 asks the player **one question** in plain English. The answer
is hidden in the hall. The player has **one chance** and a **time limit** to find
it and give it. A right answer opens the study and leads to the next stage. A
wrong answer, or running out of time, ends in the witch death and a return to
the landing page.

The question and the hidden answer change on every playthrough, so the stage
cannot be memorised.

## Glossary

- **Riddle**: one question type from the pool, with its own clues and answer kind.
- **Run**: one attempt at Stage 1, from the start of play to the win or the death.
- **Seed**: the random number that fixes the riddle and its values for one run.
- **Clue**: something in the hall the player must see to work out the answer.
- **Answer kind**: a number, a word, or a portrait.

## Requirement 1: One question per run

**User story:** As a player, I want a clear question when the stage starts, so
that I know exactly what I am looking for.

#### Acceptance criteria

1. WHEN Stage 1 play begins THEN the system SHALL pick a riddle from the pool and
   its values using a new seed.
2. WHEN play begins THEN the system SHALL show the full question at the top of
   the screen, with the timer, and keep it there until the stage ends (win or
   death).
3. THE question SHALL be written in plain English: sentences of at most 20 words,
   common words, no puns or wordplay that depend on being a native speaker.
4. THE question SHALL state what kind of answer is expected (a number, a word, or
   one of the portraits).
5. WHEN the player dies and plays Stage 1 again THEN the system SHALL use a new
   seed, so the answer differs from the previous run.

## Requirement 2: The answer is in the hall

**User story:** As a player, I want the answer to be findable by looking
carefully, so that winning depends on observation and not on luck.

#### Acceptance criteria

1. Every clue needed for the answer SHALL be visible in the hall during play,
   either at all times or when the player inspects an object up close.
2. THE answer SHALL need at least two clues combined (hard level).
3. Each riddle SHALL include at least one red herring: something that looks like
   a clue but does not lead to the answer.
4. For every seed, the clues SHALL allow exactly one answer.
5. No scare, flicker or animation SHALL hide a clue for more than 2 seconds.

## Requirement 3: Inspecting the hall

**User story:** As a player, I want to look closely at objects, so that I can
find small clues.

#### Acceptance criteria

1. WHEN the player hovers over an object that can be inspected THEN the system
   SHALL highlight it and show a small prompt next to it.
2. WHEN the player clicks it THEN the system SHALL move the camera close, dim
   everything else and show a notes panel describing what Arjun sees.
3. Inspecting SHALL NOT cost time beyond the normal timer, and SHALL NOT count
   as an answer.

## Requirement 4: One chance to answer

**User story:** As a player, I want to give my answer once, on purpose, so that
the single chance feels tense but fair.

#### Acceptance criteria

1. WHEN the player clicks the ANSWER button under the question (or presses A)
   THEN the system SHALL open the answer panel, showing the question again and
   an input that matches the answer kind: a number keypad, letter wheels, or a
   choice of the four portraits. The study door is scenery and opens nothing.
2. WHEN the player submits THEN the system SHALL ask for confirmation, saying
   that there is only one chance.
3. IF the player cancels THEN the system SHALL close the panel and nothing SHALL
   be lost.
4. IF the confirmed answer is right THEN the system SHALL run the win sequence
   (Requirement 6).
5. IF the confirmed answer is wrong THEN the system SHALL run the death sequence
   (Requirement 7).
6. Answers SHALL be compared ignoring letter case and surrounding spaces.

## Requirement 5: Time limit

**User story:** As a player, I want visible time pressure, so that the hall feels
dangerous.

#### Acceptance criteria

1. THE run SHALL last at most 180 seconds of play.
2. THE HUD SHALL show the time left, and the shelf candles SHALL burn down with it.
3. WHEN 30 seconds are left THEN the system SHALL play a heartbeat and turn the
   timer red.
4. WHEN the time reaches zero THEN the system SHALL run the death sequence.
5. WHILE the answer panel or the confirmation is open THE timer SHALL keep running.

## Requirement 6: Winning the stage

#### Acceptance criteria

1. WHEN the answer is right THEN the system SHALL open the study door and show
   THE EYE burning above it.
2. THE system SHALL save `stage1Complete: true` and the symbol `eye` in versioned
   local storage.
3. THE system SHALL then show a "Stage 1 complete" card with a button to continue
   to the next stage.

## Requirement 7: Death

#### Acceptance criteria

1. WHEN a wrong answer is confirmed, or the time runs out, THEN the system SHALL
   run the witch death: the laugh, the witch dropping in front of Arjun, his
   scream, then the whole screen goes black while he screams, then the grab
   rises out of the black, then the shattered and bloody screen, GAME OVER, and
   the return to the landing page.
2. THE GAME OVER screen SHALL show the right answer and one line explaining it,
   so the player learns how the riddle worked.

## Requirement 8: Riddle pool

#### Acceptance criteria

1. THE first version SHALL ship three riddles, one of each answer kind:
   - **The Stopped Clock** (number)
   - **The Scratched Word** (word)
   - **The One Who Blinks** (portrait)
2. Each riddle SHALL be defined as data plus pure functions (values from a seed,
   question text, answer), so it can be tested without a browser.
3. Adding a riddle SHALL NOT need changes to the answer panel or the HUD.
