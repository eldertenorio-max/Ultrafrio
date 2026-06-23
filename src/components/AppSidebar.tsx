import { CollapsibleSidebarSection } from './CollapsibleSidebarSection'
import { CanceladasPanel } from './CanceladasPanel'
import { EditarPosicaoPanel } from './EditarPosicaoPanel'
import { EntradaPanel } from './EntradaPanel'
import { HistoricoPanel } from './HistoricoPanel'
import { ImprimirPanel } from './ImprimirPanel'
import { SaidaPanel } from './SaidaPanel'
import { ThemeToggle } from './ThemeToggle'
import { SidebarModeToggle } from './SidebarModeToggle'
import type { Theme } from '../lib/theme'
import type { ComponentProps } from 'react'

type Props = {
  saving: boolean
  syncing?: boolean
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
}

export function AppSidebar({
  saving,
  syncing,
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
}: Props) {
  return (
    <aside className={`sidebar${sidebarFixed ? ' sidebar--fixed' : ''}`}>
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
        {syncing && !saving && <p className="saving-hint">Sincronizando…</p>}
        {persistError && <p className="error">{persistError}</p>}
      </div>

      <CollapsibleSidebarSection id="entrada" title="Entrada">
        <EntradaPanel {...entrada} />
      </CollapsibleSidebarSection>

      <CollapsibleSidebarSection id="saida" title="Saída">
        <SaidaPanel {...saida} />
      </CollapsibleSidebarSection>

      <CollapsibleSidebarSection id="editar" title="Editar posição">
        <EditarPosicaoPanel {...editar} />
      </CollapsibleSidebarSection>

      <CollapsibleSidebarSection id="canceladas" title="NF cancelada">
        <CanceladasPanel {...canceladas} />
      </CollapsibleSidebarSection>

      <CollapsibleSidebarSection id="historico" title="Histórico">
        <HistoricoPanel {...historico} />
      </CollapsibleSidebarSection>

      <CollapsibleSidebarSection id="imprimir" title="Imprimir">
        <ImprimirPanel {...imprimir} />
      </CollapsibleSidebarSection>

      <div className="sidebar-footer">
        <SidebarModeToggle fixed={sidebarFixed} onToggle={onToggleSidebarMode} />
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </aside>
  )
}
