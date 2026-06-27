import type { MouseEvent, PointerEvent } from 'react'
import type { SidebarMode } from '../lib/sidebarMode'

type Props = {
  mode: SidebarMode
  onChange: (mode: SidebarMode) => void
}

const CYCLE: SidebarMode[] = ['collapsed', 'open', 'fullscreen']

const MODE_META: Record<
  SidebarMode,
  { label: string; title: string }
> = {
  collapsed: {
    label: 'Recolhido',
    title: 'Menu recolhido — clique para alternar o layout',
  },
  open: {
    label: 'Aberto',
    title: 'Menu aberto — clique para alternar o layout',
  },
  fullscreen: {
    label: 'Tela cheia',
    title: 'Menu em tela cheia — clique para alternar o layout',
  },
}

export function SidebarLayoutControl({ mode, onChange }: Props) {
  const meta = MODE_META[mode]

  function stopSidebar(e: MouseEvent | PointerEvent) {
    e.stopPropagation()
  }

  function cycleMode() {
    const index = CYCLE.indexOf(mode)
    onChange(CYCLE[(index + 1) % CYCLE.length])
  }

  return (
    <button
      type="button"
      className="sidebar-layout-toggle"
      title={meta.title}
      aria-label={meta.title}
      onPointerDown={stopSidebar}
      onClick={(e) => {
        stopSidebar(e)
        cycleMode()
      }}
    >
      <span className="sidebar-layout-toggle-icon" aria-hidden>
        {mode === 'collapsed' && <CollapsedIcon />}
        {mode === 'open' && <OpenIcon />}
        {mode === 'fullscreen' && <FullscreenIcon />}
      </span>
      <span className="sidebar-layout-toggle-label">{meta.label}</span>
    </button>
  )
}

function CollapsedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
      <rect x="4" y="5" width="4" height="14" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <rect x="10" y="5" width="10" height="14" rx="1" stroke="currentColor" strokeWidth="1.75" opacity="0.35" />
    </svg>
  )
}

function OpenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
      <rect x="4" y="5" width="8" height="14" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <rect x="14" y="5" width="6" height="14" rx="1" stroke="currentColor" strokeWidth="1.75" opacity="0.35" />
    </svg>
  )
}

function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
      <rect x="4" y="5" width="16" height="14" rx="1" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  )
}
