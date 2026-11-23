// Runs an AWS CLI command with the deployment credentials from config/.env only
// (any profile, session token or SSO login on this machine is ignored).
// usage: node scripts/aws-env.mjs <aws cli args...>     e.g. node scripts/aws-env.mjs sts get-caller-identity
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** The KEY=value lines of config/.env (comments and blanks skipped). */
export function loadDeployEnv() {
  let text
  try { text = readFileSync(path.join(ROOT, 'config', '.env'), 'utf8') } catch {
    throw new Error('config/.env is missing: copy config/.env.example and fill it in')
  }
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2]
  }
  for (const k of ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION']) if (!env[k]) throw new Error(`config/.env has no ${k}`)
  return env
}

/** process.env with only these credentials (nothing else from this machine's AWS setup). */
export function awsProcessEnv() {
  const d = loadDeployEnv()
  const env = { ...process.env }
  for (const k of Object.keys(env)) if (/^AWS_/.test(k)) delete env[k]
  return {
    ...env,
    AWS_ACCESS_KEY_ID: d.AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY: d.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: d.AWS_REGION, AWS_DEFAULT_REGION: d.AWS_REGION,
    // never fall back to ~/.aws on this machine
    AWS_CONFIG_FILE: path.join(ROOT, 'config', 'aws-config-none'), AWS_SHARED_CREDENTIALS_FILE: path.join(ROOT, 'config', 'aws-credentials-none'),
    AWS_PAGER: '',
  }
}

/** Runs `aws ...args`; returns stdout (throws with stderr on failure). */
export function aws(args, { json = true, input } = {}) {
  // no shell: arguments are passed as they are (no quoting problems, nothing interpreted)
  const r = spawnSync('aws', [...args, ...(json ? ['--output', 'json'] : [])], { env: awsProcessEnv(), encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024 })
  if (r.status !== 0) throw new Error(`aws ${args.slice(0, 2).join(' ')} failed: ${(r.stderr || r.stdout || '').trim()}`)
  return json && r.stdout.trim() ? JSON.parse(r.stdout) : r.stdout
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(aws(process.argv.slice(2), { json: false })) } catch (e) { console.error(e.message); process.exit(1) }
}
