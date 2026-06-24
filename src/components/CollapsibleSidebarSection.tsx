import { useState, type ReactNode } from 'react'

export type SidebarSectionId = 'entrada' | 'saida' | 'editar' | 'historico' | 'canceladas' | 'imprimir'

type Props = {
  id: SidebarSectionId
  title: string
  children: ReactNode
  defaultOpen?: boolean
  onBeforeToggle?: (nextOpen: boolean, proceed: () => void) => void
}

export function CollapsibleSidebarSection({
  id,
  title,
  children,
  defaultOpen = false,
  onBeforeToggle,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  function handleToggle() {
    const nextOpen = !open
    if (onBeforeToggle) {
      onBeforeToggle(nextOpen, () => setOpen(nextOpen))
      return
    }
    setOpen(nextOpen)
  }

  return (
    <section
      className={`sidebar-section ${open ? 'sidebar-section--open' : ''} sidebar-section--${id}`}
    >
      <button
        type="button"
        className="sidebar-section-trigger"
        onClick={handleToggle}
        aria-expanded={open}
        title={title}
      >
        <span className={`sidebar-section-icon sidebar-section-icon--${id}`}>
          <SectionIcon id={id} />
        </span>
        <span className="sidebar-section-title">{title}</span>
        <span className={`sidebar-section-chevron ${open ? 'sidebar-section-chevron--open' : ''}`} aria-hidden>
          ›
        </span>
      </button>

      <div className="sidebar-section-body">
        <div className="sidebar-section-inner">{children}</div>
      </div>
    </section>
  )
}

function SectionIcon({ id }: { id: SidebarSectionId }) {
  if (id === 'entrada') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          className="icon-entrada-box"
          d="M5 8h14v11H5z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          className="icon-entrada-arrow"
          d="M12 4v9m0 0-3-3m3 3 3-3"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (id === 'saida') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          className="icon-saida-box"
          d="M5 8h14v11H5z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          className="icon-saida-arrow"
          d="M12 20v-9m0 0-3 3m3-3 3 3"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (id === 'editar') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          className="icon-edit-grid"
          d="M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          className="icon-edit-arrow"
          d="M16 16l4 4M18 14v6h-6"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (id === 'historico') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle className="icon-hist-clock" cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
        <path
          className="icon-hist-hand"
          d="M12 8v4l3 2"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          className="icon-hist-tick"
          d="M4 12H2M22 12h-2M12 4V2M12 22v-2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.45"
        />
      </svg>
    )
  }

  if (id === 'imprimir') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          className="icon-print-body"
          d="M6 9V4h12v5M6 17v3h12v-3"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          className="icon-print-tray"
          d="M4 14h16v-4H4z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          className="icon-print-paper"
          d="M8 11h8"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        className="icon-cancel-doc"
        d="M7 4h10v3H7zM6 7h12v13H6z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        className="icon-cancel-x"
        d="M9 12l6 6M15 12l-6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}
