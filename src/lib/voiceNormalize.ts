/** Normaliza transcript de voz para comparação e parsing. */
export function normalizeVoiceText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[·.,;!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function fuzzyWakePhraseMatch(norm: string, wake: string): boolean {
  if (wake === 'ok estoque') {
    if (/\b(o\s*k|ok|okay|oki|oque|o k)\s+est(o|ó)?que\b/.test(norm)) return true
    if (/\best(o|ó)?que\s+(ok|okay|oki|oque)\b/.test(norm)) return true
  }
  return false
}

const OK_ESTOQUE_WAKE_RE =
  /\b(?:o\s*k|ok|okay|oki|oque|o k)\s+est(?:o|ó)?que\b|\best(?:o|ó)?que\s+(?:ok|okay|oki|oque)\b/

export function wakePhraseMatches(transcript: string, wakePhrase: string): boolean {
  const norm = normalizeVoiceText(transcript)
  const wake = normalizeVoiceText(wakePhrase)
  if (!wake) return false
  if (norm.includes(wake)) return true
  return fuzzyWakePhraseMatch(norm, wake)
}

export function stripWakePhrase(transcript: string, wakePhrase: string): string {
  const norm = normalizeVoiceText(transcript)
  const wake = normalizeVoiceText(wakePhrase)
  if (!wake) return norm

  const idx = norm.indexOf(wake)
  if (idx >= 0) return norm.slice(idx + wake.length).trim()

  if (wake === 'ok estoque') {
    const m = norm.match(OK_ESTOQUE_WAKE_RE)
    if (m?.index != null) {
      return norm.slice(m.index + m[0].length).trim()
    }
  }

  return norm
}
