import { useMemo, useState } from 'react'
import type { MovimentoRegistro, NotaFiscalCancelada } from '../types'
import { formatAddressLabel } from '../layout/camaras'

type HistFiltro = 'todos' | 'entrada' | 'saida' | 'canceladas'

type HistItem =
  | { kind: 'movimento'; data: MovimentoRegistro }
  | { kind: 'cancelada'; data: NotaFiscalCancelada }

type ConfirmTarget =
  | { kind: 'movimento'; data: MovimentoRegistro }
  | { kind: 'cancelada'; data: NotaFiscalCancelada }

type Props = {
  movimentos: MovimentoRegistro[]
  canceladas: NotaFiscalCancelada[]
  onExcluir: (id: string) => void
  onExcluirCancelada: (id: string) => void
}

const FILTROS: { id: HistFiltro; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'entrada', label: 'Entrada' },
  { id: 'saida', label: 'Saída' },
  { id: 'canceladas', label: 'Canceladas' },
]

export function HistoricoPanel({ movimentos, canceladas, onExcluir, onExcluirCancelada }: Props) {
  const [filtro, setFiltro] = useState<HistFiltro>('todos')
  const [confirmar, setConfirmar] = useState<ConfirmTarget | null>(null)

  const contagens = useMemo(
    () => ({
      entrada: movimentos.filter((m) => m.tipo === 'entrada').length,
      saida: movimentos.filter((m) => m.tipo === 'saida').length,
      canceladas: canceladas.length,
      todos: movimentos.length + canceladas.length,
    }),
    [movimentos, canceladas],
  )

  const itens = useMemo(() => buildLista(filtro, movimentos, canceladas), [filtro, movimentos, canceladas])

  function handleConfirmar() {
    if (!confirmar) return
    if (confirmar.kind === 'movimento') onExcluir(confirmar.data.id)
    else onExcluirCancelada(confirmar.data.id)
    setConfirmar(null)
  }

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
              <MovimentoCard
                key={`mov-${item.data.id}`}
                mov={item.data}
                onExcluir={() => setConfirmar({ kind: 'movimento', data: item.data })}
              />
            ) : (
              <CanceladaCard
                key={`can-${item.data.id}`}
                cancelada={item.data}
                onExcluir={() => setConfirmar({ kind: 'cancelada', data: item.data })}
              />
            ),
          )}
        </ul>
      )}

      {confirmar && (
        <div className="confirm-backdrop" onClick={() => setConfirmar(null)}>
          <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
            {confirmar.kind === 'movimento' ? (
              <>
                <h4>Excluir {confirmar.data.tipo === 'entrada' ? 'entrada' : 'saída'}?</h4>
                <p>
                  NF <strong>{confirmar.data.nfNumero}</strong>
                </p>
                {confirmar.data.tipo === 'entrada' ? (
                  <p className="confirm-warn">
                    As posições ocupadas serão liberadas e a NF será removida do sistema.
                  </p>
                ) : (
                  <p className="muted">
                    O registro será removido do histórico. As posições no estoque não serão alteradas.
                  </p>
                )}
              </>
            ) : (
              <>
                <h4>Excluir NF cancelada?</h4>
                <p>
                  NF <strong>{confirmar.data.numero}</strong>
                </p>
                <p className="muted">
                  O registro será removido. Vínculos com notas novas também serão desfeitos.
                </p>
              </>
            )}
            <div className="confirm-actions">
              <button type="button" className="btn" onClick={() => setConfirmar(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={handleConfirmar}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function MovimentoCard({
  mov,
  onExcluir,
}: {
  mov: MovimentoRegistro
  onExcluir: () => void
}) {
  const totalEnd = mov.itens.reduce((s, it) => s + it.addressIds.length, 0)

  return (
    <li className={`hist-card hist-card--${mov.tipo}`}>
      <div className="hist-head">
        <span className={`hist-tipo hist-tipo--${mov.tipo}`}>
          {mov.tipo === 'entrada' ? 'Entrada' : 'Saída'}
        </span>
        <button
          type="button"
          className="hist-delete"
          title={mov.tipo === 'entrada' ? 'Excluir entrada' : 'Excluir saída'}
          onClick={onExcluir}
        >
          <TrashIcon />
        </button>
      </div>
      <strong>NF {mov.nfNumero}</strong>
      <p className="muted hist-emitente">{mov.emitente || '—'}</p>
      <p className="muted">
        {formatDate(mov.createdAt)} · {mov.itens.length} item(ns) · {totalEnd} end.
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
      {mov.tipo === 'entrada' && (
        <p className="hist-hint">Excluir libera todas as posições desta entrada.</p>
      )}
      {mov.tipo === 'saida' && (
        <p className="hist-hint">Excluir remove apenas o registro do histórico.</p>
      )}
    </li>
  )
}

function CanceladaCard({
  cancelada,
  onExcluir,
}: {
  cancelada: NotaFiscalCancelada
  onExcluir: () => void
}) {
  return (
    <li className="hist-card hist-card--cancelada">
      <div className="hist-head">
        <span className="hist-tipo hist-tipo--cancelada">Cancelada</span>
        <button
          type="button"
          className="hist-delete"
          title="Excluir NF cancelada"
          onClick={onExcluir}
        >
          <TrashIcon />
        </button>
      </div>
      <strong>NF {cancelada.numero}</strong>
      <p className="muted hist-emitente">{cancelada.emitente || '—'}</p>
      <p className="muted">
        {formatDate(cancelada.createdAt)} · {cancelada.items.length} item(ns)
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
        <p className="hist-hint">Sem vínculo com NF substituta.</p>
      )}
      <p className="hist-hint">Excluir remove o registro e desfaz vínculos.</p>
    </li>
  )
}

function buildLista(
  filtro: HistFiltro,
  movimentos: MovimentoRegistro[],
  canceladas: NotaFiscalCancelada[],
): HistItem[] {
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

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5h6v2M10 11v6M14 11v6M6 7l1 13h10l1-13"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function formatDate(raw: string): string {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString('pt-BR')
}
