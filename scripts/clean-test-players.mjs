// Removes the players the live check (tests/browser/live.cjs) creates: names starting
// "live_" or "ui" followed by 6 letters/digits, and their sessions. Nothing else is touched.
// usage: node scripts/clean-test-players.mjs [--dry-run]
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { aws } from './aws-env.mjs'

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'config', 'deploy')
const TEST = /^(live_|ui_)[a-z0-9]{6}$/
const items = aws(['dynamodb', 'scan', '--table-name', 'cursed-house', '--projection-expression', 'pk, sk, #n, #u', '--expression-attribute-names', '{"#n":"name","#u":"user"}']).Items
const users = items.filter(i => i.sk.S === 'PROFILE' && TEST.test(i.name?.S || ''))
const keys = new Set(users.map(u => u.pk.S.slice(5)))
const sessions = items.filter(i => i.sk.S === 'SESSION' && keys.has(i.user?.S))
console.log(`test players: ${users.map(u => u.name.S).join(', ') || 'none'}; their sessions: ${sessions.length}; other items kept: ${items.length - users.length - sessions.length}`)
if (process.argv.includes('--dry-run')) process.exit(0)
for (const it of [...users, ...sessions]) {
  const f = path.join(OUT, 'key.json')
  writeFileSync(f, JSON.stringify({ pk: it.pk, sk: it.sk }))
  aws(['dynamodb', 'delete-item', '--table-name', 'cursed-house', '--key', `file://${f}`], { json: false })
}
console.log('removed')
