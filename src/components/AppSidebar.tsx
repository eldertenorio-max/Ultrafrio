import { CollapsibleSidebarSection, type SidebarSectionId } from './CollapsibleSidebarSection'
import { CadastroVozPanel } from './CadastroVozPanel'
import { ConsultaEstoquePanel } from './ConsultaEstoquePanel'
import { CanceladasPanel } from './CanceladasPanel'
import { EditarPosicaoPanel } from './EditarPosicaoPanel'
import { EntradaPanel } from './EntradaPanel'
import { FinanceiroPanel } from './FinanceiroPanel'
import { HistoricoPanel } from './HistoricoPanel'
import { ImprimirPanel } from './ImprimirPanel'
import { PainelPanel } from './PainelPanel'
import { RelatorioPanel } from './RelatorioPanel'
import { SaidaPanel } from './SaidaPanel'
import { useSidebarExpand } from '../hooks/useSidebarExpand'
import type { SidebarMode } from '../lib/sidebarMode'
import { type ComponentProps, type CSSProperties, type PointerEvent, useMemo, useState } from 'react'

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
  financeiro: ComponentProps<typeof FinanceiroPanel>
  onBeforeLeaveEntrada?: (proceed: () => void) => void
}

const SIDEBAR_MOBILE_WIDTH_KEY = 'ultrafrio-sidebar-mobile-width'
const SIDEBAR_MOBILE_MIN_WIDTH = 72
const SIDEBAR_MOBILE_EDGE_GAP = 24

function readStoredMobileWidth(): number | null {
  try {
    const raw = localStorage.getItem(SIDEBAR_MOBILE_WIDTH_KEY)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

function storeMobileWidth(width: number) {
  try {
    localStorage.setItem(SIDEBAR_MOBILE_WIDTH_KEY, String(Math.round(width)))
  } catch {
    /* ignore */
  }
}

function clampMobileSidebarWidth(width: number): number {
  const viewportWidth = typeof window === 'undefined' ? 420 : window.innerWidth
  const max = Math.max(SIDEBAR_MOBILE_MIN_WIDTH, viewportWidth - SIDEBAR_MOBILE_EDGE_GAP)
  return Math.min(Math.max(width, SIDEBAR_MOBILE_MIN_WIDTH), max)
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
  financeiro,
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
  const [mobileWidth, setMobileWidth] = useState<number | null>(() => readStoredMobileWidth())
  const sidebarStyle = useMemo(
    () =>
      mobileWidth == null
        ? undefined
        : ({ '--sidebar-w-mobile': `${mobileWidth}px` } as CSSProperties),
    [mobileWidth],
  )

  function handleResizePointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (sidebarMode === 'fullscreen') return

    e.preventDefault()
    e.stopPropagation()
    if (sidebarMode === 'collapsed') onSidebarModeChange('open')

    const body = document.body
    const prevUserSelect = body.style.userSelect
    const prevCursor = body.style.cursor
    body.style.userSelect = 'none'
    body.style.cursor = 'ew-resize'

    const applyWidth = (clientX: number) => {
      const next = clampMobileSidebarWidth(clientX)
      setMobileWidth(next)
      storeMobileWidth(next)
    }

    applyWidth(e.clientX)

    const handleMove = (ev: globalThis.PointerEvent) => {
      applyWidth(ev.clientX)
    }

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
      body.style.userSelect = prevUserSelect
      body.style.cursor = prevCursor
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
  }

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
      style={sidebarStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {sidebarMode !== 'fullscreen' && (
        <button
          type="button"
          className="sidebar-resize-handle"
          aria-label="Arrastar para ajustar largura do menu"
          title="Arraste para ajustar a largura do menu"
          onPointerDown={handleResizePointerDown}
        />
      )}
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
        id="financeiro"
        title="Financeiro"
        open={openSection === 'financeiro'}
        onOpenChange={(open) => sectionOpenChange('financeiro', open)}
        onBeforeToggle={guardOtherSection}
      >
        <FinanceiroPanel {...financeiro} />
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
