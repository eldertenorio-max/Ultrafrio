import { useState } from 'react'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { MOTIVOS_REMOCAO_ESTOQUE } from '../lib/motivoRemocaoEstoque'
import type { MotivoRemocaoEstoqueId, NotaFiscal } from '../types'
import { nfTemEnderecos } from '../lib/movimentos'
import { NfDetalheLeitura } from './NfDetalheLeitura'

type Props = {
  nfBusca: NotaFiscal | null
  itemIndex: number | null
  pendingCount: number
  onBuscar: (numero: string) => void
  onSelectItem: (index: number) => void
  onSalvar: () => void
  onRemoverDoEstoque: (nfId: string, motivo: MotivoRemocaoEstoqueId) => void
  onCancelarEditar: () => void
  buscaErro: string | null
}

export function EditarPosicaoPanel({
  nfBusca,
  itemIndex,
  pendingCount,
  onBuscar,
  onSelectItem,
  onSalvar,
  onRemoverDoEstoque,
  onCancelarEditar,
  buscaErro,
}: Props) {
  const [numero, setNumero] = useState('')
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [confirmarRemover, setConfirmarRemover] = useState(false)
  const [motivoRemocao, setMotivoRemocao] = useState<MotivoRemocaoEstoqueId | null>(null)
  useBodyScrollLock(confirmarCancelar || confirmarRemover)

  function handleBuscar() {
    onBuscar(numero.trim())
    setNumero('')
  }

  function fecharRemover() {
    setConfirmarRemover(false)
    setMotivoRemocao(null)
  }

  const nfActions = nfBusca ? (
    <div className="nf-detail-actions">
      <button
        type="button"
        className="btn btn-danger btn-sm"
        onClick={() => setConfirmarRemover(true)}
      >
        Remover do estoque
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setConfirmarCancelar(true)}
      >
        Cancelar edição
      </button>
    </div>
  ) : null

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
          <NfDetalheLeitura
            nf={nfBusca}
            actions={nfActions}
            activeItemIndex={itemIndex}
            onSelectItem={onSelectItem}
            selectablePredicate={(item) => item.allocatedAddresses.length > 0}
            itensIntro="Selecione um item com endereço para alterar as posições no painel."
          />

          {itemIndex != null && (
            <div className="item-actions">
              <p className="muted">
                {pendingCount} endereço(s) selecionado(s) — clique em uma célula vazia no painel
                para transferir o palete (a origem é liberada automaticamente).
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
          <NfDetalheLeitura nf={nfBusca} actions={nfActions} />
          <p className="muted sidebar-block">Esta NF não possui endereços alocados.</p>
        </div>
      )}

      {confirmarRemover && nfBusca && (
        <div className="confirm-backdrop" onClick={fecharRemover}>
          <div className="confirm-box confirm-box--wide" onClick={(e) => e.stopPropagation()}>
            <h4>Remover do estoque?</h4>
            <p>
              NF <strong>{nfBusca.numero}</strong>
            </p>
            <p className="confirm-warn">
              A NF será retirada do painel e os endereços liberados. O registro permanece no
              histórico com o motivo informado.
            </p>
            <fieldset className="saida-justificativa">
              <legend className="saida-justificativa-title">Motivo do erro</legend>
              <ul className="saida-justificativa-list">
                {MOTIVOS_REMOCAO_ESTOQUE.map((opt) => (
                  <li key={opt.id}>
                    <label className="saida-justificativa-option">
                      <input
                        type="radio"
                        name="motivo-remocao-estoque"
                        value={opt.id}
                        checked={motivoRemocao === opt.id}
                        onChange={() => setMotivoRemocao(opt.id)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
            <div className="confirm-actions">
              <button type="button" className="btn" onClick={fecharRemover}>
                Voltar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={!motivoRemocao}
                onClick={() => {
                  if (!motivoRemocao) return
                  onRemoverDoEstoque(nfBusca.id, motivoRemocao)
                  fecharRemover()
                  setNumero('')
                }}
              >
                Remover do estoque
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
