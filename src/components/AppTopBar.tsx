import { useEffect, useState } from 'react'
import type { SidebarMode } from '../lib/sidebarMode'
import type { Theme } from '../lib/theme'
import { SidebarLayoutControl } from './SidebarLayoutControl'
import { ThemeToggle } from './ThemeToggle'
import { LayoutLegend, type LayoutLegendProps } from './LayoutLegend'
import { BRAND_PRODUCT_NAME, BRAND_PRODUCT_VARIANT, LOGO_DOCA_LIVRE_SRC } from '../lib/brandAssets'

type Props = {
  sidebarMode: SidebarMode
  onSidebarModeChange: (mode: SidebarMode) => void
  theme: Theme
  onToggleTheme: () => void
  saving: boolean
  persistError: string | null
  mapLegend: LayoutLegendProps
}

function formatClock(now: Date): { time: string; date: string } {
  return {
    time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    date: now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  }
}

function BrandMark() {
  return (
    <img
      src={LOGO_DOCA_LIVRE_SRC}
      alt="Doca Livre"
      className="app-topbar-logo"
    />
  )
}

export function AppTopBar({
  sidebarMode,
  onSidebarModeChange,
  theme,
  onToggleTheme,
  saving,
  persistError,
  mapLegend,
}: Props) {
  const [clock, setClock] = useState(() => formatClock(new Date()))

  useEffect(() => {
    const tick = () => setClock(formatClock(new Date()))
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])

  function handleMenuClick() {
    if (sidebarMode === 'fullscreen') {
      onSidebarModeChange('open')
    }
  }

  return (
    <header className="app-topbar" aria-label="Barra principal">
      <div className="app-topbar-left">
        <button
          type="button"
          className="app-topbar-menu"
          onClick={handleMenuClick}
          disabled={sidebarMode !== 'fullscreen'}
          aria-label={sidebarMode === 'fullscreen' ? 'Voltar ao mapa' : 'Menu lateral'}
          title={sidebarMode === 'fullscreen' ? 'Voltar ao mapa' : 'Use os botões de layout ao lado para o menu'}
        >
          <span className="app-topbar-menu-icon" aria-hidden />
        </button>

        <div className="app-topbar-brand-row">
          <div className="app-topbar-brand">
            <BrandMark />
            <strong className="app-topbar-wms">
              <span className="app-topbar-wms-light">{BRAND_PRODUCT_VARIANT}</span>
              {BRAND_PRODUCT_NAME}
            </strong>
          </div>
        </div>
      </div>

      <div className="app-topbar-right">
        <LayoutLegend {...mapLegend} className="app-topbar-legend" />
        <SidebarLayoutControl
          mode={sidebarMode}
          onChange={onSidebarModeChange}
          orientation="horizontal"
        />
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />

        <div className="app-topbar-meta" aria-label="Data e hora">
          <span className="app-topbar-meta-time">{clock.time}</span>
          <span className="app-topbar-meta-date">{clock.date}</span>
          <span className="app-topbar-meta-version">v1.0</span>
        </div>

        <div className="app-topbar-user">
          <div className="app-topbar-user-text">
            <strong>Doca Livre</strong>
            <span>Estoque / NF-e</span>
            {saving && <em className="app-topbar-saving">Salvando…</em>}
            {persistError && <em className="app-topbar-error">{persistError}</em>}
          </div>
          <span className="app-topbar-avatar" aria-hidden>
            <img src={LOGO_DOCA_LIVRE_SRC} alt="" />
          </span>
        </div>
      </div>
    </header>
  )
}
