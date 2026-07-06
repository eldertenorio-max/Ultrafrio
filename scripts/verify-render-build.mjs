/**
 * Mesmo fluxo do Render (render.yaml) — rodar localmente antes de push.
 * Uso: npm run build:render
 */
import { spawnSync } from 'node:child_process'

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

run('npm', ['ci', '--no-audit', '--no-fund'])
run('node', ['scripts/write-supabase-config.mjs'])
run('npm', ['run', 'build'])

console.log('\nverify-render-build: OK')
