// Bakes Arjun's painted face and hair (ArjunModel.paintHead, per-pixel work that took
// ~3 s on phones) into public/arjun/skin.png and hair.png. Re-run after changing paintHead.
// usage: node scripts/bake-arjun.cjs   (dev server running on 5178)
const fs = require('fs'), path = require('path')
const { launch, BASE } = require('../tests/browser/lib.cjs')
;(async () => {
  const { browser, page } = await launch()
  await page.goto(BASE + '/?nointro', { waitUntil: 'load' })
  const out = await page.evaluate(async () => {
    const m = await import('/src/three/ArjunModel.ts')
    const { skin, hair } = m.paintArjunHead()
    return { skin: skin.toDataURL('image/png'), hair: hair.toDataURL('image/png') }
  })
  const dir = path.join(__dirname, '..', 'public', 'arjun')
  fs.mkdirSync(dir, { recursive: true })
  for (const k of ['skin', 'hair']) fs.writeFileSync(path.join(dir, `${k}.png`), Buffer.from(out[k].split(',')[1], 'base64'))
  console.log('written', fs.readdirSync(dir).map(f => `${f} ${fs.statSync(path.join(dir, f)).size} B`).join(', '))
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
