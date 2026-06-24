import { Fragment, type SyntheticEvent } from 'react'
import type { EntradaItemCampos } from '../lib/entradaCampos'
import { normalizeDataFabricacao, todayDateInputMax } from '../lib/entradaCampos'
import type { NfeItem } from '../types'
import { formatAddressLabel } from '../layout/camaras'
import {
  formatPesoBruto,
  formatQuantidadeNfe,
  formatValorNfe,
} from '../lib/formatNfeItem'

type Props = {
  items: NfeItem[]
  activeItemIndex: number | null
  onSelectItem: (index: number) => void
  onUpdateItemCampos: (itemIndex: number, patch: EntradaItemCampos) => void
}

function itemStatus(item: NfeItem): 'pendente' | 'ok' {
  if (item.allocatedAddresses.length === 0) return 'pendente'
  return 'ok'
}

function stopRowActivate(e: SyntheticEvent) {
  e.stopPropagation()
}

export function NfItensTable({ items, activeItemIndex, onSelectItem, onUpdateItemCampos }: Props) {
  return (
    <div className="nf-itens-table-wrap">
      <table className="nf-itens-table">
        <thead>
          <tr>
            <th scope="col" className="nf-itens-col-status" aria-label="Status" />
            <th scope="col">Código</th>
            <th scope="col">Descrição</th>
            <th scope="col">Un.</th>
            <th scope="col" className="nf-itens-col-num">Peso br.</th>
            <th scope="col" className="nf-itens-col-num">Qtd.</th>
            <th scope="col" className="nf-itens-col-num">V. unit.</th>
            <th scope="col" className="nf-itens-col-num">V. total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const st = itemStatus(item)
            const isActive = activeItemIndex === item.index
            const showEnderecos = item.allocatedAddresses.length > 0

            return (
              <Fragment key={item.index}>
                <tr
                  className={`nf-itens-row nf-itens-row--${st}${isActive ? ' nf-itens-row--active' : ''}`}
                  onClick={() => onSelectItem(item.index)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectItem(item.index)
                    }
                  }}
                >
                  <td className="nf-itens-col-status">
                    <span className={`nf-itens-status nf-itens-status--${st}`}>
                      {st === 'ok' ? '✓' : '○'}
                    </span>
                  </td>
                  <td className="nf-itens-col-codigo">{item.codigo || '—'}</td>
                  <td className="nf-itens-col-descricao" title={item.descricao}>
                    {item.descricao || '—'}
                  </td>
                  <td className="nf-itens-col-un">{item.unidade || '—'}</td>
                  <td className="nf-itens-col-num">{formatPesoBruto(item.pesoBruto)}</td>
                  <td className="nf-itens-col-num">{formatQuantidadeNfe(item.quantidade)}</td>
                  <td className="nf-itens-col-num">{formatValorNfe(item.valorUnitario)}</td>
                  <td className="nf-itens-col-num">{formatValorNfe(item.valorTotal)}</td>
                </tr>
                <tr className="nf-itens-row-campos" onClick={stopRowActivate}>
                  <td className="nf-itens-col-status" aria-hidden />
                  <td colSpan={7}>
                    <div className="nf-itens-campos-row">
                      <label className="nf-itens-campo">
                        <span>UP</span>
                        <input
                          type="text"
                          className="input-nf input-nf--compact"
                          value={item.up ?? ''}
                          onChange={(e) => onUpdateItemCampos(item.index, { up: e.target.value })}
                          onClick={stopRowActivate}
                        />
                      </label>
                      <label className="nf-itens-campo">
                        <span>Lote</span>
                        <input
                          type="text"
                          className="input-nf input-nf--compact"
                          value={item.lote ?? ''}
                          onChange={(e) => onUpdateItemCampos(item.index, { lote: e.target.value })}
                          onClick={stopRowActivate}
                        />
                      </label>
                      <label className="nf-itens-campo">
                        <span>Fab.</span>
                        <input
                          type="date"
                          className="input-nf input-nf--compact"
                          max={todayDateInputMax()}
                          value={item.dataFabricacao ?? ''}
                          onChange={(e) =>
                            onUpdateItemCampos(item.index, {
                              dataFabricacao: normalizeDataFabricacao(e.target.value),
                            })
                          }
                          onClick={stopRowActivate}
                        />
                      </label>
                      <label className="nf-itens-campo">
                        <span>Valid.</span>
                        <input
                          type="date"
                          className="input-nf input-nf--compact"
                          value={item.dataValidade ?? ''}
                          onChange={(e) =>
                            onUpdateItemCampos(item.index, { dataValidade: e.target.value })
                          }
                          onClick={stopRowActivate}
                        />
                      </label>
                    </div>
                  </td>
                </tr>
                {showEnderecos && (
                  <tr className="nf-itens-row-addr">
                    <td colSpan={8}>
                      <ul className="addr-mini nf-itens-addr-list">
                        {item.allocatedAddresses.map((a) => (
                          <li key={a}>{formatAddressLabel(a)}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
