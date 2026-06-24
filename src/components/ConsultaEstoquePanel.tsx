import { useState } from 'react'
import { formatAddressLabel } from '../layout/camaras'
import {
  CONSULTA_FILTROS_VAZIOS,
  type ConsultaEstoqueFiltros,
  type ConsultaEstoqueResultado,
} from '../lib/consultaEstoque'
import type { NotaFiscal } from '../types'

type Props = {
  emitentesSugeridos: string[]
  resultados: ConsultaEstoqueResultado[]
  buscaErro: string | null
  onBuscar: (filtros: ConsultaEstoqueFiltros) => void
  onLimpar: () => void
  nfAdicionar: NotaFiscal | null
  nfAdicionarErro: string | null
  itemAdicionadoMsg: string | null
  onBuscarNfAdicionar: (numero: string) => void
  onAdicionarItem: (itemIndex: number) => void
  onLimparNfAdicionar: () => void
}

export function ConsultaEstoquePanel({
  emitentesSugeridos,
  resultados,
  buscaErro,
  onBuscar,
  onLimpar,
  nfAdicionar,
  nfAdicionarErro,
  itemAdicionadoMsg,
  onBuscarNfAdicionar,
  onAdicionarItem,
  onLimparNfAdicionar,
}: Props) {
  const [filtros, setFiltros] = useState<ConsultaEstoqueFiltros>(CONSULTA_FILTROS_VAZIOS)
  const [numeroNf, setNumeroNf] = useState('')

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

  function handleBuscarNf() {
    onBuscarNfAdicionar(numeroNf.trim())
    setNumeroNf('')
  }

  const agrupados = agruparPorNf(resultados)

  return (
    <>
      <div className="sidebar-block">
        <p className="muted">
          Filtre por nota, item, remetente ou lote. Os endereços encontrados aparecem no painel com
          fundo verde claro, sem cobrir o número da NF.
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

      <div className="sidebar-block consulta-adicionar">
        <h3 className="consulta-section-title">Adicionar item à NF</h3>
        <p className="muted">
          Busque uma NF já importada por XML e duplique um item para registrar outro lote ou data.
          Depois enderece na aba Entrada.
        </p>
        <div className="saida-busca">
          <input
            type="text"
            className="input-nf"
            placeholder="Número da NF"
            value={numeroNf}
            onChange={(e) => setNumeroNf(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBuscarNf()}
          />
          <button type="button" className="btn primary" onClick={handleBuscarNf}>
            Buscar
          </button>
        </div>
        {nfAdicionarErro && <p className="error">{nfAdicionarErro}</p>}
        {itemAdicionadoMsg && <p className="consulta-sucesso">{itemAdicionadoMsg}</p>}

        {nfAdicionar && (
          <div className="consulta-nf-adicionar">
            <div className="consulta-nf-adicionar-head">
              <p className="consulta-grupo-titulo">
                <strong>NF {nfAdicionar.numero}</strong>
                <span className="muted"> · {nfAdicionar.emitente}</span>
              </p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onLimparNfAdicionar}>
                Limpar
              </button>
            </div>
            <p className="muted consulta-nf-adicionar-hint">
              Escolha o item de origem para criar uma nova linha:
            </p>
            <ul className="consulta-itens-adicionar">
              {nfAdicionar.items.map((item) => (
                <li key={item.index}>
                  <div className="consulta-item-adicionar-row">
                    <span className="consulta-item-codigo">{item.codigo}</span>
                    <span className="muted"> — {item.descricao}</span>
                    {(item.lote || item.up) && (
                      <span className="consulta-item-meta">
                        {item.lote ? ` · Lote ${item.lote}` : ''}
                        {item.up ? ` · UP ${item.up}` : ''}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost consulta-btn-adicionar"
                    onClick={() => onAdicionarItem(item.index)}
                  >
                    + Adicionar item
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
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
