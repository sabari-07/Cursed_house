# Requirements: Landing page and ENTER THE BUNGALOW

## Introduction

The opening must feel like a scene, not a webpage: the bungalow at night, Arjun on
the path, and a cinematic walk to the door when the player chooses to enter.

## Requirement 1: Living landing scene

1. THE system SHALL show the bungalow painting with moving storm clouds, a full
   moon, rain, ground fog and 19 animated bats (7 circling the moon, 10 crossing
   the sky, 2 swooping close). Bats painted into the art SHALL be removed, and
   so SHALL the painted figure on the path and her lantern's glow.
2. THE system SHALL show Arjun (3D, fedora, long coat, lantern) on the path where
   the painted figure stood; he faces the viewer, then turns to look at the house.
3. Firelight on the house and pumpkins SHALL be steady. One tree lantern and two
   pumpkins on opposite sides of the path SHALL blink, each on its own schedule.
   A blinking light SHALL go fully dark, flame included, and SHALL be one that
   no landing-page control covers.
4. One upstairs window SHALL stutter off and on every 6–9 seconds.

## Requirement 2: Storm and wildlife sound

1. WHEN the visitor has tapped the entry screen THEN the landing's sound SHALL
   start by itself when the title card ends, with no second tap, on desktop and
   on phones (one shared AudioContext unlocked by that tap). WHEN the landing
   is opened without the entry screen THEN the first click or key SHALL start it.
2. Lightning SHALL be driven by the loudness envelope of the thunder recording, so
   every burst of the clap lights the scene at the moment it is heard.
3. A distant wolf howl SHALL play 1.5 s after audio starts, then every 12 s.
4. The sound button SHALL name the action a click performs (TURN SOUND OFF / ON).

## Requirement 3: ENTER THE BUNGALOW

1. WHEN the player clicks ENTER THE BUNGALOW THEN the camera SHALL push in to the
   front door while Arjun walks up the path with a real gait (knees, planted feet,
   arm swing, lantern pendulum, coat moving with the legs), getting smaller with
   distance.
2. Only the ghostly drone and the door creak from the supplied recording SHALL be
   heard; every knock SHALL be cut out when the clip is decoded.
3. The door SHALL swing open in step with the creak's energy, and Arjun SHALL walk
   in as it finishes and fade into the dark.
4. The push-in SHALL stay shallow enough that the painting's pixels never show.
5. There SHALL be no skip button for players (the owner's decision); the browser
   checks use a development-only hook to fast-forward.

## Requirement 4: Inside

1. The front doors SHALL slam shut behind Arjun, with a jolt and dust.
2. The view SHALL cut to the grand hall with the broken staircase while
   "Welcome back… I've waited" plays, immediately followed by the witch's laugh,
   with the lights stuttering to each cackle.
3. The Stage 1 title SHALL appear over the live hall in the dripping red font.

## Requirement 5: Phones

1. The landing SHALL be built behind the entry screen, paused while the title
   card plays, so the house appears without a freeze when the card ends.
2. On a phone held sideways the scene SHALL fill the screen; held upright, the
   player SHALL be asked to turn the phone.
