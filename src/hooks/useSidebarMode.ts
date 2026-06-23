import { useCallback, useEffect, useState } from 'react'
import { getStoredSidebarMode, storeSidebarMode, type SidebarMode } from '../lib/sidebarMode'

export function useSidebarMode() {
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => getStoredSidebarMode())

  useEffect(() => {
    storeSidebarMode(sidebarMode)
  }, [sidebarMode])

  const toggleSidebarMode = useCallback(() => {
    setSidebarMode((prev) => (prev === 'fixed' ? 'free' : 'fixed'))
  }, [])

  return {
    sidebarMode,
    sidebarFixed: sidebarMode === 'fixed',
    toggleSidebarMode,
  }
}
