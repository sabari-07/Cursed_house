# Requirements: the haunted intro letter and the sign-in popup

## Introduction

The first five seconds and the sign-in are the first things a judge sees. The
site opens on a letter from Arjun's grandfather, written in haunting letters
while the landing page loads behind it. Then the bungalow appears with its
sounds, and SIGN IN and SIGN UP are offered. Signing in happens in a popup with
a witch flying on her broom behind it, and a wrong password is answered by the
house.

## Requirements

### 1. The intro letter

**User story:** As a visitor, I want the game to introduce itself in a haunting
way, so I know what it is before I see the house.

1. When the site opens, the system shall show the grandfather's letter for 5
   seconds, written letter by letter in handwriting, then fade into the landing
   page.
2. The landing page shall load behind the letter, so it is ready when the letter
   fades.
3. When the visitor clicks or presses a key during the letter, the system shall
   start the landing sounds at once (browsers only allow sound after a gesture).
4. If there is no gesture, the landing shall open silent, and the first click or
   key anywhere shall start the sound.
5. The letter shall be skippable (click, Enter or Escape skip to the landing).
6. Under `prefers-reduced-motion`, the letter shall appear whole, without the
   writing animation.

### 2. Sign in and sign up on the landing page

1. When nobody is signed in, the landing shall show SIGN IN and SIGN UP buttons.
2. When a signed-out visitor presses ENTER THE BUNGALOW, the system shall open
   the sign-in popup instead of entering.
3. SIGN IN shall ask for a username and a password.
4. SIGN UP shall ask for a username, a password and the password again. If the
   two passwords differ, the system shall say so and create nothing.
5. The landing's sounds shall keep playing behind the popup.

### 3. The witch behind the popup

1. While the popup is open, a witch shall fly on her broom across the night sky
   behind it, from one side to the other, again and again.
2. She shall read as part of the painting: a dark silhouette lit at the edge by
   moonlight, with a trail of smoke from the broom and motion blur. No cartoon
   colours.
3. When the owner supplies a painted witch-on-broom image, it shall replace the
   silhouette without code changes elsewhere (one constant).

### 4. A wrong password

1. When sign-in fails, the house shall answer: the flying witch is gone, the
   witch's face rushes at the screen out of the dark with red eyes, her laugh
   plays, the light dips once, and a hairline crack runs across the password
   box.
2. The error message shall stay plain text and readable, and the scare shall
   never hide the form for more than 1.2 s.
3. The scare shall respect the global mute.

### 5. Must not break

1. Level 1, 2 and 3 browser runs keep passing (they sign up through the popup).
2. Every new asset is credited in README.md.
