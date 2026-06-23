export type SidebarMode = 'fixed' | 'free'

export const SIDEBAR_MODE_KEY = 'ultrafrio-sidebar-mode'

export function getStoredSidebarMode(): SidebarMode {
  try {
    return localStorage.getItem(SIDEBAR_MODE_KEY) === 'fixed' ? 'fixed' : 'free'
  } catch {
    return 'free'
  }
}

export function storeSidebarMode(mode: SidebarMode) {
  try {
    localStorage.setItem(SIDEBAR_MODE_KEY, mode)
  } catch {
    /* ignore */
  }
}
