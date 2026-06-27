import { useState } from 'react'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { MOTIVOS_REMOCAO_ESTOQUE } from '../lib/motivoRemocaoEstoque'
import type { AddressId, MotivoRemocaoEstoqueId, NotaFiscal } from '../types'
import { formatAddressLabel } from '../layout/camaras'
import { itemNoStage } from '../layout/stage'
import { nfTemEstoqueArmazem, nfTemEstoqueStage } from '../lib/stageEstoque'
import { NfDetalheLeitura } from './NfDetalheLeitura'
import { EnderecoDestinoForm } from './EnderecoDestinoForm'

type Props = {
  nfBusca: NotaFiscal | null
  itemIndex: number | null
  pendingCount: number
  stagePendingCount: number
  moveOrigem: AddressId | null
  moveDestino: AddressId | null
  marcandoStage: boolean
  onSetMarcandoStage: (value: boolean) => void
  enderecosOcupados: Set<AddressId>
  enderecosSelecionados: Set<AddressId>
  onBuscar: (numero: string) => void
  onSelectItem: (index: number) => void
  onAdicionarEnderecoDestino: (addressId: AddressId) => void
  onSalvar: () => void
  onRemoverDoEstoque: (nfId: string, motivo: MotivoRemocaoEstoqueId) => void
  onCancelarEditar: () => void
  buscaErro: string | null
}

function itemMovimentavel(item: { localizacao?: string; allocatedAddresses: string[] }): boolean {
  return itemNoStage(item as Parameters<typeof itemNoStage>[0]) || item.allocatedAddresses.length > 0
}

export function EditarPosicaoPanel({
  nfBusca,
  itemIndex,
  pendingCount,
  stagePendingCount,
  moveOrigem,
  moveDestino,
  marcandoStage,
  onSetMarcandoStage,
  enderecosOcupados,
  enderecosSelecionados,
  onBuscar,
  onSelectItem,
  onAdicionarEnderecoDestino,
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

  const nfTemConteudo =
    nfBusca && (nfTemEstoqueArmazem(nfBusca) || nfTemEstoqueStage(nfBusca))

  const itemAtivo =
    nfBusca && itemIndex != null
      ? nfBusca.items.find((it) => it.index === itemIndex) ?? null
      : null
  const itemStage = itemAtivo != null && itemNoStage(itemAtivo)

  return (
    <>
      <div className="sidebar-block">
        <p className="muted">
          Busque a NF e movimente livremente entre o armazém físico e o stage — pelos campos de
          endereço ou clicando no mapa 2D.
        </p>
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

      {nfBusca && nfTemConteudo && (
        <div className="sidebar-block nf-detail">
          <NfDetalheLeitura
            nf={nfBusca}
            actions={nfActions}
            activeItemIndex={itemIndex}
            onSelectItem={onSelectItem}
            selectablePredicate={itemMovimentavel}
            itensIntro="Selecione um item no armazém ou no stage para movimentar."
          />

          {itemAtivo && itemStage && (
            <EnderecoDestinoForm
              ocupados={enderecosOcupados}
              selecionados={enderecosSelecionados}
              onConfirmar={onAdicionarEnderecoDestino}
            />
          )}

          {itemIndex != null && (
            <div className="item-actions">
              {itemStage ? (
                <>
                  <p className="muted">
                    {pendingCount} endereço(s) selecionado(s) — use os campos acima ou clique/arraste
                    no painel para marcar posições no armazém físico.
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
                    Mover para o armazém
                  </button>
                </>
              ) : (
                <>
                  <div className="movimentacao-modo-toggle">
                    <button
                      type="button"
                      className={`btn btn-sm ${!marcandoStage ? 'primary' : ''}`}
                      onClick={() => onSetMarcandoStage(false)}
                    >
                      Reposicionar
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${marcandoStage ? 'primary' : ''}`}
                      onClick={() => onSetMarcandoStage(true)}
                    >
                      Enviar ao STAGE
                    </button>
                  </div>
                  {marcandoStage ? (
                    stagePendingCount > 0 ? (
                      <p className="muted movimentacao-stage-hint">
                        {stagePendingCount} palete(s) marcado(s) — clique na área{' '}
                        <strong>STAGE</strong> no mapa para confirmar.
                      </p>
                    ) : (
                      <p className="muted">
                        Clique nos endereços ocupados do item no mapa para marcar envio ao stage.
                      </p>
                    )
                  ) : (
                    <>
                      <p className="muted">
                        {moveOrigem
                          ? moveDestino
                            ? `Origem: ${formatAddressLabel(moveOrigem)} → Destino: ${formatAddressLabel(moveDestino)}`
                            : `Origem: ${formatAddressLabel(moveOrigem)} — agora clique no destino vazio no mapa.`
                          : 'Passo 1: clique no endereço ocupado de onde vai tirar. Passo 2: clique no vazio onde vai colocar.'}
                      </p>
                      <button
                        type="button"
                        className="btn success full"
                        onClick={() => {
                          onSalvar()
                          setNumero('')
                        }}
                        disabled={!moveOrigem || !moveDestino || stagePendingCount > 0}
                      >
                        Confirmar movimentação
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {nfBusca && !nfTemConteudo && (
        <div className="sidebar-block nf-detail">
          <NfDetalheLeitura nf={nfBusca} actions={nfActions} />
          <p className="muted sidebar-block">Esta NF não possui estoque no armazém nem no stage.</p>
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
              {pendingCount > 0 || stagePendingCount > 0
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
