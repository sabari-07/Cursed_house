// npm run audit:credits — every asset under public/ must have a row in the
// README's "Asset credits" table (assets-and-licensing steering rule).
//
// A file counts as credited when its path (public/...) appears in the table,
// or matches a wildcard written there (public/audio/wolf-*.mp3). Also lists
// credit rows that name a file that no longer exists. Exits 1 on any problem.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const readme = readFileSync(join(root, 'README.md'), 'utf8')
const start = readme.indexOf('## Asset credits')
if (start < 0) { console.error('README.md has no "## Asset credits" section'); process.exit(1) }
const next = readme.indexOf('\n## ', start + 5)
const table = readme.slice(start, next < 0 ? undefined : next)

// every `public/...` path written in the table (in backticks)
const named = [...table.matchAll(/`(public\/[^`]+)`/g)].map(m => m[1])
const toRegex = p => new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$')
const patterns = named.map(toRegex)

/** Files that are not assets: generated data, the favicon placeholder. */
const IGNORE = [/^public\/data\//]

function walk(dir) {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [relative(root, p).split(sep).join('/')]
  })
}

const files = walk(join(root, 'public')).filter(f => !IGNORE.some(r => r.test(f)))
const missing = files.filter(f => !patterns.some(r => r.test(f)))
const stale = named.filter((p, i) => !files.some(f => patterns[i].test(f)))

console.log(`${files.length} files in public/, ${named.length} credit entries in README.md`)
for (const f of missing) console.log(`  NOT CREDITED  ${f}`)
for (const p of stale) console.log(`  NO SUCH FILE  ${p} (credited, but not in public/)`)
if (!missing.length && !stale.length) console.log('Every asset is credited, and every credit names a real file.')
process.exit(missing.length || stale.length ? 1 : 0)
