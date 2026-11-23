// Shaders shared by the hall scene: noise helpers and the door-slam shot.

export const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
    return v;
  }
`

// ── Shot 1: the photo of the front door, night-graded, doors swinging ─────
export const DOOR_SHADER = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uTime, uScale, uOpen, uFlash, uLight, uDust, uFade;
  uniform vec2 uScreen, uImg, uOffset;
  uniform vec4 uDoor;
  varying vec2 vUv;
  ${NOISE}

  vec3 photo(vec2 px) {
    return texture2D(uTex, clamp(vec2(px.x / uImg.x, 1.0 - px.y / uImg.y), 0.001, 0.999)).rgb;
  }
  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
  // The photo's light becomes cold moonlight, dimmer, with crushed shadows.
  vec3 night(vec3 c) {
    float l = luma(c);
    return mix(vec3(l), c, 0.25) * vec3(0.4, 0.52, 0.6) * pow(l, 0.55) * 0.95;
  }
  // The storm through the open doorway.
  vec3 outside(vec2 dl, vec2 px) {
    vec3 sky = mix(vec3(0.42, 0.48, 0.58), vec3(0.18, 0.21, 0.27), smoothstep(0.2, 0.75, dl.y));
    sky = mix(sky, vec3(0.55, 0.6, 0.68), fbm(vec2(dl.x * 3.0 + uTime * 0.05, dl.y * 2.0)) * 0.35 * (1.0 - dl.y));
    float ground = smoothstep(0.66, 0.74, dl.y + (noise(vec2(dl.x * 8.0, 1.0)) - 0.5) * 0.04);
    sky = mix(sky, vec3(0.07, 0.07, 0.09), ground);
    vec2 q1 = (dl - vec2(0.2, 0.735)) * vec2(1.0, 2.2);
    sky += vec3(0.9, 0.42, 0.12) * exp(-dot(q1, q1) * 260.0) * 0.35;
    vec2 rp = vec2(px.x * 1.6 + px.y * 0.18, px.y * 0.045 - uTime * 16.0);
    sky += vec3(0.55, 0.6, 0.7) * step(0.992, hash(floor(rp))) * smoothstep(0.0, 0.5, fract(rp.y)) * 0.16 * (1.0 - ground * 0.7);
    return sky * (1.0 + uFlash * 2.5);
  }

  void main() {
    vec2 sp = vec2(vUv.x * uScreen.x, (1.0 - vUv.y) * uScreen.y);
    vec2 px = (sp - uOffset) / uScale;
    vec3 base = photo(px);
    float lb = luma(base);
    vec3 col = night(base) * uLight;
    vec2 dsz = uDoor.zw - uDoor.xy;
    float inDoorRect = step(uDoor.x, px.x) * step(px.x, uDoor.z) * step(uDoor.y, px.y) * step(px.y, uDoor.w);
    col = mix(col, vec3(0.62, 0.7, 0.86) * (0.75 + uFlash * 1.5), inDoorRect * smoothstep(0.72, 0.9, lb) * 0.85);
    vec2 fromDoor = (px - vec2((uDoor.x + uDoor.z) * 0.5, uDoor.w)) / vec2(500.0, 300.0);
    col += night(base) * vec3(0.7, 0.8, 1.0) * uFlash * 2.2 * exp(-dot(fromDoor, fromDoor) * 2.0);

    // Two leaves hinged on the outer edges, opening toward us.
    if (uOpen > 0.001) {
      float ang = uOpen * 1.42;
      float halfW = dsz.x * 0.5;
      float projW = halfW * cos(ang);
      float cy = (uDoor.y + uDoor.w) * 0.5;
      vec3 c = vec3(-1.0);
      vec2 dl = (px - uDoor.xy) / dsz;
      if (inDoorRect > 0.0) c = outside(dl, px);
      for (int side = 0; side < 2; side++) {
        float hinge = side == 0 ? uDoor.x : uDoor.z;
        float dir = side == 0 ? 1.0 : -1.0;
        float u = (px.x - hinge) * dir / max(projW, 0.5);
        float g = 1.0 + 0.38 * sin(ang) * u;               // the free edge is closer: taller
        float v = 0.5 + (px.y - cy) / (dsz.y * g);
        if (u >= 0.0 && u <= 1.0 && v >= 0.0 && v <= 1.0) {
          vec3 leaf = photo(vec2(hinge + dir * u * halfW, uDoor.y + v * dsz.y));
          vec3 lc = night(leaf) * uLight * (1.0 - 0.45 * sin(ang));
          c = mix(lc, vec3(0.5, 0.58, 0.72) * (0.8 + uFlash), smoothstep(0.72, 0.9, luma(leaf)) * 0.8);
        }
      }
      if (c.x >= 0.0) col = c;
    }

    // Dust shaken loose by the slam.
    if (uDust > 0.0) {
      vec2 cell = px / 18.0 + vec2(0.0, -uTime * 0.35);
      vec2 id = floor(cell);
      vec2 f = fract(cell) - vec2(hash(id), hash(id + 3.1));
      col += vec3(0.7, 0.75, 0.85) * exp(-dot(f, f) * 160.0) * step(0.6, hash(id + 7.7)) * 0.35 * (0.3 + lb);
    }
    vec2 vg = vUv - 0.5;
    col *= 1.0 - dot(vg, vg) * 1.1;
    col += (hash(sp + fract(uTime) * 91.0) - 0.5) * 0.025;
    gl_FragColor = vec4(max(col, 0.0) * (1.0 - uFade), 1.0);
  }
`
