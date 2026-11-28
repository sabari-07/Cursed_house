// The grand hall painting, brought to life, plus everything Stage 1 adds to
// it: four portraits hung on the bookcase (eyes that follow you), the
// journal page on the pedestal, the locked study door, three candles that
// are Arjun's lives, the shadow on the stairs, and the witch attack that
// ends in a blood-spattered, shattered screen.

import { NOISE } from './doorShader'

export const HALL_SHADER = /* glsl */ `
  uniform sampler2D uTex, uFig, uP0, uP1, uP2, uP3, uJTex, uWitchTex;
  uniform float uTime, uScale, uFlash, uLight, uLamp, uFade;
  uniform vec2 uScreen, uImg, uOffset;
  // portraits: inverse homographies (painting px -> picture uv), eyes, look offsets
  uniform mat3 uH0, uH1, uH2, uH3, uJH;
  uniform vec4 uEyes0, uEyes1, uEyes2, uEyes3;
  uniform vec4 uEyeR, uLookX, uLookY, uHover, uShow;
  uniform float uRedEyes, uPlay;
  // journal page, study door, candles, shadow, focus
  uniform float uJHover, uJShow, uDoorHover, uDoorOpen, uSymbol, uRattle;
  uniform vec4 uDoorRect;
  // five shelf candles: flame level, wax left, smoke (cold stubs have wax ~0.3, flame 0)
  uniform float uCandleLit[5], uCandleWax[5], uCandleSmoke[5];
  uniform float uDoorCandle;
  // the riddle: blinking lids and a sheen on the glass per portrait, the
  // stopped wall clock, and up to 6 scratched letters (atlas cells)
  uniform vec4 uBlink, uGlint;
  uniform sampler2D uClockTex, uOvTex;
  uniform vec4 uClock;            // centre x, y (painting px), radius px; w: 0 none, 1 painted face + hands, 2 hands only (on the room's own clock)
  uniform vec2 uClockHands;       // hour angle, minute angle (radians, clockwise from 12)
  // overlays drawn onto the painting (letters, inscriptions, book spines,
  // dust, unlit lamps...): one atlas of 16 cells, one loop (data in riddles/*.ts)
  uniform vec4 uOvA[16];          // centre x, y, width, height (painting px)
  uniform vec4 uOvB[16];          // angle, mode, strength, atlas cell
  uniform vec3 uSwing;            // pivot x, y (painting px), angle (radians): a hanging thing swinging (the crypt bell)
  uniform vec4 uSwingRect;        // what swings: x0, y0, x1, y1
  uniform float uOvN;
  // the room: its lamps (one steady flicker value each), bright windows, moonlight shafts, floor mist, lightning focus
  uniform vec4 uLampPos[8];       // x, y, rx, ry
  uniform vec4 uLampCol[8];       // r, g, b, strength (0 = out)
  uniform vec4 uWin0, uWin1;      // soft rectangles x0, y0, x1, y1 (x0 > x1 = unused)
  uniform vec2 uWinSoft;
  uniform vec3 uShaft;            // source x, y, 1 = on
  uniform vec4 uMist;             // band in from y0..y1, out from y2..y3
  uniform vec4 uFlashE;           // centre x, y, radii
  uniform vec2 uShadow;
  uniform vec4 uFocus;
  uniform vec4 uTorch;            // the candle the player carries: x, y (painting px), radius px, strength (0 = not carried)
  uniform float uFocusK;
  // death
  uniform float uWitch, uWitchA, uShatter, uBlood, uWitchFront, uReach, uWitchForm;
  // the witch seizing Arjun: image point GRIP_ANCHOR goes to hall px uGripC,
  // uGripS hall px per image px
  uniform sampler2D uGripTex;
  uniform float uGripA, uGripS;
  uniform vec2 uGripC;
  uniform vec2 uWitchPos, uImpact;
  varying vec2 vUv;
  ${NOISE}

  vec3 art(vec2 px) {
    return texture2D(uTex, clamp(vec2(px.x / uImg.x, 1.0 - px.y / uImg.y), 0.001, 0.999)).rgb;
  }
  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
  float glow(vec2 px, vec2 c, vec2 r) { vec2 q = (px - c) / r; return exp(-dot(q, q)); }
  vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + 19.19)); }
  // Texture reads inside branches and loops use an explicit mip level
  // (textureLod), worked out from how big the picture is on screen. Implicit
  // derivatives there make Direct3D unroll and flatten the whole shader.
  float lodFor(float texels, float screenPx) { return max(0.0, log2(texels / max(screenPx, 1.0))); }
  /** A soft rectangle mask (x0 > x1 means unused). */
  float softRect(vec2 p, vec4 r, vec2 soft) {
    if (r.x > r.z) return 0.0;
    return smoothstep(r.x - soft.x, r.x + soft.x, p.x) * (1.0 - smoothstep(r.z - soft.x, r.z + soft.x, p.x))
         * smoothstep(r.y - soft.y, r.y + soft.y, p.y) * (1.0 - smoothstep(r.w - soft.y, r.w + soft.y, p.y));
  }

  // Built in three variants so the GPU compiler never has to swallow it all at
  // once (on Windows/D3D the full shader took ~7 s to compile, freezing the
  // screen): the intro has neither block, Stage 1 adds HALL_PLAY, the death
  // adds HALL_DEATH. See HallScene's precompile.
#ifdef HALL_PLAY
  // The four portraits share one copy of the portrait code (the GPU compiler
  // inlines every call, and four copies made the shader take seconds to
  // compile). The pixel's portrait is found first; only its texture is read.
  vec3 ptex(int i, vec2 t) {
    // each picture is ~74 painting px wide on the wall; the paintings are
    // ~960 px wide. A slight sharpening bias keeps the close-up crisp.
    float lod = max(0.0, lodFor(960.0, 74.0 * uScale) - 0.6);
    if (i == 0) return textureLod(uP0, t, lod).rgb;
    if (i == 1) return textureLod(uP1, t, lod).rgb;
    if (i == 2) return textureLod(uP2, t, lod).rgb;
    return textureLod(uP3, t, lod).rgb;
  }
  float pick4(vec4 v, int i) { return i == 0 ? v.x : (i == 1 ? v.y : (i == 2 ? v.z : v.w)); }
  bool inFrame(mat3 H, vec2 px, float m) {
    vec3 q = H * vec3(px, 1.0);
    vec2 uv = q.xy / q.z;
    return uv.x > -m && uv.x < 1.0 + m && uv.y > -m * 0.82 && uv.y < 1.0 + m * 0.82;
  }

  // One portrait in its gilded frame. Returns rgb + coverage.
  vec4 portrait(int ti, mat3 H, vec4 eyes, float er, vec2 look, float hover, float plain, float blink, float glint, vec2 px) {
    vec3 q = H * vec3(px, 1.0);
    vec2 uv = q.xy / q.z;
    float m = mix(0.11, 0.07, plain);
    float my = m * 0.82;
    if (uv.x < -m || uv.x > 1.0 + m || uv.y < -my || uv.y > 1.0 + my) return vec4(0.0);
    vec2 d = max(-uv, uv - 1.0);
    vec3 c;
    if (max(d.x, d.y) > 0.0) {
      // carved, tarnished gilt: a bevel across the frame, dirt in the grooves
      float f = max(d.x / m, d.y / my);
      float bevel = sin(f * 3.14159);
      vec3 gold = mix(vec3(0.36, 0.25, 0.1), vec3(0.2, 0.16, 0.12), plain);
      c = gold * (0.4 + 0.9 * bevel) + vec3(0.3, 0.22, 0.08) * pow(bevel, 8.0) * (1.0 - plain);
      c *= 0.8 + 0.35 * noise(uv * vec2(70.0, 60.0)) - 0.25 * smoothstep(0.6, 0.9, noise(uv * 23.0));
    } else {
      // the eyes follow you: the iris area is pulled toward the viewer
      vec2 s = uv;
      for (int k = 0; k < 2; k++) {
        vec2 e = k == 0 ? eyes.xy : eyes.zw;
        vec2 de = (uv - e) / vec2(er, er * 0.8);
        float w = 1.0 - smoothstep(0.35, 1.0, length(de));
        s -= look * w;
      }
      c = ptex(ti, vec2(s.x, 1.0 - s.y));
      // the lids come down: painted skin from just above the eye slides over
      // it, with a dark lash line on its edge (blink 0 = open, 1 = shut)
      if (blink > 0.0) {
        for (int k = 0; k < 2; k++) {
          vec2 e = k == 0 ? eyes.xy : eyes.zw;
          vec2 de = (uv - e) / vec2(er * 1.25, er);
          float inEye = 1.0 - smoothstep(0.85, 1.15, length(de));
          if (inEye <= 0.0) continue;
          float lidY = -1.1 + 2.3 * blink;                     // lid edge, eye units (y down)
          float lid = (1.0 - smoothstep(lidY - 0.08, lidY + 0.08, de.y)) * inEye;
          vec3 skin = ptex(ti, vec2(uv.x, 1.0 - (e.y - er * 1.7))) * 0.9;
          c = mix(c, skin, lid);
          c *= 1.0 - 0.55 * exp(-pow((de.y - lidY) * 9.0, 2.0)) * inEye * step(0.05, blink);
        }
      }
      // old varnish: yellowed, darker at the edges, fine craquelure
      c = pow(c, vec3(1.12)) * vec3(1.0, 0.94, 0.8);
      vec2 v = uv - 0.5;
      c *= 1.0 - dot(v, v) * 1.1;
      c *= 0.93 + 0.07 * smoothstep(0.2, 0.0, abs(noise(uv * 55.0) - 0.5));
      // red eyes when the house is angry; and a wet glint of candlelight in
      // every painted eye, which goes dark when the lids close, so a blink can
      // be seen from across the hall as two tiny lights winking out
      for (int k = 0; k < 2; k++) {
        vec2 e = k == 0 ? eyes.xy : eyes.zw;
        vec2 de = (uv - e) / vec2(er, er * 0.8);
        c += vec3(1.0, 0.08, 0.03) * exp(-dot(de, de) * 3.0) * uRedEyes * 1.6;
        // a pin-point catch-light, up and to the side of the pupil (not the whole eye)
        vec2 cl = (uv - e - vec2(0.18, -0.22) * er) / (er * 0.16);
        c += vec3(1.0, 0.92, 0.75) * exp(-dot(cl, cl)) * 0.7 * uPlay * (1.0 - blink);
      }
    }
    c *= 1.0 + hover * 0.6;
    // candlelight sliding over the glass (a red herring: not a blink)
    if (glint > 0.0) {
      float band = exp(-pow((uv.x + uv.y * 0.6 - glint * 2.2 + 0.4) * 5.0, 2.0));
      c += vec3(0.9, 0.8, 0.6) * band * 0.22 * sin(glint * 3.14159);
    }
    return vec4(c, 1.0);
  }

  // A candle on the shelf ledge: wax, wick, flame, light on the books.
  vec3 candle(vec3 col, vec2 px, vec2 base, float wax, float lit, float smoke, vec3 baseCol, float t) {
    float h = 6.0 + 22.0 * wax;
    vec2 q = px - base;
    // wax body (slightly perspective, darker on the side away from the flame)
    if (abs(q.x) < 3.4 && q.y < 0.0 && q.y > -h) {
      float side = 0.75 + 0.25 * cos(q.x * 0.9);
      col = vec3(0.62, 0.56, 0.44) * side * (0.35 + 0.65 * lit) + vec3(0.25, 0.12, 0.03) * lit * smoothstep(-h + 6.0, -h, q.y);
    }
    vec2 tip = base - vec2(0.0, h + 1.0);
    // flame: a soft teardrop that sways a little
    float sway = sin(t * 7.0 + base.x) * 0.6 + sin(t * 13.0) * 0.3;
    vec2 fq = (px - tip - vec2(sway * 0.5, -5.0)) / vec2(2.6, 6.0);
    float flame = exp(-dot(fq, fq) * 2.2) * lit;
    col += vec3(1.0, 0.72, 0.32) * flame * 1.6 + vec3(1.0, 0.95, 0.8) * exp(-dot(fq, fq) * 9.0) * lit;
    col += baseCol * vec3(1.0, 0.55, 0.22) * glow(px, tip, vec2(70.0, 55.0)) * 0.9 * lit;
    // smoke curling up after it goes out
    if (smoke > 0.0) {
      vec2 sq = px - tip;
      float rise = -sq.y;
      float curl = sin(rise * 0.12 + t * 2.0) * (2.0 + rise * 0.08);
      float s = exp(-pow((sq.x - curl) / (1.5 + rise * 0.06), 2.0)) * smoothstep(0.0, 6.0, rise) * (1.0 - smoothstep(20.0, 70.0, rise));
      col += vec3(0.45, 0.5, 0.5) * s * smoke * 0.5;
    }
    return col;
  }
#endif

#ifdef ROOM_PLAY
  // The stopped clock: hands drawn here so the time can be seeded, on the
  // painted face (uClock.w 1) or on the room's own painted clock (2).
  float segDist(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
  }
  vec4 clockLayer(vec2 px, vec3 room, vec3 under) {
    if (uClock.w < 0.5) return vec4(0.0);
    vec2 d = (px - uClock.xy) / uClock.z;            // y down
    float r = length(d);
    bool own = uClock.w > 1.5;
    if (r > (own ? 0.95 : 1.14)) return vec4(0.0);
    // its shadow on the wall (down and right, away from the window light)
    if (!own && r > 1.0) return vec4(vec3(0.0), 0.4 * (1.0 - smoothstep(1.0, 1.14, length(d - vec2(0.05, 0.07)))));
    vec3 c = own ? under : textureLod(uClockTex, vec2(d.x * 0.5 + 0.5, 0.5 - d.y * 0.5), lodFor(1024.0, 2.0 * uClock.z * uScale)).rgb;
    // hands: dark blued steel, the hour hand short and broad
    vec2 hd = vec2(sin(uClockHands.x), -cos(uClockHands.x));
    vec2 md = vec2(sin(uClockHands.y), -cos(uClockHands.y));
    // the hands taper from the boss to the tip; edges are softened over one
    // *screen* pixel, so they stay crisp when the clock is studied up close
    float px1 = 1.0 / (uClock.z * uScale);
    float th = clamp(dot(d, hd) / 0.5, 0.0, 1.0), tm = clamp(dot(d, md) / 0.74, 0.0, 1.0);
    float hw = mix(0.034, 0.012, th), mw = mix(0.02, 0.006, tm);
    float hh = segDist(d, -hd * 0.12, hd * 0.5);
    float mh = segDist(d, -md * 0.14, md * 0.74);
    float hand = max(1.0 - smoothstep(hw, hw + px1 * 1.2, hh), 1.0 - smoothstep(mw, mw + px1 * 1.2, mh));
    float shadow = max(1.0 - smoothstep(0.03, 0.08, segDist(d - vec2(0.025, 0.035), -hd * 0.12, hd * 0.5)),
                       1.0 - smoothstep(0.015, 0.06, segDist(d - vec2(0.025, 0.035), -md * 0.14, md * 0.74)));
    c *= 1.0 - 0.3 * shadow * step(r, 0.9);
    c = mix(c, vec3(0.05, 0.05, 0.06), hand);
    c = mix(c, vec3(0.04), 1.0 - smoothstep(0.035, 0.035 + px1, r));   // the centre boss
    if (own) return vec4(c, 1.0 - smoothstep(0.95 - px1, 0.95, r));     // the painting's own light already
    // graded into the hall: old enamel in a dark, moonlit room
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(c, vec3(l) * vec3(0.8, 0.98, 0.92), 0.35);
    c *= room * (1.0 - 0.35 * smoothstep(0.55, 1.0, r));
    c *= 0.62;
    return vec4(c, 1.0 - smoothstep(1.0 - px1, 1.0, r));
  }

  // One overlay (atlas cell B.w), turned by B.x, sized A.zw painting px.
  // Modes (B.y): 0 a scratch (a pale cut with a dark groove below), 1 ink or
  // engraving (the cell's own colour), 2 a tint of the painting (book
  // spines), 3 shade (an unlit lamp), 4 dust written by a finger, 5 a glow
  // (candlelight letters in water).
  vec3 overlay(vec3 col, vec2 px, vec4 A, vec4 B) {
    vec2 d = px - A.xy;
    float ca = cos(B.x), sa = sin(B.x);
    vec2 q = vec2(ca * d.x + sa * d.y, -sa * d.x + ca * d.y) / A.zw;
    if (abs(q.x) > 0.5 || abs(q.y) > 0.5) return col;
    vec2 cuv = vec2((B.w + q.x + 0.5) / 16.0, 0.5 - q.y);
    float lod = lodFor(128.0, max(A.z, A.w) * uScale);
    vec4 tx = textureLod(uOvTex, cuv, lod);
    float m = tx.a * B.z;
    if (B.y < 0.5) {
      float sh = textureLod(uOvTex, cuv + vec2(-0.012 / 16.0, 0.03), lod).a * B.z;
      col *= 1.0 - 0.5 * max(0.0, sh - m);
      vec3 cut = vec3(0.62, 0.66, 0.6) * (0.55 + 0.45 * uLight) + vec3(0.25, 0.15, 0.05) * uLamp * 0.3;
      return mix(col, cut, m * 0.8);
    }
    if (B.y < 1.5) return mix(col, tx.rgb * (0.55 + 0.45 * uLight), m);
    // a coloured surface (a book's spine) lit like what is under it: bright
    // where the lamp falls, dim in the shadows, never flat paint
    if (B.y < 2.5) return mix(col, tx.rgb * clamp(luma(col) * 2.6 + 0.3, 0.35, 1.15) * (0.55 + 0.45 * uLight), m);
    if (B.y < 3.5) return col * (1.0 - m);
    if (B.y < 4.5) return mix(col, vec3(0.6, 0.66, 0.63) * (0.45 + 0.55 * uLight), m);
    return col + tx.rgb * m * (0.6 + 0.4 * uLamp);
  }
#endif

#ifdef HALL_DEATH
  // ── The witch: hat, face, hair, hands and robe down to the hips (cut-out
  // illustration with alpha); below the hips she trails into smoke.
  // uWitchPos = where her face is on screen (uv), uWitch = image height in
  // screen heights, uReach = her clawed hands lifting toward Arjun (0..1).
  const vec2 W_FACE = vec2(0.496, 0.656);     // face centre in image uv (v up)
  const float W_ASPECT = 0.9624;              // 1230 / 1278
  const float W_HIP = 0.17;                   // where the robe turns to smoke, image v
  vec2 reachWarp(vec2 p, vec2 c, vec2 off, float k) {
    // liquify: the hand at c is carried to m and enlarged (it comes closer);
    // the robe is pulled over the place it left
    vec2 m = c + off * k;
    vec2 metric = vec2(W_ASPECT, 1.0);
    float s = 1.0 + 0.7 * k;
    float wNew = exp(-dot((p - m) * metric, (p - m) * metric) / (0.075 * 0.075 * s * s));
    vec2 src = c + (p - m) / s;
    float wOld = exp(-dot((p - c) * metric, (p - c) * metric) / (0.07 * 0.07)) * k * (1.0 - wNew);
    vec2 q = mix(p, src, wNew);
    return q + vec2(0.0, -0.11) * wOld;
  }
  vec4 witchLayer(vec2 suv) {
    if (uWitchA <= 0.0) return vec4(0.0);
    vec2 sa = vec2(uScreen.x / uScreen.y, 1.0);
    vec2 w = (suv - uWitchPos) * sa / uWitch;
    vec2 p = vec2(w.x / W_ASPECT, w.y) + W_FACE;
    if (p.x < -0.2 || p.x > 1.2 || p.y < -0.45 || p.y > 1.05) return vec4(0.0);
    float t = uTime;
    // the hands rise up and out, claws toward him
    // her hands are already stretched out: they only push a little further
    vec2 q = reachWarp(p, vec2(0.15, 0.45), vec2(-0.03, 0.04), uReach * 0.6);
    q = reachWarp(q, vec2(0.90, 0.40), vec2(0.03, 0.04), uReach * 0.6);
    // the robe ripples as she glides
    q.x += (noise(vec2(q.y * 9.0, t * 1.5)) - 0.5) * 0.012 * smoothstep(0.6, 0.3, q.y);
    vec4 tex = vec4(0.0);
    if (q.x > 0.0 && q.x < 1.0 && q.y > 0.0 && q.y < 1.0) tex = texture2D(uWitchTex, q);
    // She forms out of smoke: the robe condenses from the floor up, her face
    // last. uWitchForm 0 = nothing but smoke, 1 = fully there.
    float formN = fbm(q * 5.0 + vec2(0.0, -t * 0.25));
    float reveal = smoothstep(0.0, 0.18, uWitchForm * 1.6 - formN * 0.6 - q.y * 0.55);
    tex.a *= reveal;
    // the robe dissolves into smoke below the hips
    float edgeN = fbm(vec2(q.x * 7.0, q.y * 5.0 - t * 0.8));
    float body = tex.a * smoothstep(W_HIP - 0.1, W_HIP + 0.05, q.y + (edgeN - 0.5) * 0.14);
    vec3 wc = tex.rgb;
    float wl = luma(wc);
    // graded into the hall: teal-green shadows, cold highlights, a ghostly lift
    wc = mix(wc, vec3(wl) * vec3(0.72, 0.96, 0.9), 0.4) * (0.75 + 0.35 * uLight) + vec3(0.0, 0.015, 0.015);
    wc += vec3(0.5, 0.9, 0.85) * uFlash * 0.4 * wl;
    // her eyes burn red
    vec2 e1 = (q - vec2(0.456, 0.697)) / vec2(0.016, 0.0075);
    vec2 e2 = (q - vec2(0.537, 0.697)) / vec2(0.016, 0.0075);
    float eyes = exp(-dot(e1, e1)) + exp(-dot(e2, e2));
    wc += vec3(1.0, 0.12, 0.04) * eyes * 1.6;
    // smoke: a column trailing from the hips, narrowing and curling as it falls
    float cx = 0.5 + sin(p.y * 7.0 + t * 1.3) * 0.035;
    float halfW = mix(0.1, 0.34, smoothstep(-0.42, W_HIP + 0.05, p.y));
    float d1 = fbm(vec2((p.x - 0.5) * 5.0, p.y * 3.2 + t * 0.9));
    float d2 = fbm(vec2(p.x * 12.0 + 3.0, p.y * 8.0 + t * 1.7));
    float column = 1.0 - smoothstep(halfW * 0.45, halfW, abs(p.x - cx));
    float dens = (d1 * 0.75 + d2 * 0.4) * column;
    float smoke = smoothstep(0.32, 0.72, dens) * smoothstep(-0.44, -0.1, p.y) * (1.0 - smoothstep(W_HIP - 0.02, W_HIP + 0.14, p.y));
    vec3 sc = mix(vec3(0.02, 0.04, 0.05), vec3(0.3, 0.48, 0.48), smoothstep(0.4, 0.95, dens)) * (0.55 + 0.45 * uLight + uFlash * 0.6);
    float a = max(body, smoke * 0.85);
    vec3 c = mix(sc, wc, body / max(a, 0.0001));
    // eyes glow even in the smoke of her face
    a = max(a, clamp(eyes * 0.9, 0.0, 1.0) * tex.a);
    return vec4(c, clamp(a, 0.0, 1.0) * uWitchA);
  }

  const vec2 GRIP_SIZE = vec2(1024.0, 1536.0);
  const vec2 GRIP_ANCHOR = vec2(515.0, 300.0);        // the witch's face, image px
  vec4 gripLayer(vec2 px) {
    if (uGripA <= 0.0) return vec4(0.0);
    vec2 ip = (px - uGripC) / uGripS + GRIP_ANCHOR;
    if (ip.x < 0.0 || ip.y < 0.0 || ip.x > GRIP_SIZE.x || ip.y > GRIP_SIZE.y) return vec4(0.0);
    vec4 tex = texture2D(uGripTex, vec2(ip.x / GRIP_SIZE.x, 1.0 - ip.y / GRIP_SIZE.y));
    vec3 c = tex.rgb;
    float l = luma(c);
    // graded into the hall: the room's light level, a teal cast, lightning
    c = mix(c, vec3(l) * vec3(0.75, 0.98, 0.92), 0.25) * (0.7 + 0.4 * uLight);
    c += vec3(0.5, 0.9, 0.85) * uFlash * 0.5 * l;
    // her eyes burn
    vec2 e1 = (ip - vec2(492.0, 298.0)) / vec2(11.0, 7.0);
    vec2 e2 = (ip - vec2(560.0, 298.0)) / vec2(11.0, 7.0);
    c += vec3(1.0, 0.12, 0.04) * (exp(-dot(e1, e1)) + exp(-dot(e2, e2))) * 1.3;
    // his lantern still burns as it falls: a warm pool in the smoke
    vec2 lq = (ip - vec2(105.0, 1270.0)) / vec2(70.0, 90.0);
    c += vec3(1.0, 0.55, 0.2) * exp(-dot(lq, lq)) * 0.25 * tex.a;
    return vec4(c, tex.a * uGripA);
  }
#endif

  void main() {
    float t = uTime;
    // ── shattered glass: every shard shifts the picture behind it a little
    vec2 suv = vUv;
    float crack = 0.0;
    float shardShade = 0.0;
#ifdef HALL_DEATH
    if (uShatter > 0.0) {
      // Work in screen pixels so every crack is a hairline, whatever the size.
      vec2 P = vUv * uScreen;
      vec2 dp = P - uImpact * uScreen;
      float r = length(dp) / uScreen.y;
      // Small crushed shards around the impact only, growing with distance;
      // most of their edges are fine cracks, some are missing.
      float density = mix(5.0, 34.0, exp(-r * 4.0));
      vec2 g = dp / uScreen.y * density;
      vec2 id = floor(g), f = fract(g);
      float d1 = 9.0, d2 = 9.0;
      vec2 best = vec2(0.0);
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        vec2 o = vec2(float(x), float(y));
        vec2 pt = o + hash2(id + o) * 0.9;
        float dd = length(pt - f);
        if (dd < d1) { d2 = d1; d1 = dd; best = id + o; } else if (dd < d2) { d2 = dd; }
      }
      float edgePx = (d2 - d1) / density * uScreen.y;
      float keep = step(0.3, hash(best + 3.3));
      crack = (1.0 - smoothstep(0.5, 1.4, edgePx)) * mix(0.55, 1.0, smoothstep(0.9, 0.06, r)) * keep;
      // Long radial cracks that zig-zag: each is a chain of straight segments
      // that kink at random angles, like real glass splitting, thinning to a
      // hairline at the tip. Point-to-segment distance per segment.
      for (int i = 0; i < 13; i++) {
        float fi = float(i);
        float baseA = (fi + (hash(vec2(fi, 1.0)) - 0.5) * 0.5) * 6.2832 / 13.0;
        float len = (0.9 + 0.9 * hash(vec2(fi, 2.0))) * uScreen.y;    // px: long enough to reach every edge
        vec2 node = vec2(0.0);                                        // from the impact
        float a = baseA;
        float travelled = 0.0;
        for (int seg = 0; seg < 5; seg++) {
          if (travelled > len) break;
          float segLen = len * (0.14 + 0.16 * hash(vec2(fi, float(seg) + 5.0)));
          a += (hash(vec2(fi * 3.1, float(seg))) - 0.5) * 0.9;        // kink
          vec2 dir = vec2(cos(a), sin(a));
          vec2 e = node + dir * segLen;
          // distance from dp to the segment [node, e]
          vec2 pa = dp - node, ba = e - node;
          float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1.0), 0.0, 1.0);
          float dSeg = length(pa - ba * h);
          float w = mix(1.4, 0.35, clamp((travelled + h * segLen) / len, 0.0, 1.0));
          crack = max(crack, (1.0 - smoothstep(w, w + 0.9, dSeg)) * keep);
          node = e;
          travelled += segLen;
        }
      }
      // A couple of curved ring cracks joining the radials near the impact.
      float ringR = r * uScreen.y;
      for (int k = 0; k < 2; k++) {
        float rr0 = (0.05 + 0.06 * float(k)) * uScreen.y;
        float wob = (noise(vec2(atan(dp.y, dp.x) * 3.0, float(k) * 4.0)) - 0.5) * 0.03 * uScreen.y;
        crack = max(crack, (1.0 - smoothstep(0.6, 1.5, abs(ringR - rr0 - wob))) * smoothstep(0.3, 0.05, r) * 0.7 * keep);
      }
      // the crushed white star where it hit
      crack = max(crack, (1.0 - smoothstep(0.004, 0.03, r)) * 0.9);
      crack *= uShatter;
      vec2 off = (hash2(best * 1.7) - 0.5) * 0.007 * uShatter * mix(0.4, 1.0, smoothstep(0.9, 0.0, r));
      suv += off;
      shardShade = (hash(best) - 0.5) * 0.18 * uShatter * mix(0.45, 1.0, smoothstep(0.9, 0.0, r));
    }
#endif

    vec2 sp = vec2(suv.x * uScreen.x, (1.0 - suv.y) * uScreen.y);
    vec2 px = (sp - uOffset) / uScale;
    // the study door rattles in its frame
    vec2 dpx = px;
    float inDoorR = step(uDoorRect.x, px.x) * step(px.x, uDoorRect.z) * step(uDoorRect.y, px.y) * step(px.y, uDoorRect.w);
    dpx.x += inDoorR * uRattle * sin(t * 70.0) * 1.2;
#ifdef ROOM_PLAY
    // a hanging thing swings on its chain: its pixels turn about the pivot,
    // fading to still at the edges of its rectangle
    // (no branch: coordinates that feed the painting's texture() must not
    // depend on one, or Direct3D flattens the whole shader; angle 0 = still)
    {
      float a = -uSwing.z * softRect(px, uSwingRect, vec2(22.0));
      vec2 d = dpx - uSwing.xy;
      dpx = uSwing.xy + vec2(cos(a) * d.x - sin(a) * d.y, sin(a) * d.x + cos(a) * d.y);
    }
#endif
    vec3 base = art(dpx);
    float lb = luma(base);

    // the room's bright windows keep their light when the lamps dip
    float windows = smoothstep(0.55, 0.85, lb) * max(softRect(px, uWin0, uWinSoft), softRect(px, uWin1, uWinSoft));
    vec3 col = base * mix(uLight, 1.0, windows * 0.7);

    // the room's lamps (one loop; each lamp's strength is one steady value, 0 = out)
    vec3 warm = vec3(1.0, 0.62, 0.3), teal = vec3(0.35, 0.95, 0.9);
    float lamps = 0.0;
    for (int i = 0; i < 8; i++) {
      float g = glow(px, uLampPos[i].xy, max(uLampPos[i].zw, vec2(1.0))) * uLampCol[i].w;
      col += base * uLampCol[i].rgb * g * uLamp * uLight * 1.1;
      lamps += g;
    }

    // moonlight shafts falling from the room's high window
    float shafts = 0.0;
    if (uShaft.z > 0.5) {
      vec2 d = px - uShaft.xy;
      float ang = atan(d.x, d.y);
      float dist = length(d);
      shafts = smoothstep(0.35, 0.85, noise(vec2(ang * 22.0, t * 0.12)));
      shafts *= smoothstep(-0.5, -0.1, ang) * (1.0 - smoothstep(0.55, 0.85, ang));
      shafts *= smoothstep(80.0, 260.0, dist) * (1.0 - smoothstep(420.0, 820.0, dist));
    }
    float cloud = 0.75 + 0.25 * sin(t * 0.35);
    col += vec3(0.32, 0.7, 0.7) * shafts * 0.16 * cloud * (0.6 + 0.4 * uLight);

    vec2 fw = (px - uFlashE.xy) / uFlashE.zw;
    col += (base * 1.4 + vec3(0.35, 0.6, 0.65) * 0.25) * uFlash * exp(-dot(fw, fw) * 1.6);
    col += vec3(0.6, 0.9, 0.95) * uFlash * windows * 0.6;

    // ── Stage 1 objects ─────────────────────────────────────────────────
#ifdef HALL_PLAY
    if (uPlay > 0.0) {
      // light that reaches the bookcase: the teal lamp above, the candles below
      float tealLamp = glow(px, vec2(1158.0, 335.0), vec2(45.0, 40.0));
      vec3 room = vec3(0.42, 0.55, 0.52) * (0.55 + 0.45 * uLight) + teal * tealLamp * 0.9;
      float candleLight = (uCandleLit[0] + uCandleLit[1] + uCandleLit[2] + uCandleLit[3] + uCandleLit[4]) / 4.0;
      room += warm * glow(px, vec2(1140.0, 570.0), vec2(160.0, 120.0)) * 0.55 * candleLight;
      room += vec3(0.7, 0.85, 0.9) * uFlash;
      // the portrait under this pixel, if any (the frames don't overlap; while
      // the Collector's portrait falls after the win, it is drawn on top)
      int pi = -1;
      if (inFrame(uH0, px, 0.11)) pi = 0;
      else if (inFrame(uH1, px, 0.11)) pi = 1;
      else if (inFrame(uH2, px, 0.07)) pi = 2;
      else if (inFrame(uH3, px, 0.11)) pi = 3;
      if (pi >= 0) {
        mat3 H = pi == 0 ? uH0 : (pi == 1 ? uH1 : (pi == 2 ? uH2 : uH3));
        vec4 E = pi == 0 ? uEyes0 : (pi == 1 ? uEyes1 : (pi == 2 ? uEyes2 : uEyes3));
        vec4 p = portrait(pi, H, E, pick4(uEyeR, pi), vec2(pick4(uLookX, pi), pick4(uLookY, pi)), pick4(uHover, pi),
                          pi == 2 ? 1.0 : 0.0, pick4(uBlink, pi), pick4(uGlint, pi), px);
        col = mix(col, p.rgb * room, p.a * pick4(uShow, pi));
      }

      // the torn journal page on the stone pedestal
      vec3 jq = uJH * vec3(px, 1.0);
      vec2 juv = jq.xy / jq.z;
      if (juv.x > 0.0 && juv.x < 1.0 && juv.y > 0.0 && juv.y < 1.0 && uJShow > 0.0) {
        float torn = step(0.12 * noise(vec2(juv.y * 14.0, 3.0)), 1.0 - juv.x);
        vec3 page = texture2D(uJTex, vec2(juv.x, 1.0 - juv.y)).rgb;
        page *= vec3(0.34, 0.44, 0.42) * (0.75 + 0.25 * uLight) + warm * uJHover * 0.45;
        col = mix(col, page, torn * uJShow);
      }
      col += warm * glow(px, vec2(668.0, 552.0), vec2(40.0, 16.0)) * uJHover * 0.35 * uJShow;

      // the study door: a warm edge when you can use it; opens onto red dark
      vec2 dc = vec2((uDoorRect.x + uDoorRect.z) * 0.5, (uDoorRect.y + uDoorRect.w) * 0.5);
      vec2 dh = vec2(uDoorRect.z - uDoorRect.x, uDoorRect.w - uDoorRect.y) * 0.5;
      vec2 dq = abs(px - dc) - dh;
      float edge = exp(-pow(max(dq.x, dq.y) / 3.0, 2.0));
      col += warm * edge * uDoorHover * 0.6;
      if (inDoorR > 0.0 && uDoorOpen > 0.0) {
        float k = smoothstep(0.0, 1.0, (px.x - uDoorRect.x) / (dh.x * 2.0) * 1.2 - (1.0 - uDoorOpen) * 1.2 + 0.2);
        vec3 voidCol = vec3(0.05, 0.005, 0.0) + vec3(0.35, 0.05, 0.0) * glow(px, dc + vec2(0.0, 20.0), dh * 1.2) * uSymbol;
        col = mix(col, voidCol, (1.0 - k) * uDoorOpen);
      }
      // THE EYE, burning above the door once the order is right
      if (uSymbol > 0.0) {
        vec2 e = (px - vec2(dc.x, uDoorRect.y - 12.0)) / vec2(14.0, 7.0);
        float almond = 1.0 - smoothstep(0.85, 1.0, abs(e.y) / max(0.0001, 1.0 - e.x * e.x));
        almond *= step(abs(e.x), 1.0);
        float iris = 1.0 - smoothstep(0.3, 0.42, length(e * vec2(1.0, 1.9) * 0.5));
        float outline = almond * (1.0 - (1.0 - smoothstep(0.65, 0.8, abs(e.y) / max(0.0001, 1.0 - e.x * e.x))));
        float sym = max(outline, iris * almond);
        col += vec3(1.0, 0.7, 0.25) * sym * uSymbol * 1.5;
        col += vec3(1.0, 0.55, 0.15) * glow(px, vec2(dc.x, uDoorRect.y - 12.0), vec2(40.0, 26.0)) * uSymbol * 0.5;
      }

      // three candles on the shelf ledge, and the one that lights by the door
      // five candles on the shelf ledge (the ledge falls 1 px every 20 px)
      // light that the five shelf candles cast (cheap, everywhere), then the
      // candles themselves, only near the shelf (loops, not copies: see ptex)
      for (int i = 0; i < 5; i++) {
        vec2 cb = vec2(1090.0 + 25.0 * float(i), 598.0 - 1.25 * float(i));
        if (abs(px.x - cb.x) < 90.0 && abs(px.y - cb.y + 20.0) < 80.0)
          col = candle(col, px, cb, uCandleWax[i], uCandleLit[i], uCandleSmoke[i], base, t + float(i) * 1.3);
      }

      if (uDoorCandle > 0.0) col = candle(col, px, vec2(592.0, 552.0), 0.8, uDoorCandle, 0.0, base, t + 4.1);

      // someone crosses the top of the stairs
      if (uShadow.y > 0.0) {
        vec2 sh = px - vec2(uShadow.x, 0.0);
        float body = exp(-pow(sh.x / 11.0, 2.0) - pow((sh.y - 372.0) / 30.0, 2.0));
        float head = exp(-pow(sh.x / 7.0, 2.0) - pow((sh.y - 336.0) / 8.0, 2.0));
        float dens = clamp(body + head, 0.0, 1.0);
        col *= 1.0 - 0.75 * dens * uShadow.y;
      }
    }
#endif

    // ── every room's clues: the stopped clock and the overlays
#ifdef ROOM_PLAY
    {
      vec4 ck = clockLayer(px, vec3(0.62, 0.72, 0.68) * (0.6 + 0.4 * uLight) + warm * lamps * 0.5 * uLamp, col);
      col = mix(col, ck.rgb, ck.a);
      // OV_N: how many the loop can draw (Direct3D unrolls it, so the hall,
      // which needs 6, compiles a shorter loop than the painted rooms)
      for (int i = 0; i < OV_N; i++) {
        if (float(i) < uOvN) col = overlay(col, px, uOvA[i], uOvB[i]);
      }
    }
#endif

    // ── the candle the player carries: warm light round the pointer that
    // lifts the dark (one steady value, flickering as a whole, never waving)
    {
      vec2 tq = (px - uTorch.xy) / max(uTorch.z, 1.0);
      float tg = exp(-dot(tq, tq) * 1.4) * uTorch.w;
      col = col * (1.0 + 1.5 * tg) + base * vec3(1.0, 0.66, 0.36) * tg * 0.6;
    }

    // ── the witch, while she looms beyond Arjun (he stands in front of her)
#ifdef HALL_DEATH
    vec4 witchCol = witchLayer(suv);
    if (uWitchA > 0.0 && uWitchFront < 0.5) {
      col *= 1.0 - 0.35 * uWitchA * smoothstep(0.4, 1.5, uWitch);
      col = mix(col, witchCol.rgb, witchCol.a);
    }
#endif

    // ── Arjun (3D, rendered to uFig) composited like the painting's figure
    vec2 texel = 1.0 / uScreen;
    vec4 fig = texture2D(uFig, suv);
    float fa = fig.a * 0.36
      + (texture2D(uFig, suv + vec2(texel.x, 0.0)).a + texture2D(uFig, suv - vec2(texel.x, 0.0)).a
       + texture2D(uFig, suv + vec2(0.0, texel.y)).a + texture2D(uFig, suv - vec2(0.0, texel.y)).a) * 0.16;
    if (fa > 0.001) {
      vec3 fc = pow(max(fig.rgb / max(fig.a, 0.001), 0.0), vec3(1.0 / 2.2));
      // only broad, slow variation (fine screen-space grain made the cloth read as flocked felt)
      fc *= 0.94 + 0.12 * (noise(sp / vec2(60.0, 180.0)) - 0.5);
      // graded into the painting: the same cold cast, blacks lifted to the room's haze,
      // and the darker parts a little desaturated like the painted shadows
      float fl = dot(fc, vec3(0.299, 0.587, 0.114));
      fc = mix(vec3(fl), fc, 0.65 + 0.35 * smoothstep(0.05, 0.35, fl));
      fc = fc * vec3(0.78, 1.0, 0.97) + vec3(0.006, 0.022, 0.024);
      float edge = clamp(fa * (1.0 - fa) * 4.0, 0.0, 1.0);
      fc += base * vec3(0.5, 0.9, 0.85) * edge * 0.35;
      col = mix(col, fc, fa);
    }

    // ── the witch seizing Arjun (replaces the 3D Arjun while she holds him)
#ifdef HALL_DEATH
    vec4 grip = gripLayer(px);
    if (grip.a > 0.0) {
      col *= 1.0 - 0.3 * uGripA;                 // the room falls away around them
      col = mix(col, grip.rgb, grip.a);
    }
#endif

    vec2 mq = px / vec2(300.0, 90.0) + vec2(t * 0.045, 0.0);
    float mist = smoothstep(0.42, 0.8, fbm(mq + fbm(mq * 0.6 - t * 0.02)));
    float floorBand = smoothstep(uMist.x, uMist.y, px.y) * (1.0 - smoothstep(uMist.z, uMist.w, px.y));
    float onFig = fa * (1.0 - smoothstep(uMist.y, uMist.y + 120.0, px.y));
    col = mix(col, vec3(0.3, 0.62, 0.6) * (0.55 + 0.45 * uLight + uFlash), mist * floorBand * 0.32 * (1.0 - onFig));

    for (int layer = 0; layer < 2; layer++) {
      float sz = layer == 0 ? 22.0 : 38.0;
      float speed = layer == 0 ? 0.25 : 0.45;
      vec2 cell = px / sz + vec2(sin(t * 0.3 + px.y * 0.01) * 0.3, -t * speed);
      vec2 id = floor(cell);
      vec2 f = fract(cell) - vec2(0.2 + 0.6 * hash(id), 0.2 + 0.6 * hash(id + 3.1));
      float mote = exp(-dot(f, f) * (layer == 0 ? 220.0 : 140.0)) * step(0.82, hash(id + 7.7));
      float lit = 0.35 + 0.65 * (shafts + windows + lamps);
      col += vec3(0.75, 0.95, 0.92) * mote * lit * (layer == 0 ? 0.3 : 0.45) * (0.5 + 0.5 * uLight);
    }

    // inspecting: everything except the object falls into darkness
    if (uFocusK > 0.0) {
      vec2 fq = abs(px - uFocus.xy) - uFocus.zw;
      float outside = smoothstep(0.0, 30.0, max(fq.x, fq.y));
      col *= 1.0 - 0.72 * outside * uFocusK;
    }

    vec2 vg = suv - 0.5;
    col *= 1.0 - dot(vg, vg) * 0.5;
    // visibility: lift the shadows so the paintings, portraits and clues read (before the death's own darkness)
    col = pow(max(col, 0.0), vec3(0.78)) * 1.04;

    // ── the witch, when she rushes through Arjun at the screen
#ifdef HALL_DEATH
    if (uWitchA > 0.0 && uWitchFront >= 0.5) {
      col *= 1.0 - 0.5 * uWitchA * smoothstep(0.4, 2.0, uWitch);   // the room darkens around her
      col = mix(col, witchCol.rgb, witchCol.a);
    }

    // ── blood and cracks on the glass
    if (uShatter > 0.0) {
      col *= 1.0 + shardShade;
      // a hairline: bright where it catches the light, dark just beside it
      col = mix(col, vec3(0.86, 0.9, 0.9), crack * 0.65);
    }
    if (uBlood > 0.0) {
      vec2 P = vUv * uScreen;                                    // px, y up
      vec2 I = uImpact * uScreen + vec2(-0.02, 0.03) * uScreen.y;
      vec2 q = (P - I) / uScreen.y;
      float rr = length(q);
      float grow = smoothstep(0.0, 0.18, uBlood);
      // the main splat: an irregular, lobed edge
      float lobes = fbm(vec2(atan(q.y, q.x) * 2.2, 1.0)) * 0.09 + fbm(q * 34.0) * 0.025;
      float rad = (0.075 + lobes) * grow;
      float splat = 1.0 - smoothstep(rad - 0.004, rad, rr);
      // spatter flung outward: droplets, denser and larger near the splat
      float drops = 0.0;
      for (int k = 0; k < 2; k++) {
        float sc = k == 0 ? 22.0 : 55.0;
        vec2 cell = q * sc + float(k) * 13.0;
        vec2 cid = floor(cell);
        vec2 cf = fract(cell) - (0.2 + 0.6 * hash2(cid));
        float dist = length((cid + 0.5) / sc - float(k) * 13.0 / sc);
        float prob = smoothstep(0.42, 0.08, dist) * (k == 0 ? 0.35 : 0.5);
        float size = (k == 0 ? 0.22 : 0.16) * (0.4 + 0.6 * hash(cid + 9.0)) * smoothstep(0.5, 0.1, dist);
        // drops stretch away from the impact
        vec2 away = normalize((cid + 0.5) / sc - float(k) * 13.0 / sc + 1e-4);
        vec2 e = vec2(dot(cf, away) * 0.6, dot(cf, vec2(-away.y, away.x)));
        drops = max(drops, step(1.0 - prob, hash(cid + 5.0)) * (1.0 - smoothstep(size * 0.7, size, length(e))));
      }
      drops *= grow;
      // drips running down the glass from the bottom of the splat
      float cw = 11.0;
      float cidx = floor(P.x / cw);
      float h1 = hash(vec2(cidx, 2.0));
      float cxp = cidx * cw + cw * (0.3 + 0.4 * hash(vec2(cidx, 6.0)));
      float spread = abs(cxp - I.x) / uScreen.y;
      float has = step(0.5, h1) * step(spread, 0.09);
      float topY = I.y - (0.05 + 0.035 * hash(vec2(cidx, 7.0))) * uScreen.y * (1.0 - spread * 4.0);
      float speed = 0.35 + 0.65 * hash(vec2(cidx, 9.0));
      float len = smoothstep(0.12, 1.0, uBlood) * speed * 0.42 * uScreen.y;
      float xw = 1.3 + 2.6 * hash(vec2(cidx, 4.0));
      float along = topY - P.y;
      float wob = (noise(vec2(cidx, along * 0.02)) - 0.5) * 3.0;
      float dx = abs(P.x - cxp - wob);
      float w = xw * (1.0 - 0.35 * clamp(along / max(len, 1.0), 0.0, 1.0));
      float drip = has * step(0.0, along) * step(along, len) * (1.0 - smoothstep(w - 0.6, w + 0.6, dx));
      drip = max(drip, has * step(2.0, len) * (1.0 - smoothstep(xw * 1.3, xw * 1.3 + 1.0, length(P - vec2(cxp + wob, topY - len)))));
      float blood = clamp(max(max(splat, drops), drip), 0.0, 1.0);
      // thick in the middle (almost black-red), thin film at the edges
      float thick = clamp(splat * smoothstep(rad, rad * 0.25, rr) + drip * 0.5 + drops * 0.4, 0.0, 1.0);
      vec3 bc = mix(vec3(0.55, 0.02, 0.03), vec3(0.16, 0.0, 0.008), thick);
      bc *= 0.85 + 0.3 * fbm(P / 9.0);
      // wet highlights where the light catches the surface
      float gloss = pow(max(0.0, noise(P / 7.0 + 3.0) - 0.62) * 2.6, 3.0) * thick;
      bc += vec3(0.75, 0.35, 0.32) * gloss;
      col = mix(col, bc, blood * mix(0.78, 0.97, thick));
    }
#endif

    col += (hash(sp + fract(t) * 91.0) - 0.5) * 0.02;
    gl_FragColor = vec4(max(col, 0.0) * (1.0 - uFade), 1.0);
  }
`
