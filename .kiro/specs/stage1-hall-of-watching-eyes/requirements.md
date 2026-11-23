# Requirements: Stage 1 — The Hall of Watching Eyes

## Introduction

Stage 1 is the first trial inside the bungalow. It is played in the same grand
hall the player sees in the entrance cinematic, so there is no page change between
the story and the game. The player must work out the order in which four family
members entered the study, using the portraits and a torn journal page, and enter
that order on the study door. Mistakes cost candles (lives), and the candles also
burn down over time. Losing ends in the witch attack; winning grants THE EYE.

## Requirement 1: Continuity with the cinematic

**User story:** As a player, I want the game to start in the hall I just walked
into, so that the story feels like one continuous experience.

#### Acceptance criteria

1. WHEN the Stage 1 title has been shown over the hall for its full duration THEN
   the system SHALL start Stage 1 in the same scene without loading another page.
2. WHEN the player presses SKIP during the cinematic THEN the system SHALL stop the
   cinematic audio and start Stage 1 immediately.
3. WHILE Stage 1 is playing THE system SHALL show Arjun, the same 3D model as on the
   landing page, standing in the hall.

## Requirement 2: Portraits with watching eyes

**User story:** As a player, I want to study the four portraits closely, so that I
can tell the family members apart.

#### Acceptance criteria

1. THE system SHALL hang four portraits (the Collector, the Wife, the Son, the
   Caretaker) on the bookcase, in the painting's perspective.
2. THE system SHALL hang them in an order different from the solution, so that
   their position is not a hint.
3. WHILE Stage 1 is playing THE portraits' eyes SHALL turn toward the mouse cursor.
4. WHEN the player hovers over a portrait THEN the system SHALL highlight it and
   show a small prompt next to it.
5. WHEN the player clicks a portrait or presses E while hovering over it THEN the
   system SHALL move the camera in close to it, dim everything else, and show a
   notes panel with the corroded name plate and what Arjun notices.
6. Each portrait's notes SHALL name the object that identifies it: a gold watch,
   a white flower, a key, an hourglass.

## Requirement 3: The journal clue

**User story:** As a player, I want a written clue, so that the solution can be
reasoned out instead of guessed.

#### Acceptance criteria

1. THE system SHALL place a torn journal page on the stone pedestal in the hall.
2. WHEN the player clicks the page or presses J THEN the system SHALL show the full
   page in a readable panel.
3. The journal clues SHALL admit exactly one order: the caretaker first, the wife
   before the son, and the collector last.

## Requirement 4: The study door lock

**User story:** As a player, I want to enter my answer on the door, so that I can
test my reasoning.

#### Acceptance criteria

1. WHEN the player clicks the study door THEN the system SHALL open a lock panel
   with four numbered slots and the four faces.
2. WHEN the player clicks a face THEN the system SHALL place it in the first empty
   slot; clicking a placed face SHALL remove it.
3. IF the player turns the handle with an empty slot THEN the system SHALL refuse,
   explain why, and SHALL NOT cost a life.
4. IF the order is wrong THEN the system SHALL put out one candle, make the
   portraits' eyes burn red, play a muffled laugh and heartbeat, and clear the slots.
5. IF the order is right THEN the system SHALL run the solve sequence (Requirement 6).

## Requirement 5: Candles as lives and time

**User story:** As a player, I want visible stakes, so that the hall feels dangerous.

#### Acceptance criteria

1. THE system SHALL show three lit candles on the shelf ledge and three small candle
   icons in the HUD.
2. WHILE Stage 1 is playing THE candles SHALL burn down over 300 seconds, and the
   HUD SHALL show the time left.
3. WHEN the last candle goes out (three wrong answers) OR the time reaches zero THEN
   the system SHALL start the death sequence (Requirement 7).

## Requirement 6: Solving the stage

#### Acceptance criteria

1. WHEN the order is right THEN the system SHALL put out the shelf candles, make the
   Collector's portrait fall from the bookcase, light one candle beside the study
   door, open the door, and show THE EYE burning above it.
2. THE system SHALL save `stage1Complete: true` and the symbol `eye` in versioned
   local storage.
3. THE system SHALL then show a reward card with THE EYE and a way back to the gates.

## Requirement 7: Death

**User story:** As a player, I want failure to be terrifying, so that the stakes are real.

#### Acceptance criteria

1. WHEN the death sequence starts THEN the system SHALL play the witch's laugh
   again, with the lights stuttering to its loudness.
2. The witch SHALL appear at the top of the broken staircase, glide toward Arjun
   and lunge at the screen; Arjun SHALL scream as she reaches him.
3. WHEN she hits THEN the system SHALL shatter the screen with hairline cracks and
   spatter it with blood that drips downwards, with a glass-shatter sound.
4. THE system SHALL then show GAME OVER in the dripping red font and, after the
   screen fades out, return to a fresh landing page.

## Requirement 8: Scripted scares that never block clues

#### Acceptance criteria

1. At a fixed time during play, a shadow SHALL cross the top of the staircase.
2. At a fixed time, the study door SHALL rattle in its frame with a muffled slam.
3. No scare SHALL open, close or cover a panel, or hide a clue.
