type Props = {
  fixed: boolean
  onToggle: () => void
}

export function SidebarModeToggle({ fixed, onToggle }: Props) {
  return (
    <button
      type="button"
      className="sidebar-mode-toggle"
      onClick={onToggle}
      title={fixed ? 'Menu recolhe ao clicar fora (modo livre)' : 'Manter menu sempre aberto (modo fixo)'}
      aria-label={fixed ? 'Ativar menu livre' : 'Fixar menu lateral'}
      aria-pressed={fixed}
    >
      <span className="sidebar-mode-toggle-icon" aria-hidden>
        {fixed ? <UnpinIcon /> : <PinIcon />}
      </span>
    </button>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
      <path
        d="M14 4v5l5 5v2H5v-2l5-5V4a2 2 0 0 1 4 0z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M10 16v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function UnpinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
      <path
        d="M14 4v5l5 5v2h-3M9 16H5v-2l5-5V4a2 2 0 0 1 3.1-1.7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M10 16v4M3 3l18 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}
