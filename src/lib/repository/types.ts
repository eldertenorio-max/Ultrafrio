import type { AppState, NotaFiscal } from '../../types'

export type StorageMode = 'local' | 'supabase'

export type EnderecamentoRepository = {
  mode: StorageMode
  loadNotas: () => Promise<NotaFiscal[]>
  saveNotas: (notas: NotaFiscal[]) => Promise<void>
  loadUiPrefs: () => Pick<AppState, 'activeNfId' | 'activeItemIndex'>
  saveUiPrefs: (prefs: Pick<AppState, 'activeNfId' | 'activeItemIndex'>) => void
}
