import type { NotaFiscal } from '../types'
import { formatAddressLabel } from '../layout/camaras'

type Props = {
  addressId: string
  nota: NotaFiscal
  onClose: () => void
}

export function DetailModal({ addressId, nota, onClose }: Props) {
  const itensNf = nota.items.filter((it) => it.allocatedAddresses.includes(addressId))
  const todosEnderecos = nota.items.flatMap((it) =>
    it.allocatedAddresses.map((addr) => ({ addr, item: it })),
  )

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="modal-header">
          <div>
            <h2>Endereço {formatAddressLabel(addressId)}</h2>
            <p className="muted">NF {nota.numero} · {nota.emitente}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>

        <section className="modal-section">
          <h3>Produto neste endereço</h3>
          {itensNf.length === 0 ? (
            <p className="muted">Nenhum item vinculado.</p>
          ) : (
            <ul className="detail-items">
              {itensNf.map((it) => (
                <li key={it.index}>
                  <strong>{it.codigo}</strong> — {it.descricao}
                  <span className="muted"> · {it.quantidade} {it.unidade}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="modal-section">
          <h3>Dados da NF {nota.numero}</h3>
          <dl className="meta-list">
            <div><dt>Série</dt><dd>{nota.serie || '—'}</dd></div>
            <div><dt>Status</dt><dd>{nota.status === 'concluida' ? 'Concluída' : 'Em andamento'}</dd></div>
            <div><dt>Chave</dt><dd className="chave">{nota.chave || '—'}</dd></div>
          </dl>
        </section>

        <section className="modal-section">
          <h3>Todos os endereços desta NF ({todosEnderecos.length})</h3>
          <ul className="addr-list-scroll">
            {todosEnderecos.map(({ addr, item }) => (
              <li key={`${addr}-${item.index}`} className={addr === addressId ? 'addr-current' : ''}>
                {formatAddressLabel(addr)} — {item.codigo}
              </li>
            ))}
          </ul>
        </section>

        <section className="modal-section">
          <h3>Todos os itens da NF</h3>
          <ul className="detail-items">
            {nota.items.map((it) => (
              <li key={it.index}>
                <strong>{it.codigo}</strong> — {it.descricao}
                <span className="muted">
                  {' '}· {it.allocatedAddresses.length} end. · {it.quantidade} {it.unidade}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
