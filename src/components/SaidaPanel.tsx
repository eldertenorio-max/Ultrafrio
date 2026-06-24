import { useEffect, useState } from 'react'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import type { JustificativaSaidaId, NotaFiscal } from '../types'
import { enderecosDosItens, nfTemEnderecos } from '../lib/movimentos'
import { JUSTIFICATIVAS_SAIDA } from '../lib/justificativaSaida'
import { formatAddressLabel } from '../layout/camaras'

type Props = {
  nfBusca: NotaFiscal | null
  itensFlagados: Set<number>
  onBuscar: (numero: string) => void
  onToggleItem: (index: number) => void
  onFinalizarSaida: (justificativa: JustificativaSaidaId) => void
  onCancelarSaida: () => void
  buscaErro: string | null
}

export function SaidaPanel({
  nfBusca,
  itensFlagados,
  onBuscar,
  onToggleItem,
  onFinalizarSaida,
  onCancelarSaida,
  buscaErro,
}: Props) {
  const [numero, setNumero] = useState('')
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [justificativa, setJustificativa] = useState<JustificativaSaidaId | null>(null)
  useBodyScrollLock(confirmarCancelar)

  useEffect(() => {
    setJustificativa(null)
  }, [nfBusca?.id])

  function handleBuscar() {
    onBuscar(numero.trim())
  }

  const itensComEndereco = nfBusca?.items.filter((it) => it.allocatedAddresses.length > 0) ?? []
  const enderecosFlagados = nfBusca
    ? enderecosDosItens(nfBusca, [...itensFlagados])
    : []

  return (
    <>
      <div className="sidebar-block">
        <p className="muted">Digite o número da NF para ver onde retirar os itens.</p>
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
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setConfirmarCancelar(true)}
            >
              Cancelar saída
            </button>
          </div>
          <p className="muted">{nfBusca.emitente}</p>
          <p className="muted">Marque os itens que vai retirar:</p>

          <ul className="item-list">
            {itensComEndereco.map((item) => {
              const flagged = itensFlagados.has(item.index)
              return (
                <li key={item.index}>
                  <button
                    type="button"
                    className={`item-row ${flagged ? 'item-row--active' : ''}`}
                    onClick={() => onToggleItem(item.index)}
                  >
                    <span className="item-check">{flagged ? '✓' : '○'}</span>
                    <span className="item-text">
                      <strong>{item.codigo}</strong>
                      <span>{item.descricao}</span>
                      <span className="muted">
                        Retirar de {item.allocatedAddresses.length} endereço(s)
                      </span>
                    </span>
                  </button>
                  <ul className="addr-mini addr-mini--saida">
                    {item.allocatedAddresses.map((a) => (
                      <li key={a} className={flagged ? 'addr-flagged' : ''}>
                        {formatAddressLabel(a)}
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>

          {itensFlagados.size > 0 && (
            <div className="item-actions">
              <p className="muted">
                {itensFlagados.size} item(ns) · {enderecosFlagados.length} endereço(s) serão liberados
              </p>

              <fieldset className="saida-justificativa">
                <legend className="saida-justificativa-title">Motivo da saída</legend>
                <ul className="saida-justificativa-list">
                  {JUSTIFICATIVAS_SAIDA.map((opt) => (
                    <li key={opt.id}>
                      <label className="saida-justificativa-option">
                        <input
                          type="radio"
                          name="justificativa-saida"
                          value={opt.id}
                          checked={justificativa === opt.id}
                          onChange={() => setJustificativa(opt.id)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>

              <button
                type="button"
                className="btn warning full"
                disabled={!justificativa}
                onClick={() => justificativa && onFinalizarSaida(justificativa)}
              >
                Finalizar saída — NF {nfBusca.numero}
              </button>
            </div>
          )}
        </div>
      )}

      {nfBusca && !nfTemEnderecos(nfBusca) && (
        <div className="sidebar-block nf-detail">
          <div className="nf-detail-head">
            <h3>NF {nfBusca.numero}</h3>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setConfirmarCancelar(true)}
            >
              Cancelar saída
            </button>
          </div>
          <p className="muted sidebar-block">Esta NF não possui itens em estoque (posições já liberadas).</p>
        </div>
      )}

      {confirmarCancelar && nfBusca && (
        <div className="confirm-backdrop" onClick={() => setConfirmarCancelar(false)}>
          <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
            <h4>Cancelar saída?</h4>
            <p>
              NF <strong>{nfBusca.numero}</strong>
            </p>
            <p className="confirm-warn">
              A busca e os itens marcados serão descartados. Nenhuma posição será liberada.
            </p>
            <div className="confirm-actions">
              <button type="button" className="btn" onClick={() => setConfirmarCancelar(false)}>
                Voltar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  onCancelarSaida()
                  setConfirmarCancelar(false)
                }}
              >
                Cancelar saída
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
