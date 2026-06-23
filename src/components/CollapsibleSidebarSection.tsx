import { useState, type ReactNode } from 'react'

export type SidebarSectionId = 'entrada' | 'saida' | 'historico'

type Props = {
  id: SidebarSectionId
  title: string
  children: ReactNode
  defaultOpen?: boolean
}

export function CollapsibleSidebarSection({ id, title, children, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [locked, setLocked] = useState(defaultOpen)

  function handleEnter() {
    setOpen(true)
  }

  function handleLeave() {
    if (!locked) setOpen(false)
  }

  function handleClick() {
    setLocked((prev) => {
      const next = !prev
      setOpen(next)
      return next
    })
  }

  return (
    <section
      className={`sidebar-section ${open ? 'sidebar-section--open' : ''} sidebar-section--${id}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        className="sidebar-section-trigger"
        onClick={handleClick}
        aria-expanded={open}
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
