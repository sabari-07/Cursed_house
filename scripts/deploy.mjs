// Deploys The Cursed House to AWS (ap-south-1) with the credentials in config/.env:
//   1. the Amplify Hosting app "the-cursed-house" and its "main" branch (the site's address),
//   2. the backend stack "cursed-house" (infra/template.yaml): DynamoDB table, Lambda, HTTP API,
//   3. the game, built with that API's address, uploaded to the branch.
// usage: node scripts/deploy.mjs [--skip-build]   (re-running updates everything in place)
import { readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { aws, awsProcessEnv, loadDeployEnv } from './aws-env.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'config', 'deploy')
const APP_NAME = 'the-cursed-house', BRANCH = 'main', STACK = 'cursed-house'
const REGION = loadDeployEnv().AWS_REGION
const log = s => console.log(`· ${s}`)
mkdirSync(OUT, { recursive: true })

/**
 * Zips a folder's contents with forward-slash paths (Amplify and Lambda need
 * them; PowerShell's Compress-Archive writes backslashes, so .NET is used on Windows).
 */
function zip(dir, file) {
  rmSync(file, { force: true })
  const ps = `Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem; ` +
    `$z = [IO.Compression.ZipFile]::Open('${file}', 'Create'); $root = (Resolve-Path '${dir}').Path; ` +
    `Get-ChildItem -LiteralPath $root -Recurse -File | ForEach-Object { $rel = $_.FullName.Substring($root.Length + 1).Replace('\\', '/'); ` +
    `[void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z, $_.FullName, $rel, 'Optimal') }; $z.Dispose()`
  const r = process.platform === 'win32'
    ? spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' })
    : spawnSync('zip', ['-qr', file, '.'], { cwd: dir, stdio: 'inherit' })
  if (r.status !== 0) throw new Error('zip failed: ' + dir)
}

// ── 1. the site's address (needed first: the API only answers this site) ──
const account = aws(['sts', 'get-caller-identity']).Account
log(`account ${account}, region ${REGION}`)
let app = aws(['amplify', 'list-apps']).apps.find(a => a.name === APP_NAME)
if (!app) {
  app = aws(['amplify', 'create-app', '--name', APP_NAME, '--platform', 'WEB', '--description', 'The Cursed House: a horror puzzle game for Kiroween 2026']).app
  log(`created Amplify app ${app.appId}`)
}
// long caching for the paintings, recordings and fonts; the page itself is always fresh
const headers = [
  'customHeaders:',
  '  - pattern: "**/*"',
  '    headers:',
  '      - key: Strict-Transport-Security',
  '        value: max-age=31536000; includeSubDomains',
  '      - key: X-Content-Type-Options',
  '        value: nosniff',
  '      - key: Referrer-Policy',
  '        value: strict-origin-when-cross-origin',
  '  - pattern: "assets/**"',
  '    headers:',
  '      - key: Cache-Control',
  '        value: public, max-age=31536000, immutable',
  ...['audio', 'rooms', 'hall', 'landing', 'stage1', 'fonts'].flatMap(d => [`  - pattern: "${d}/**"`, '    headers:', '      - key: Cache-Control', '        value: public, max-age=604800']),
  '  - pattern: "index.html"',
  '    headers:',
  '      - key: Cache-Control',
  '        value: no-cache',
].join('\n') + '\n'
writeFileSync(path.join(OUT, 'headers.yml'), headers)
aws(['amplify', 'update-app', '--app-id', app.appId, '--custom-headers', `file://${path.join(OUT, 'headers.yml')}`])
let branch = aws(['amplify', 'list-branches', '--app-id', app.appId]).branches.find(b => b.branchName === BRANCH)
if (!branch) {
  branch = aws(['amplify', 'create-branch', '--app-id', app.appId, '--branch-name', BRANCH, '--stage', 'PRODUCTION', '--display-name', 'play']).branch
  log(`created branch ${BRANCH}`)
}
// Amplify serves a branch under its display name: https://play.<app id>.amplifyapp.com
const site = `https://${branch.displayName || BRANCH}.${app.defaultDomain}`
log(`site address ${site}`)

// ── 2. the backend ─────────────────────────────────────────────────────────
const bucket = `cursed-house-deploy-${account}-${REGION}`
try { aws(['s3api', 'head-bucket', '--bucket', bucket], { json: false }) } catch {
  aws(['s3api', 'create-bucket', '--bucket', bucket, '--create-bucket-configuration', `LocationConstraint=${REGION}`])
  aws(['s3api', 'put-public-access-block', '--bucket', bucket, '--public-access-block-configuration', 'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'], { json: false })
  log(`created private bucket ${bucket} (Lambda code only)`)
}
const lambdaZip = path.join(OUT, 'lambda.zip')
zip(path.join(ROOT, 'infra', 'lambda'), lambdaZip)
const codeKey = `lambda/${createHash('sha256').update(readFileSync(path.join(ROOT, 'infra', 'lambda', 'index.mjs'))).digest('hex').slice(0, 16)}.zip`
aws(['s3', 'cp', lambdaZip, `s3://${bucket}/${codeKey}`, '--only-show-errors'], { json: false })
log('deploying the backend stack (DynamoDB, Lambda, HTTP API)…')
aws(['cloudformation', 'deploy', '--stack-name', STACK, '--template-file', path.join(ROOT, 'infra', 'template.yaml'), '--capabilities', 'CAPABILITY_IAM',
  '--no-fail-on-empty-changeset', '--parameter-overrides', `CodeBucket=${bucket}`, `CodeKey=${codeKey}`, `AllowedOrigin=${site}`], { json: false })
const outputs = Object.fromEntries(aws(['cloudformation', 'describe-stacks', '--stack-name', STACK]).Stacks[0].Outputs.map(o => [o.OutputKey, o.OutputValue]))
log(`API ${outputs.ApiUrl}, table ${outputs.TableName}`)
writeFileSync(path.join(OUT, 'outputs.json'), JSON.stringify({ site, api: outputs.ApiUrl, table: outputs.TableName, appId: app.appId }, null, 2))

// ── 3. the game ────────────────────────────────────────────────────────────
if (!process.argv.includes('--skip-build')) {
  log('building the game…')
  const env = { ...process.env, VITE_API_URL: outputs.ApiUrl }
  for (const k of Object.keys(env)) if (/^AWS_/.test(k)) delete env[k]          // the build never sees the keys
  const b = spawnSync('npm', ['run', 'build'], { cwd: ROOT, env, stdio: 'inherit', shell: true })
  if (b.status !== 0) throw new Error('build failed')
}
const built = readFileSync(path.join(ROOT, 'dist', 'index.html'), 'utf8') && existsSync(path.join(ROOT, 'dist', 'assets'))
if (!built) throw new Error('dist/ is missing')
const siteZip = path.join(OUT, 'site.zip')
zip(path.join(ROOT, 'dist'), siteZip)
const dep = aws(['amplify', 'create-deployment', '--app-id', app.appId, '--branch-name', BRANCH])
const up = await fetch(dep.zipUploadUrl, { method: 'PUT', body: readFileSync(siteZip), headers: { 'content-type': 'application/zip' } })
if (!up.ok) throw new Error(`upload failed: ${up.status} ${await up.text()}`)
aws(['amplify', 'start-deployment', '--app-id', app.appId, '--branch-name', BRANCH, '--job-id', dep.jobId])
log(`uploading to Amplify (job ${dep.jobId})…`)
for (let i = 0; i < 90; i++) {
  await new Promise(r => setTimeout(r, 5000))
  const st = aws(['amplify', 'get-job', '--app-id', app.appId, '--branch-name', BRANCH, '--job-id', dep.jobId]).job.summary.status
  if (st === 'SUCCEED') { log(`live: ${site}`); process.exit(0) }
  if (['FAILED', 'CANCELLED'].includes(st)) throw new Error(`Amplify deployment ${st}`)
}
throw new Error('Amplify deployment did not finish in 7.5 minutes')
