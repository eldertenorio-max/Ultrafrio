import { useState } from 'react'
import type { NotaFiscal } from '../types'
import { nfTemEnderecos } from '../lib/movimentos'
import { formatAddressLabel } from '../layout/camaras'

type Props = {
  nfBusca: NotaFiscal | null
  itemIndex: number | null
  pendingCount: number
  onBuscar: (numero: string) => void
  onSelectItem: (index: number) => void
  onSalvar: () => void
  buscaErro: string | null
}

export function EditarPosicaoPanel({
  nfBusca,
  itemIndex,
  pendingCount,
  onBuscar,
  onSelectItem,
  onSalvar,
  buscaErro,
}: Props) {
  const [numero, setNumero] = useState('')

  function handleBuscar() {
    onBuscar(numero.trim())
  }

  const itensComEndereco = nfBusca?.items.filter((it) => it.allocatedAddresses.length > 0) ?? []

  return (
    <>
      <div className="sidebar-block">
        <p className="muted">Busque a NF e escolha o item para alterar as posições no painel.</p>
        <div className="saida-busca">
          <input
            type="text"
            className="input-nf"
            placeholder="Número da NF"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
          />
          <button type="button" className="btn primary" onClick={handleBuscar}>
            Buscar
          </button>
        </div>
        {buscaErro && <p className="error">{buscaErro}</p>}
      </div>

      {nfBusca && nfTemEnderecos(nfBusca) && (
        <div className="sidebar-block nf-detail">
          <h3>NF {nfBusca.numero}</h3>
          <p className="muted">{nfBusca.emitente}</p>
          <p className="muted">Selecione o item para editar:</p>

          <ul className="item-list">
            {itensComEndereco.map((item) => {
              const isActive = itemIndex === item.index
              return (
                <li key={item.index}>
                  <button
                    type="button"
                    className={`item-row ${isActive ? 'item-row--active' : ''}`}
                    onClick={() => onSelectItem(item.index)}
                  >
                    <span className="item-check">{isActive ? '✎' : '○'}</span>
                    <span className="item-text">
                      <strong>{item.codigo}</strong>
                      <span>{item.descricao}</span>
                      <span className="muted">
                        {item.allocatedAddresses.length} endereço(s)
                      </span>
                    </span>
                  </button>
                  <ul className="addr-mini">
                    {item.allocatedAddresses.map((a) => (
                      <li key={a} className={isActive ? 'addr-edit-active' : ''}>
                        {formatAddressLabel(a)}
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>

          {itemIndex != null && (
            <div className="item-actions">
              <p className="muted">
                {pendingCount} endereço(s) selecionado(s) — clique no painel para marcar ou desmarcar.
              </p>
              <button
                type="button"
                className="btn success full"
                onClick={onSalvar}
                disabled={pendingCount === 0}
              >
                Salvar novas posições
              </button>
            </div>
          )}
        </div>
      )}

      {nfBusca && !nfTemEnderecos(nfBusca) && (
        <p className="muted sidebar-block">Esta NF não possui endereços alocados.</p>
      )}
    </>
  )
}
