import type { SidebarSectionId } from '../components/CollapsibleSidebarSection'

const UI_SESSION_KEY = 'ultrafrio-ui-session-v1'

export type UiSessionPrefs = {
  activeNfId: string | null
  activeItemIndex: number | null
  openSection: SidebarSectionId | null
}

const EMPTY_UI: UiSessionPrefs = {
  activeNfId: null,
  activeItemIndex: null,
  openSection: null,
}

export function loadUiSession(): UiSessionPrefs {
  if (typeof sessionStorage === 'undefined') return { ...EMPTY_UI }
  try {
    const raw = sessionStorage.getItem(UI_SESSION_KEY)
    if (!raw) return { ...EMPTY_UI }
    const parsed = JSON.parse(raw) as Partial<UiSessionPrefs>
    return {
      activeNfId: parsed.activeNfId ?? null,
      activeItemIndex: parsed.activeItemIndex ?? null,
      openSection: parsed.openSection ?? null,
    }
  } catch {
    return { ...EMPTY_UI }
  }
}

export function saveUiSession(prefs: Partial<UiSessionPrefs>): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    const next = { ...loadUiSession(), ...prefs }
    sessionStorage.setItem(UI_SESSION_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota / private mode */
  }
}
