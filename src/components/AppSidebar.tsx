import { CollapsibleSidebarSection } from './CollapsibleSidebarSection'
import { CanceladasPanel } from './CanceladasPanel'
import { EditarPosicaoPanel } from './EditarPosicaoPanel'
import { EntradaPanel } from './EntradaPanel'
import { HistoricoPanel } from './HistoricoPanel'
import { ImprimirPanel } from './ImprimirPanel'
import { SaidaPanel } from './SaidaPanel'
import { ThemeToggle } from './ThemeToggle'
import { SidebarModeToggle } from './SidebarModeToggle'
import { useSidebarExpand } from '../hooks/useSidebarExpand'
import type { Theme } from '../lib/theme'
import type { ComponentProps } from 'react'

type Props = {
  saving: boolean
  persistError: string | null
  theme: Theme
  onToggleTheme: () => void
  sidebarFixed: boolean
  onToggleSidebarMode: () => void
  entrada: ComponentProps<typeof EntradaPanel>
  saida: ComponentProps<typeof SaidaPanel>
  editar: ComponentProps<typeof EditarPosicaoPanel>
  historico: ComponentProps<typeof HistoricoPanel>
  canceladas: ComponentProps<typeof CanceladasPanel>
  imprimir: ComponentProps<typeof ImprimirPanel>
  onBeforeLeaveEntrada?: (proceed: () => void) => void
}

export function AppSidebar({
  saving,
  persistError,
  theme,
  onToggleTheme,
  sidebarFixed,
  onToggleSidebarMode,
  entrada,
  saida,
  editar,
  historico,
  canceladas,
  imprimir,
  onBeforeLeaveEntrada,
}: Props) {
  const guardOtherSection = (nextOpen: boolean, proceed: () => void) => {
    if (!nextOpen || !onBeforeLeaveEntrada) {
      proceed()
      return
    }
    onBeforeLeaveEntrada(proceed)
  }

  const guardEntradaSection = (nextOpen: boolean, proceed: () => void) => {
    if (nextOpen || !onBeforeLeaveEntrada) {
      proceed()
      return
    }
    onBeforeLeaveEntrada(proceed)
  }

  const { expanded, sidebarRef, onSidebarPointerDown, onMouseEnter, onMouseLeave } =
    useSidebarExpand(sidebarFixed)

  return (
    <aside
      ref={sidebarRef}
      className={`sidebar${sidebarFixed ? ' sidebar--fixed' : ''}${expanded ? ' sidebar--expanded' : ''}`}
      title={!sidebarFixed && !expanded ? 'Clique para abrir o menu' : undefined}
      onPointerDown={onSidebarPointerDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="sidebar-block sidebar-header">
        <img
          src="/logo-ultrafrio-vertical-azul.svg"
          alt=""
          aria-hidden
          className="sidebar-logo sidebar-logo--compact"
        />
        <img
          src="/logo-ultrafrio-horizontal-azul.svg"
          alt="Ultrafrio"
          className="sidebar-logo sidebar-logo--full"
        />
        <h1>Endereçamento</h1>
        <p className="muted">Ultrafrio · entrada e saída por NF-e</p>
        {saving && <p className="saving-hint">Salvando…</p>}
        {persistError && <p className="error">{persistError}</p>}
      </div>

      <CollapsibleSidebarSection id="entrada" title="Entrada" onBeforeToggle={guardEntradaSection}>
        <EntradaPanel {...entrada} />
      </CollapsibleSidebarSection>

      <CollapsibleSidebarSection id="saida" title="Saída" onBeforeToggle={guardOtherSection}>
        <SaidaPanel {...saida} />
      </CollapsibleSidebarSection>

      <CollapsibleSidebarSection id="editar" title="Movimentação" onBeforeToggle={guardOtherSection}>
        <EditarPosicaoPanel {...editar} />
      </CollapsibleSidebarSection>

      <CollapsibleSidebarSection id="canceladas" title="NF cancelada" onBeforeToggle={guardOtherSection}>
        <CanceladasPanel {...canceladas} />
      </CollapsibleSidebarSection>

      <CollapsibleSidebarSection id="historico" title="Histórico" onBeforeToggle={guardOtherSection}>
        <HistoricoPanel {...historico} />
      </CollapsibleSidebarSection>

      <CollapsibleSidebarSection id="imprimir" title="Imprimir" onBeforeToggle={guardOtherSection}>
        <ImprimirPanel {...imprimir} />
      </CollapsibleSidebarSection>

      <div className="sidebar-footer">
        <SidebarModeToggle fixed={sidebarFixed} onToggle={onToggleSidebarMode} />
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </aside>
  )
}
