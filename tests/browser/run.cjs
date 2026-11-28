// npm run test:browser [-- name ...]: runs browser checks one after another.
// Names: level1 (default), guest, signin, level (LEVEL=2|3), death (LEVEL=2|3), titlecard,
// mobile (a phone held sideways: title, landing, hall by touch), mobile2 (sign-in and a room
// answered by touch; LEVEL, STAGE, OBJ), mobile3 (a phone held upright), mobile4 (full screen and the install manifest), candle (one press picks it up), phoneperf (frame rate on a slowed phone), phonesound (sound on a phone under the real autoplay rule), lights (where the landing's lantern,
// pumpkin and window effects act, in painting px), responsive (text size and fit on laptops and phones),
// pumpkins (the jack-o'-lanterns visibly flicker, read back from the picture), housevoice (Grandfather's
// first-visit guide and the GAME OVER lines).
// Needs the dev server: npm run dev.
const { spawnSync } = require('child_process')
const path = require('path')
const ALL = ['level1', 'guest', 'signin', 'level', 'death', 'titlecard', 'mobile', 'mobile2', 'mobile3', 'mobile4', 'candle', 'phoneperf', 'phonesound', 'lights', 'responsive', 'pumpkins', 'housevoice']
let names = process.argv.slice(2)
if (!names.length) names = ['level1']
if (names[0] === 'all') names = ALL
let failed = 0
for (const n of names) {
  if (!ALL.includes(n)) { console.error(`unknown check "${n}"; choose from ${ALL.join(', ')}`); process.exit(2) }
  console.log(`\n── ${n}`)
  // the phone checks set MOBILE themselves; the desktop ones must not inherit it
  const env = { ...process.env }
  if (!n.startsWith('mobile')) delete env.MOBILE
  const r = spawnSync(process.execPath, [path.join(__dirname, `${n}.cjs`)], { stdio: 'inherit', env })
  if (r.status !== 0) { failed++; console.log(`── ${n} FAILED (exit ${r.status})`) }
}
console.log(`\n${names.length - failed} of ${names.length} checks passed. Screenshots: tests/browser/out/`)
process.exit(failed ? 1 : 0)
