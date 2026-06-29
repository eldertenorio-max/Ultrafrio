import { useEffect, useRef, useState } from 'react'
import type { SidebarSectionId } from './CollapsibleSidebarSection'
import type { SidebarMode } from '../lib/sidebarMode'
import type { Theme } from '../lib/theme'
import { SidebarLayoutControl } from './SidebarLayoutControl'
import { ThemeToggle } from './ThemeToggle'
import { LayoutLegend, type LayoutLegendProps } from './LayoutLegend'
import { AccountMenuPopover } from './AccountMenuPopover'
import { BRAND_PRODUCT_NAME, BRAND_PRODUCT_VARIANT, LOGO_DOCA_LIVRE_SRC } from '../lib/brandAssets'
import type { ContaUsuario } from '../lib/contaSessao'
import { corAvatarUsuario, iniciaisUsuario } from '../lib/contaSessao'

type Props = {
  sidebarMode: SidebarMode
  onSidebarModeChange: (mode: SidebarMode) => void
  theme: Theme
  onToggleTheme: () => void
  saving: boolean
  persistError: string | null
  mapLegend: LayoutLegendProps
  contaUsuarios: ContaUsuario[]
  contaUsuarioAtivoId: string
  onSelectContaUsuario: (id: string) => void
  onOpenContaSection: (section: SidebarSectionId, focus?: 'conta' | 'comandos') => void
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
  contaUsuarios,
  contaUsuarioAtivoId,
  onSelectContaUsuario,
  onOpenContaSection,
}: Props) {
  const [clock, setClock] = useState(() => formatClock(new Date()))
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountTriggerRef = useRef<HTMLButtonElement>(null)

  const usuarioAtivo =
    contaUsuarios.find((u) => u.id === contaUsuarioAtivoId) ?? contaUsuarios[0]

  useEffect(() => {
    const tick = () => setClock(formatClock(new Date()))
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])

  function handleMenuClick() {
    if (sidebarMode === 'fullscreen' || sidebarMode === 'collapsed') {
      onSidebarModeChange('open')
      return
    }
    onSidebarModeChange('collapsed')
  }

  const menuLabel =
    sidebarMode === 'fullscreen'
      ? 'Voltar ao mapa'
      : sidebarMode === 'collapsed'
        ? 'Abrir menu lateral'
        : 'Recolher menu lateral'

  function toggleAccountMenu() {
    setAccountMenuOpen((v) => !v)
  }

  function closeAccountMenu() {
    setAccountMenuOpen(false)
  }

  function handleConfigConta() {
    closeAccountMenu()
    onOpenContaSection('cadastroVoz', 'conta')
  }

  function handleComandoVoz() {
    closeAccountMenu()
    onOpenContaSection('cadastroVoz', 'comandos')
  }

  function handleSelectUsuario(id: string) {
    onSelectContaUsuario(id)
    closeAccountMenu()
  }

  return (
    <header className="app-topbar" aria-label="Barra principal">
      <div className="app-topbar-left">
        <button
          type="button"
          className="app-topbar-menu"
          onClick={handleMenuClick}
          aria-label={menuLabel}
          aria-pressed={sidebarMode === 'open'}
          title={menuLabel}
        >
          <span className="app-topbar-menu-icon" aria-hidden />
        </button>

        <div className="app-topbar-brand-row">
          <div className="app-topbar-brand">
            <BrandMark />
            <strong className="app-topbar-wms" aria-label={`${BRAND_PRODUCT_NAME} ${BRAND_PRODUCT_VARIANT}`}>
              <span className="app-topbar-wms-main">{BRAND_PRODUCT_NAME}</span>
              <span className="app-topbar-wms-light">{BRAND_PRODUCT_VARIANT}</span>
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

        <div className="app-topbar-user-wrap">
          <button
            ref={accountTriggerRef}
            type="button"
            className={`app-topbar-user ${accountMenuOpen ? 'app-topbar-user--open' : ''}`}
            onClick={toggleAccountMenu}
            aria-expanded={accountMenuOpen}
            aria-haspopup="menu"
            aria-label="Menu da conta"
          >
            <div className="app-topbar-user-text">
              <strong>{usuarioAtivo?.nome ?? 'Doca Livre'}</strong>
              <span>Estoque / NF-e</span>
              {saving && <em className="app-topbar-saving">Salvando…</em>}
              {persistError && <em className="app-topbar-error">{persistError}</em>}
            </div>
            <span className="app-topbar-avatar" aria-hidden>
              {usuarioAtivo?.avatarUrl ? (
                <img src={usuarioAtivo.avatarUrl} alt="" />
              ) : (
                <span
                  className="app-topbar-avatar-iniciais"
                  style={{ background: corAvatarUsuario(usuarioAtivo?.id ?? 'dl') }}
                >
                  {iniciaisUsuario(usuarioAtivo?.nome ?? 'DL')}
                </span>
              )}
            </span>
          </button>

          <AccountMenuPopover
            open={accountMenuOpen}
            onClose={closeAccountMenu}
            anchorRef={accountTriggerRef}
            usuarios={contaUsuarios}
            usuarioAtivoId={contaUsuarioAtivoId}
            onSelectUsuario={handleSelectUsuario}
            onConfigConta={handleConfigConta}
            onComandoVoz={handleComandoVoz}
            theme={theme}
            onToggleTheme={onToggleTheme}
          />
        </div>
      </div>
    </header>
  )
}
