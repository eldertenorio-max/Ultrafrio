export const EMITENTES_KEY = 'ultrafrio-emitentes-v1'

const MAX_EMITENTES = 200

function normalizarEmitente(nome: string): string | null {
  const t = nome.trim()
  if (!t) return null
  if (t.toLowerCase() === 'cadastro manual') return null
  return t
}

export function getEmitentesSugeridos(): string[] {
  try {
    const raw = localStorage.getItem(EMITENTES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string' && normalizarEmitente(x) !== null)
  } catch {
    return []
  }
}

export function registrarEmitente(nome: string): void {
  const n = normalizarEmitente(nome)
  if (!n) return

  const lower = n.toLowerCase()
  const next = [n, ...getEmitentesSugeridos().filter((e) => e.toLowerCase() !== lower)].slice(
    0,
    MAX_EMITENTES,
  )

  try {
    localStorage.setItem(EMITENTES_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

export function mesclarEmitentesSugeridos(...listas: string[][]): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const lista of listas) {
    for (const item of lista) {
      const n = normalizarEmitente(item)
      if (!n) continue
      const key = n.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(n)
    }
  }

  return out
}
