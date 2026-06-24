import { useState } from 'react'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import type { NotaFiscal } from '../types'
import { nfTemEnderecos } from '../lib/movimentos'
import { formatAddressLabel } from '../layout/camaras'

type Props = {
  nfBusca: NotaFiscal | null
  movimentoEntradaId: string | null
  itemIndex: number | null
  pendingCount: number
  onBuscar: (numero: string) => void
  onSelectItem: (index: number) => void
  onSalvar: () => void
  onExcluirEntrada: (movId: string) => void
  onCancelarEditar: () => void
  buscaErro: string | null
}

export function EditarPosicaoPanel({
  nfBusca,
  movimentoEntradaId,
  itemIndex,
  pendingCount,
  onBuscar,
  onSelectItem,
  onSalvar,
  onExcluirEntrada,
  onCancelarEditar,
  buscaErro,
}: Props) {
  const [numero, setNumero] = useState('')
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [confirmarExcluir, setConfirmarExcluir] = useState(false)
  useBodyScrollLock(confirmarCancelar || confirmarExcluir)

  function handleBuscar() {
    onBuscar(numero.trim())
    setNumero('')
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
          <div className="nf-detail-head">
            <h3>NF {nfBusca.numero}</h3>
            <div className="nf-detail-actions">
              {movimentoEntradaId && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => setConfirmarExcluir(true)}
                >
                  Excluir entrada
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirmarCancelar(true)}
              >
                Cancelar edição
              </button>
            </div>
          </div>
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
                {pendingCount} endereço(s) selecionado(s) — clique ou arraste no painel para marcar ou desmarcar.
              </p>
              <button
                type="button"
                className="btn success full"
                onClick={() => {
                  onSalvar()
                  setNumero('')
                }}
                disabled={pendingCount === 0}
              >
                Salvar novas posições
              </button>
            </div>
          )}
        </div>
      )}

      {nfBusca && !nfTemEnderecos(nfBusca) && (
        <div className="sidebar-block nf-detail">
          <div className="nf-detail-head">
            <h3>NF {nfBusca.numero}</h3>
            <div className="nf-detail-actions">
              {movimentoEntradaId && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => setConfirmarExcluir(true)}
                >
                  Excluir entrada
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirmarCancelar(true)}
              >
                Cancelar edição
              </button>
            </div>
          </div>
          <p className="muted">Esta NF não possui endereços alocados.</p>
        </div>
      )}

      {confirmarExcluir && nfBusca && movimentoEntradaId && (
        <div className="confirm-backdrop" onClick={() => setConfirmarExcluir(false)}>
          <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
            <h4>Excluir entrada?</h4>
            <p>
              NF <strong>{nfBusca.numero}</strong>
            </p>
            <p className="confirm-warn">
              As posições ocupadas serão liberadas e a NF será removida do sistema. O registro permanecerá no histórico.
            </p>
            <div className="confirm-actions">
              <button type="button" className="btn" onClick={() => setConfirmarExcluir(false)}>
                Voltar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  onExcluirEntrada(movimentoEntradaId)
                  setConfirmarExcluir(false)
                  setNumero('')
                }}
              >
                Excluir entrada
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmarCancelar && nfBusca && (
        <div className="confirm-backdrop" onClick={() => setConfirmarCancelar(false)}>
          <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
            <h4>Cancelar edição?</h4>
            <p>
              NF <strong>{nfBusca.numero}</strong>
            </p>
            <p className="confirm-warn">
              {pendingCount > 0
                ? 'As alterações não salvas serão descartadas. As posições já salvas no estoque não mudam.'
                : 'A busca e a seleção de item serão descartadas.'}
            </p>
            <div className="confirm-actions">
              <button type="button" className="btn" onClick={() => setConfirmarCancelar(false)}>
                Voltar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  onCancelarEditar()
                  setConfirmarCancelar(false)
                  setNumero('')
                }}
              >
                Cancelar edição
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
