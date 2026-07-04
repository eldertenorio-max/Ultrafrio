import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'

function loadEnvFile() {
  if (!existsSync('.env')) return
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile()

const url = process.env.VITE_SUPABASE_URL?.trim() ?? ''
const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
const out = 'public/supabase-config.json'

if (url && anonKey) {
  writeFileSync(out, `${JSON.stringify({ url, anonKey }, null, 2)}\n`, 'utf8')
  console.log('supabase-config: gerado public/supabase-config.json')
} else {
  if (process.env.RENDER) {
    console.error(
      'ERRO: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias no build do Render.',
    )
    console.error('Environment → adicione as variáveis → Manual Deploy (Clear build cache).')
    process.exit(1)
  }
  if (existsSync(out)) {
    unlinkSync(out)
    console.log('supabase-config: removido (variáveis ausentes)')
  }
}
