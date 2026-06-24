import { useMemo, useState } from 'react'
import type { MovimentoRegistro, NotaFiscalCancelada } from '../types'
import { labelJustificativaSaida } from '../lib/justificativaSaida'
import { formatAddressLabel } from '../layout/camaras'

type HistFiltro = 'todos' | 'movimentacao' | 'entrada' | 'saida' | 'canceladas'

type HistItem =
  | { kind: 'movimento'; data: MovimentoRegistro }
  | { kind: 'cancelada'; data: NotaFiscalCancelada }

type Props = {
  movimentos: MovimentoRegistro[]
  canceladas: NotaFiscalCancelada[]
}

const FILTROS: { id: HistFiltro; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'movimentacao', label: 'Movimentação' },
  { id: 'entrada', label: 'Entrada' },
  { id: 'saida', label: 'Saída' },
  { id: 'canceladas', label: 'Canceladas' },
]

export function HistoricoPanel({ movimentos, canceladas }: Props) {
  const [filtro, setFiltro] = useState<HistFiltro>('todos')

  const contagens = useMemo(
    () => ({
      movimentacao: movimentos.length,
      entrada: movimentos.filter((m) => m.tipo === 'entrada').length,
      saida: movimentos.filter((m) => m.tipo === 'saida').length,
      canceladas: canceladas.length,
      todos: movimentos.length + canceladas.length,
    }),
    [movimentos, canceladas],
  )

  const itens = useMemo(() => buildLista(filtro, movimentos, canceladas), [filtro, movimentos, canceladas])

  function filtroLabel(id: HistFiltro, label: string) {
    const count = contagens[id]
    return count > 0 ? `${label} (${count})` : label
  }

  if (contagens.todos === 0) {
    return <p className="muted">Nenhum registro de entrada, saída ou cancelamento ainda.</p>
  }

  return (
    <>
      <div className="hist-filters" role="tablist" aria-label="Filtrar histórico">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filtro === f.id}
            className={`hist-filter ${filtro === f.id ? 'hist-filter--active' : ''}`}
            onClick={() => setFiltro(f.id)}
          >
            {filtroLabel(f.id, f.label)}
          </button>
        ))}
      </div>

      {itens.length === 0 ? (
        <p className="muted">Nenhum registro neste filtro.</p>
      ) : (
        <ul className="hist-list">
          {itens.map((item) =>
            item.kind === 'movimento' ? (
              <MovimentoCard key={`mov-${item.data.id}`} mov={item.data} />
            ) : (
              <CanceladaCard key={`can-${item.data.id}`} cancelada={item.data} />
            ),
          )}
        </ul>
      )}
    </>
  )
}

function MovimentoCard({ mov }: { mov: MovimentoRegistro }) {
  const totalEnd = mov.itens.reduce((s, it) => s + it.addressIds.length, 0)
  const motivoSaida = mov.tipo === 'saida' ? labelJustificativaSaida(mov.justificativaSaida) : null

  return (
    <li className={`hist-card hist-card--${mov.tipo}${mov.excluido ? ' hist-card--excluido' : ''}`}>
      <div className="hist-head">
        <span className={`hist-tipo hist-tipo--${mov.tipo}`}>
          {mov.tipo === 'entrada' ? 'Entrada' : 'Saída'}
        </span>
        {mov.excluido && <span className="hist-excluido-badge">Excluído</span>}
      </div>
      <strong>NF {mov.nfNumero}</strong>
      {motivoSaida && <p className="hist-motivo-saida">Motivo: {motivoSaida}</p>}
      <p className="muted hist-emitente">{mov.emitente || '—'}</p>
      <p className="muted">
        {formatDate(mov.createdAt)}
        {mov.excluidoEm ? ` · excluído em ${formatDate(mov.excluidoEm)}` : ''}
        {' · '}
        {mov.itens.length} item(ns) · {totalEnd} end.
      </p>
      <ul className="addr-mini">
        {mov.itens.flatMap((it) =>
          it.addressIds.map((a) => (
            <li key={`${mov.id}-${it.itemIndex}-${a}`}>
              {it.codigo} — {formatAddressLabel(a)}
            </li>
          )),
        )}
      </ul>
    </li>
  )
}

function CanceladaCard({ cancelada }: { cancelada: NotaFiscalCancelada }) {
  return (
    <li className={`hist-card hist-card--cancelada${cancelada.excluido ? ' hist-card--excluido' : ''}`}>
      <div className="hist-head">
        <span className="hist-tipo hist-tipo--cancelada">Cancelada</span>
        {cancelada.excluido && <span className="hist-excluido-badge">Excluído</span>}
      </div>
      <strong>NF {cancelada.numero}</strong>
      <p className="muted hist-emitente">{cancelada.emitente || '—'}</p>
      <p className="muted">
        {formatDate(cancelada.createdAt)}
        {cancelada.excluidoEm ? ` · excluído em ${formatDate(cancelada.excluidoEm)}` : ''}
        {' · '}
        {cancelada.items.length} item(ns)
      </p>
      <ul className="addr-mini">
        {cancelada.items.map((it) => (
          <li key={`${cancelada.id}-${it.index}`}>
            {it.codigo} — {it.descricao}
          </li>
        ))}
      </ul>
      {cancelada.vinculoNfNovaNumero ? (
        <p className="hist-vinculo">
          Vinculada à NF nova <strong>{cancelada.vinculoNfNovaNumero}</strong>
        </p>
      ) : (
        !cancelada.excluido && <p className="hist-hint">Sem vínculo com NF substituta.</p>
      )}
    </li>
  )
}

function buildLista(
  filtro: HistFiltro,
  movimentos: MovimentoRegistro[],
  canceladas: NotaFiscalCancelada[],
): HistItem[] {
  if (filtro === 'movimentacao') {
    return [...movimentos]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((data) => ({ kind: 'movimento', data }))
  }

  if (filtro === 'entrada') {
    return movimentos
      .filter((m) => m.tipo === 'entrada')
      .map((data) => ({ kind: 'movimento', data }))
  }

  if (filtro === 'saida') {
    return movimentos
      .filter((m) => m.tipo === 'saida')
      .map((data) => ({ kind: 'movimento', data }))
  }

  if (filtro === 'canceladas') {
    return [...canceladas]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((data) => ({ kind: 'cancelada', data }))
  }

  const merged: { item: HistItem; sort: string }[] = [
    ...movimentos.map((m) => ({
      item: { kind: 'movimento' as const, data: m },
      sort: m.createdAt,
    })),
    ...canceladas.map((c) => ({
      item: { kind: 'cancelada' as const, data: c },
      sort: c.createdAt,
    })),
  ]

  return merged.sort((a, b) => b.sort.localeCompare(a.sort)).map((e) => e.item)
}

function formatDate(raw: string): string {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString('pt-BR')
}
