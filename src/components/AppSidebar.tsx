import { EntradaPanel } from './EntradaPanel'
import { HistoricoPanel } from './HistoricoPanel'
import { SaidaPanel } from './SaidaPanel'
import type { ComponentProps } from 'react'

type Props = {
  saving: boolean
  persistError: string | null
  entrada: ComponentProps<typeof EntradaPanel>
  saida: ComponentProps<typeof SaidaPanel>
  historico: ComponentProps<typeof HistoricoPanel>
}

export function AppSidebar({ saving, persistError, entrada, saida, historico }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-block sidebar-header">
        <img
          src="/logo-ultrafrio-horizontal-azul.svg"
          alt="Ultrafrio"
          className="sidebar-logo"
        />
        <h1>Endereçamento</h1>
        <p className="muted">Ultrafrio · entrada e saída por NF-e</p>
        {saving && <p className="saving-hint">Salvando…</p>}
        {persistError && <p className="error">{persistError}</p>}
      </div>

      <section className="sidebar-section">
        <h2 className="sidebar-section-title">Entrada</h2>
        <EntradaPanel {...entrada} />
      </section>

      <section className="sidebar-section">
        <h2 className="sidebar-section-title">Saída</h2>
        <SaidaPanel {...saida} />
      </section>

      <section className="sidebar-section">
        <h2 className="sidebar-section-title">Histórico</h2>
        <HistoricoPanel {...historico} />
      </section>
    </aside>
  )
}
