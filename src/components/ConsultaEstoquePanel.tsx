import { useState } from 'react'
import { formatAddressLabel } from '../layout/camaras'
import {
  CONSULTA_FILTROS_VAZIOS,
  type ConsultaEstoqueFiltros,
  type ConsultaEstoqueResultado,
} from '../lib/consultaEstoque'

type Props = {
  emitentesSugeridos: string[]
  resultados: ConsultaEstoqueResultado[]
  buscaErro: string | null
  onBuscar: (filtros: ConsultaEstoqueFiltros) => void
  onLimpar: () => void
}

export function ConsultaEstoquePanel({
  emitentesSugeridos,
  resultados,
  buscaErro,
  onBuscar,
  onLimpar,
}: Props) {
  const [filtros, setFiltros] = useState<ConsultaEstoqueFiltros>(CONSULTA_FILTROS_VAZIOS)

  function patch(partial: Partial<ConsultaEstoqueFiltros>) {
    setFiltros((prev) => ({ ...prev, ...partial }))
  }

  function handleBuscar() {
    onBuscar(filtros)
    setFiltros(CONSULTA_FILTROS_VAZIOS)
  }

  function handleLimpar() {
    setFiltros(CONSULTA_FILTROS_VAZIOS)
    onLimpar()
  }

  const agrupados = agruparPorNf(resultados)

  return (
    <>
      <div className="sidebar-block">
        <p className="muted">
          Filtre por nota, item, remetente ou lote. Os endereços encontrados aparecem no painel com
          contorno azul, sem cobrir o número da NF.
        </p>

        <div className="consulta-filtros">
          <label className="consulta-campo">
            <span>Nota fiscal</span>
            <input
              type="text"
              className="input-nf"
              placeholder="Número da NF"
              value={filtros.nfNumero}
              onChange={(e) => patch({ nfNumero: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
            />
          </label>

          <label className="consulta-campo">
            <span>Item</span>
            <input
              type="text"
              className="input-nf"
              placeholder="Código ou descrição"
              value={filtros.item}
              onChange={(e) => patch({ item: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
            />
          </label>

          <label className="consulta-campo">
            <span>Remetente</span>
            <input
              type="text"
              className="input-nf"
              placeholder="Nome do remetente"
              list="consulta-emitentes"
              value={filtros.remetente}
              onChange={(e) => patch({ remetente: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
            />
            <datalist id="consulta-emitentes">
              {emitentesSugeridos.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          </label>

          <label className="consulta-campo">
            <span>Lote</span>
            <input
              type="text"
              className="input-nf"
              placeholder="Lote do item"
              value={filtros.lote}
              onChange={(e) => patch({ lote: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
            />
          </label>
        </div>

        <div className="consulta-actions">
          <button type="button" className="btn primary" onClick={handleBuscar}>
            Pesquisar
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleLimpar}>
            Limpar
          </button>
        </div>

        {buscaErro && <p className="error">{buscaErro}</p>}
      </div>

      {resultados.length > 0 && (
        <div className="sidebar-block">
          <h3>
            {resultados.length}{' '}
            {resultados.length === 1 ? 'endereço encontrado' : 'endereços encontrados'}
          </h3>
          <ul className="consulta-resultados">
            {agrupados.map((grupo) => (
              <li key={grupo.nfId} className="consulta-grupo">
                <p className="consulta-grupo-titulo">
                  <strong>NF {grupo.nfNumero}</strong>
                  <span className="muted"> · {grupo.emitente}</span>
                </p>
                <ul className="consulta-grupo-itens">
                  {grupo.itens.map((item) => (
                    <li key={`${grupo.nfId}-${item.itemIndex}`}>
                      <span className="consulta-item-codigo">{item.codigo}</span>
                      <span className="muted"> — {item.descricao}</span>
                      {(item.lote || item.up) && (
                        <span className="consulta-item-meta">
                          {item.lote ? ` · Lote ${item.lote}` : ''}
                          {item.up ? ` · UP ${item.up}` : ''}
                        </span>
                      )}
                      <ul className="consulta-enderecos">
                        {item.enderecos.map((addr) => (
                          <li key={addr}>{formatAddressLabel(addr)}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

type GrupoNf = {
  nfId: string
  nfNumero: string
  emitente: string
  itens: Array<{
    itemIndex: number
    codigo: string
    descricao: string
    lote?: string
    up?: string
    enderecos: string[]
  }>
}

function agruparPorNf(resultados: ConsultaEstoqueResultado[]): GrupoNf[] {
  const porNf = new Map<string, GrupoNf>()

  for (const r of resultados) {
    let grupo = porNf.get(r.nfId)
    if (!grupo) {
      grupo = { nfId: r.nfId, nfNumero: r.nfNumero, emitente: r.emitente, itens: [] }
      porNf.set(r.nfId, grupo)
    }

    let item = grupo.itens.find((it) => it.itemIndex === r.itemIndex)
    if (!item) {
      item = {
        itemIndex: r.itemIndex,
        codigo: r.codigo,
        descricao: r.descricao,
        ...(r.lote ? { lote: r.lote } : {}),
        ...(r.up ? { up: r.up } : {}),
        enderecos: [],
      }
      grupo.itens.push(item)
    }
    if (!item.enderecos.includes(r.addressId)) item.enderecos.push(r.addressId)
  }

  return [...porNf.values()]
}
