import { CollapsibleSidebarSection, type SidebarSectionId } from './CollapsibleSidebarSection'
import { CadastroVozPanel } from './CadastroVozPanel'
import { ConsultaEstoquePanel } from './ConsultaEstoquePanel'
import { CanceladasPanel } from './CanceladasPanel'
import { EditarPosicaoPanel } from './EditarPosicaoPanel'
import { EntradaPanel } from './EntradaPanel'
import { HistoricoPanel } from './HistoricoPanel'
import { ImprimirPanel } from './ImprimirPanel'
import { PainelPanel } from './PainelPanel'
import { RelatorioPanel } from './RelatorioPanel'
import { SaidaPanel } from './SaidaPanel'
import { useSidebarExpand } from '../hooks/useSidebarExpand'
import type { SidebarMode } from '../lib/sidebarMode'
import { type ComponentProps } from 'react'

type Props = {
  sidebarMode: SidebarMode
  onSidebarModeChange: (mode: SidebarMode) => void
  openSection: SidebarSectionId | null
  onOpenSectionChange: (id: SidebarSectionId | null) => void
  entrada: ComponentProps<typeof EntradaPanel>
  saida: ComponentProps<typeof SaidaPanel>
  editar: ComponentProps<typeof EditarPosicaoPanel>
  consulta: ComponentProps<typeof ConsultaEstoquePanel>
  historico: ComponentProps<typeof HistoricoPanel>
  relatorio: ComponentProps<typeof RelatorioPanel>
  painel: ComponentProps<typeof PainelPanel>
  canceladas: ComponentProps<typeof CanceladasPanel>
  imprimir: ComponentProps<typeof ImprimirPanel>
  cadastroVoz: ComponentProps<typeof CadastroVozPanel>
  onBeforeLeaveEntrada?: (proceed: () => void) => void
}

export function AppSidebar({
  sidebarMode,
  onSidebarModeChange,
  openSection,
  onOpenSectionChange,
  entrada,
  saida,
  editar,
  consulta,
  historico,
  relatorio,
  painel,
  canceladas,
  imprimir,
  cadastroVoz,
  onBeforeLeaveEntrada,
}: Props) {
  function sectionOpenChange(id: SidebarSectionId, open: boolean) {
    if (open && id === 'painel') {
      onSidebarModeChange('fullscreen')
    }
    onOpenSectionChange(open ? id : null)
  }

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

  const { expanded, sidebarRef, onMouseEnter, onMouseLeave } =
    useSidebarExpand(sidebarMode)

  const wide = expanded
  const pinnedOpen = sidebarMode === 'open' || sidebarMode === 'fullscreen'

  return (
    <aside
      ref={sidebarRef}
      className={[
        'sidebar',
        `sidebar--mode-${sidebarMode}`,
        wide ? 'sidebar--wide' : '',
        expanded && sidebarMode === 'collapsed' ? 'sidebar--expanded' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      title={!pinnedOpen && !expanded ? 'Passe o mouse para abrir o menu' : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="sidebar-layout">
      <div className="sidebar-body">
      <CollapsibleSidebarSection
        id="consulta"
        title="Consulta estoque"
        open={openSection === 'consulta'}
        onOpenChange={(open) => sectionOpenChange('consulta', open)}
        onBeforeToggle={guardOtherSection}
      >
        <ConsultaEstoquePanel {...consulta} />
      </CollapsibleSidebarSection>

      <CollapsibleSidebarSection
        id="entrada"
        title="Entrada"
        open={openSection === 'entrada'}
        onOpenChange={(open) => sectionOpenChange('entrada', open)}
        onBeforeToggle={guardEntradaSection}
      >
        <EntradaPanel {...entrada} />
      </CollapsibleSidebarSection>

      <CollapsibleSidebarSection
        id="saida"
        title="Saída"
        open={openSection === 'saida'}
        onOpenChange={(open) => sectionOpenChange('saida', open)}
        onBeforeToggle={guardOtherSection}
      >
        <SaidaPanel {...saida} />
      </CollapsibleSidebarSection>

      <CollapsibleSidebarSection
        id="editar"
        title="Movimentação"
        open={openSection === 'editar'}
        onOpenChange={(open) => sectionOpenChange('editar', open)}
        onBeforeToggle={guardOtherSection}
      >
        <EditarPosicaoPanel {...editar} />
      </CollapsibleSidebarSection>

      <CollapsibleSidebarSection
        id="canceladas"
        title="NF cancelada"
        open={openSection === 'canceladas'}
        onOpenChange={(open) => sectionOpenChange('canceladas', open)}
        onBeforeToggle={guardOtherSection}
      >
        <CanceladasPanel {...canceladas} />
      </CollapsibleSidebarSection>

      <CollapsibleSidebarSection
        id="historico"
        title="Histórico"
        open={openSection === 'historico'}
        onOpenChange={(open) => sectionOpenChange('historico', open)}
        onBeforeToggle={guardOtherSection}
      >
        <HistoricoPanel {...historico} />
      </CollapsibleSidebarSection>

      <CollapsibleSidebarSection
        id="relatorio"
        title="Relatório"
        open={openSection === 'relatorio'}
        onOpenChange={(open) => sectionOpenChange('relatorio', open)}
        onBeforeToggle={guardOtherSection}
      >
        <RelatorioPanel {...relatorio} />
      </CollapsibleSidebarSection>

      <CollapsibleSidebarSection
        id="painel"
        title="Painel"
        open={openSection === 'painel'}
        onOpenChange={(open) => sectionOpenChange('painel', open)}
        onBeforeToggle={guardOtherSection}
      >
        <PainelPanel {...painel} />
      </CollapsibleSidebarSection>

      <CollapsibleSidebarSection
        id="cadastroVoz"
        title="Comando de voz"
        open={openSection === 'cadastroVoz'}
        onOpenChange={(open) => sectionOpenChange('cadastroVoz', open)}
        onBeforeToggle={guardOtherSection}
      >
        <CadastroVozPanel {...cadastroVoz} />
      </CollapsibleSidebarSection>

      <CollapsibleSidebarSection
        id="imprimir"
        title="Mapa"
        open={openSection === 'imprimir'}
        onOpenChange={(open) => sectionOpenChange('imprimir', open)}
        onBeforeToggle={guardOtherSection}
      >
        <ImprimirPanel {...imprimir} />
      </CollapsibleSidebarSection>
      </div>
      </div>
    </aside>
  )
}
