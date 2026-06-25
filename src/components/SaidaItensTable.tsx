import { Fragment } from 'react'
import { sobrasPorItem, pesoBrutoTotalItem, pesoLiquidoTotalItem } from '../lib/saidaParcial'
import type { SaidaPaleteDraft } from '../lib/saidaParcial'
import type { NfeItem, NotaFiscal } from '../types'
import { formatAddressLabel } from '../layout/camaras'
import {
  formatPesoBruto,
  formatQuantidadeNfe,
  formatValorNfe,
} from '../lib/formatNfeItem'

type Props = {
  nf: NotaFiscal
  items: NfeItem[]
  paletesConfirmados: SaidaPaleteDraft[]
  paleteAtivo: string | null
  paletesConfirmadosIds: string[]
  paletesSelecionadosIds?: string[]
}

export function SaidaItensTable({
  nf,
  items,
  paletesConfirmados,
  paleteAtivo,
  paletesConfirmadosIds,
  paletesSelecionadosIds = [],
}: Props) {
  const itensEstoque = items.filter((it) => it.allocatedAddresses.length > 0)
  const sobras = sobrasPorItem(items, paletesConfirmados)

  return (
    <div className="nf-itens-table-wrap saida-itens-table-wrap">
      <table className="nf-itens-table saida-itens-table">
        <thead>
          <tr>
            <th scope="col" className="nf-itens-col-status" aria-label="Status" />
            <th scope="col">Código</th>
            <th scope="col">Descrição</th>
            <th scope="col">Un.</th>
            <th scope="col" className="nf-itens-col-num">Peso br.</th>
            <th scope="col" className="nf-itens-col-num">P. líq.</th>
            <th scope="col" className="nf-itens-col-num">Qtd.</th>
            <th scope="col" className="nf-itens-col-num">V. unit.</th>
            <th scope="col" className="nf-itens-col-num">V. total</th>
            <th scope="col" className="nf-itens-col-num">Sobra</th>
          </tr>
        </thead>
        <tbody>
          {itensEstoque.map((item) => {
            const sobra = sobras[item.index] ?? item.quantidade
            const temSaida = sobra < item.quantidade - 1e-9

            return (
              <Fragment key={item.index}>
                <tr
                  className={`nf-itens-row nf-itens-row--ok${temSaida ? ' nf-itens-row--active' : ''}`}
                >
                  <td className="nf-itens-col-status">
                    <span className="nf-itens-status nf-itens-status--ok">✓</span>
                  </td>
                  <td className="nf-itens-col-codigo">{item.codigo || '—'}</td>
                  <td className="nf-itens-col-descricao" title={item.descricao}>
                    {item.descricao || '—'}
                  </td>
                  <td className="nf-itens-col-un">{item.unidade || '—'}</td>
                  <td className="nf-itens-col-num">
                    {formatPesoBruto(pesoBrutoTotalItem(nf, item) ?? item.pesoBruto)}
                  </td>
                  <td className="nf-itens-col-num">
                    {formatPesoBruto(pesoLiquidoTotalItem(nf, item))}
                  </td>
                  <td className="nf-itens-col-num">{formatQuantidadeNfe(item.quantidade)}</td>
                  <td className="nf-itens-col-num">{formatValorNfe(item.valorUnitario)}</td>
                  <td className="nf-itens-col-num">{formatValorNfe(item.valorTotal)}</td>
                  <td className="nf-itens-col-num">
                    <span className={temSaida ? 'saida-valor--sobra' : undefined}>
                      {formatQuantidadeNfe(sobra)}
                    </span>
                  </td>
                </tr>
                <tr className="nf-itens-row-addr">
                  <td colSpan={10}>
                    <ul className="addr-mini nf-itens-addr-list addr-mini--saida">
                      {item.allocatedAddresses.map((a) => (
                        <li
                          key={a}
                          className={
                            paleteAtivo === a
                              ? 'addr-flagged addr-ativo'
                              : paletesConfirmadosIds.includes(a)
                                ? 'addr-confirmado'
                                : paletesSelecionadosIds.includes(a)
                                  ? 'addr-selecionado'
                                  : ''
                          }
                        >
                          {formatAddressLabel(a)}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
