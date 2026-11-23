// Bakes the landing painting once, so phones don't do it while the title card plays:
// runs LandingScene.preparePainting (figure and painted bats removed, JPEG blocks smoothed,
// unsharp mask) on public/landing/bungalow.webp in the dev server, and saves the
// result as public/landing/bungalow-prepared.webp. Re-run after changing preparePainting.
// usage: node scripts/prepare-landing.cjs   (dev server running on 5178)
const fs = require('fs'), path = require('path')
const { launch, BASE } = require('../tests/browser/lib.cjs')
;(async () => {
  const { browser, page } = await launch()
  await page.goto(BASE + '/?nointro&prepare', { waitUntil: 'load' })
  await page.waitForFunction(() => window.__landing, null, { timeout: 60000 })
  const url = await page.evaluate(async () => {
    const img = new Image(); img.src = '/landing/bungalow.webp'; await img.decode()
    const c = window.__landing.preparePainting(img)
    return c.toDataURL('image/webp', 0.9)
  })
  const out = path.join(__dirname, '..', 'public', 'landing', 'bungalow-prepared.webp')
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'))
  console.log('written', out, fs.statSync(out).size, 'bytes')
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
