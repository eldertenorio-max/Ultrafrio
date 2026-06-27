import { useState } from 'react'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { MOTIVOS_REMOCAO_ESTOQUE } from '../lib/motivoRemocaoEstoque'
import type { AddressId, MotivoRemocaoEstoqueId, NotaFiscal } from '../types'
import { itemNoStage } from '../layout/stage'
import { nfTemEstoqueArmazem, nfTemEstoqueStage } from '../lib/stageEstoque'
import { NfDetalheLeitura } from './NfDetalheLeitura'
import { EnderecoDestinoForm } from './EnderecoDestinoForm'
import { MovimentacaoVozControle } from './MovimentacaoVozControle'

type Props = {
  nfBusca: NotaFiscal | null
  itemIndex: number | null
  pendingCount: number
  stagePendingCount: number
  moveOrigensCount: number
  moveDestinosCount: number
  salvando?: boolean
  vozOrigemAddress: AddressId | null
  vozErro: string | null
  marcandoStage: boolean
  onSetMarcandoStage: (value: boolean) => void
  onSelectVozOrigem: (addressId: AddressId, itemIndex: number) => void
  onVozDestino: (transcript: string) => void
  onVozErro: (message: string) => void
  onLimparVozErro: () => void
  enderecosOcupados: Set<AddressId>
  enderecosSelecionados: Set<AddressId>
  onBuscar: (numero: string) => void
  onSelectItem: (index: number) => void
  onAdicionarEnderecoDestino: (addressId: AddressId) => void
  onSalvar: () => void | Promise<void>
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
  moveOrigensCount,
  moveDestinosCount,
  salvando = false,
  vozOrigemAddress,
  vozErro,
  marcandoStage,
  onSetMarcandoStage,
  onSelectVozOrigem,
  onVozDestino,
  onVozErro,
  onLimparVozErro,
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
  const restantesDistribuir = Math.max(0, moveOrigensCount - moveDestinosCount)
  const distribuicaoCompleta =
    moveOrigensCount > 0 && moveOrigensCount === moveDestinosCount

  return (
    <>
      <div className="sidebar-block">
        <p className="muted">
          Busque a NF e movimente livremente entre o armazém físico e o stage — pelo mapa,
          por voz ou pelos campos de endereço.
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
            vozOrigemAddress={!marcandoStage && !itemStage ? vozOrigemAddress : null}
            onSelectVozOrigem={
              !marcandoStage && itemIndex != null && !itemStage ? onSelectVozOrigem : undefined
            }
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
                    onClick={async () => {
                      await onSalvar()
                      setNumero('')
                    }}
                    disabled={pendingCount === 0 || salvando}
                  >
                    {salvando ? 'Salvando…' : 'Mover para o armazém'}
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
                      <div className="movimentacao-distribuicao">
                        <p className="movimentacao-distribuicao-title">Distribuição</p>
                        {moveOrigensCount === 0 ? (
                          <p className="muted">
                            <strong>Passo 1:</strong> clique ou arraste nos quadrados{' '}
                            <strong>ocupados</strong> no mapa para marcar o que vai tirar.
                          </p>
                        ) : (
                          <>
                            <p>
                              <strong>{moveOrigensCount}</strong> palete
                              {moveOrigensCount !== 1 ? 's' : ''} para tirar
                            </p>
                            <p>
                              Destinos escolhidos:{' '}
                              <strong>
                                {moveDestinosCount} / {moveOrigensCount}
                              </strong>
                            </p>
                            {restantesDistribuir > 0 ? (
                              <p className="movimentacao-distribuicao-restante">
                                Restam <strong>{restantesDistribuir}</strong> quadrado
                                {restantesDistribuir !== 1 ? 's' : ''} branco
                                {restantesDistribuir !== 1 ? 's' : ''} para distribuir
                              </p>
                            ) : (
                              <p className="movimentacao-distribuicao-ok">
                                Distribuição completa — confirme abaixo.
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      <MovimentacaoVozControle
                        origemSelecionada={vozOrigemAddress}
                        onDestinoFalado={onVozDestino}
                        onErro={onVozErro}
                        erro={vozErro}
                        onLimparErro={onLimparVozErro}
                      />
                      <button
                        type="button"
                        className="btn success full"
                        onClick={async () => {
                          await onSalvar()
                          setNumero('')
                        }}
                        disabled={!distribuicaoCompleta || stagePendingCount > 0 || salvando}
                      >
                        {salvando ? 'Salvando…' : 'Confirmar movimentação'}
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
