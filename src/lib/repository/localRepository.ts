import type { AppState, NotaFiscal } from '../../types'
import type { EnderecamentoRepository } from './types'

const DATA_KEY = 'ultrafrio-enderecamento-v1'
const UI_KEY = 'ultrafrio-ui-prefs-v1'

function loadBundle(): { notas: NotaFiscal[]; activeNfId: string | null; activeItemIndex: number | null } {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (!raw) return { notas: [], activeNfId: null, activeItemIndex: null }
    const parsed = JSON.parse(raw) as AppState
    return {
      notas: parsed.notas ?? [],
      activeNfId: parsed.activeNfId ?? null,
      activeItemIndex: parsed.activeItemIndex ?? null,
    }
  } catch {
    return { notas: [], activeNfId: null, activeItemIndex: null }
  }
}

function loadUiFromLegacy(): Pick<AppState, 'activeNfId' | 'activeItemIndex'> {
  const legacy = loadBundle()
  const raw = localStorage.getItem(UI_KEY)
  if (raw) {
    try {
      return JSON.parse(raw) as Pick<AppState, 'activeNfId' | 'activeItemIndex'>
    } catch {
      /* fallback legacy */
    }
  }
  return { activeNfId: legacy.activeNfId, activeItemIndex: legacy.activeItemIndex }
}

export const localRepository: EnderecamentoRepository = {
  mode: 'local',

  async loadNotas() {
    return loadBundle().notas
  },

  async saveNotas(notas) {
    const ui = loadUiFromLegacy()
    localStorage.setItem(
      DATA_KEY,
      JSON.stringify({ notas, activeNfId: ui.activeNfId, activeItemIndex: ui.activeItemIndex }),
    )
  },

  loadUiPrefs() {
    return loadUiFromLegacy()
  },

  saveUiPrefs(prefs) {
    localStorage.setItem(UI_KEY, JSON.stringify(prefs))
  },
}
