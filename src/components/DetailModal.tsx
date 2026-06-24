import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { formatAddressLabel } from '../layout/camaras'
import { buildNfResumo, formatPesoKg } from '../lib/nfResumo'
import { formatValorNfe } from '../lib/formatNfeItem'
import type { NotaFiscal } from '../types'

type Props = {
  addressId: string
  nota: NotaFiscal
  onClose: () => void
}

function formatItemData(iso: string | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function DetailModal({ addressId, nota, onClose }: Props) {
  useBodyScrollLock(true)

  const resumo = buildNfResumo(nota)
  const itensNf = nota.items.filter((it) => it.allocatedAddresses.includes(addressId))
  const todosEnderecos = nota.items.flatMap((it) =>
    it.allocatedAddresses.map((addr) => ({ addr, item: it })),
  )

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal detail-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="detail-modal-top">
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>

          <div className="detail-nf-hero">
            <span className="detail-nf-label">Nota fiscal</span>
            <p className="detail-nf-numero">NF {nota.numero}</p>
            <p className="detail-nf-emitente">{nota.emitente}</p>
          </div>
        </header>

        <div className="detail-modal-body">
        <section className="detail-product-block">
          <h3>Produto neste endereço</h3>
          {itensNf.length === 0 ? (
            <p className="muted">Nenhum item vinculado.</p>
          ) : (
            <ul className="detail-product-list">
              {itensNf.map((it) => (
                <li key={it.index} className="detail-product-card">
                  <span className="detail-product-codigo">{it.codigo}</span>
                  <span className="detail-product-desc">{it.descricao}</span>
                  <div className="detail-product-qty-row">
                    <span className="detail-product-qty-label">Quantidade</span>
                    <span className="detail-product-qty-value">
                      {formatItemQuantidade(it.quantidade)} {it.unidade}
                    </span>
                  </div>
                  {(it.up || it.lote || it.dataFabricacao || it.dataValidade) && (
                    <dl className="detail-product-meta">
                      {it.up && (
                        <div>
                          <dt>UP</dt>
                          <dd>{it.up}</dd>
                        </div>
                      )}
                      {it.lote && (
                        <div>
                          <dt>Lote</dt>
                          <dd>{it.lote}</dd>
                        </div>
                      )}
                      {it.dataFabricacao && (
                        <div>
                          <dt>Fabricação</dt>
                          <dd>{formatItemData(it.dataFabricacao)}</dd>
                        </div>
                      )}
                      {it.dataValidade && (
                        <div>
                          <dt>Validade</dt>
                          <dd>{formatItemData(it.dataValidade)}</dd>
                        </div>
                      )}
                    </dl>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="modal-section">
          <h3>Endereço</h3>
          <p className="detail-address-line">{formatAddressLabel(addressId)}</p>
        </section>

        <section className="modal-section">
          <h3>Dados da nota</h3>
          <dl className="meta-list">
            <div>
              <dt>Série</dt>
              <dd>{nota.serie || '—'}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{nota.status === 'concluida' ? 'Concluída' : 'Em andamento'}</dd>
            </div>
            <div>
              <dt>Chave</dt>
              <dd className="chave">{nota.chave || '—'}</dd>
            </div>
            <div>
              <dt>Qtd. / vol.</dt>
              <dd>{resumo.quantidadeVolume}</dd>
            </div>
            <div>
              <dt>Peso bruto</dt>
              <dd>{formatPesoKg(resumo.pesoBruto)}</dd>
            </div>
            <div>
              <dt>Valor total</dt>
              <dd>{formatValorNfe(resumo.valorTotalNota)}</dd>
            </div>
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

        <section className="modal-section modal-section--last">
          <h3>Todos os itens da NF</h3>
          <ul className="detail-items">
            {nota.items.map((it) => (
              <li key={it.index}>
                <strong>{it.codigo}</strong> — {it.descricao}
                <span className="muted">
                  {' '}
                  · {it.allocatedAddresses.length} end. · {it.quantidade} {it.unidade}
                </span>
              </li>
            ))}
          </ul>
        </section>
        </div>
      </div>
    </div>
  )
}

function formatItemQuantidade(qty: number): string {
  return Number.isInteger(qty)
    ? qty.toLocaleString('pt-BR')
    : qty.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
}
