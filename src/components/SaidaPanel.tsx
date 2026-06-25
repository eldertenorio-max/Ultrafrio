import { useEffect, useState } from 'react'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import type { AddressId, JustificativaSaidaId, NotaFiscal } from '../types'
import { enderecosDaNf, nfTemEnderecos } from '../lib/movimentos'
import { JUSTIFICATIVAS_SAIDA } from '../lib/justificativaSaida'
import { parsePaletesInput } from '../lib/paletes'
import { formatAddressLabel } from '../layout/camaras'

type Props = {
  nfBusca: NotaFiscal | null
  selecaoAtiva: boolean
  paletesTotal: number | null
  enderecosSelecionados: AddressId[]
  onBuscar: (numero: string) => void
  onIniciarSelecao: (paletes: number) => void
  onCancelarSelecao: () => void
  onFinalizarSaida: (justificativa: JustificativaSaidaId) => void
  onCancelarSaida: () => void
  buscaErro: string | null
  selecaoErro: string | null
}

export function SaidaPanel({
  nfBusca,
  selecaoAtiva,
  paletesTotal,
  enderecosSelecionados,
  onBuscar,
  onIniciarSelecao,
  onCancelarSelecao,
  onFinalizarSaida,
  onCancelarSaida,
  buscaErro,
  selecaoErro,
}: Props) {
  const [numero, setNumero] = useState('')
  const [paletesInput, setPaletesInput] = useState('1')
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [justificativa, setJustificativa] = useState<JustificativaSaidaId | null>(null)
  useBodyScrollLock(confirmarCancelar)

  useEffect(() => {
    setJustificativa(null)
  }, [nfBusca?.id])

  useEffect(() => {
    if (!selecaoAtiva) setPaletesInput('1')
  }, [selecaoAtiva, nfBusca?.id])

  function handleBuscar() {
    onBuscar(numero.trim())
    setNumero('')
  }

  function handleIniciarSelecao() {
    const paletes = parsePaletesInput(paletesInput)
    if (paletes == null || paletes <= 0) return
    onIniciarSelecao(paletes)
  }

  const itensComEndereco = nfBusca?.items.filter((it) => it.allocatedAddresses.length > 0) ?? []
  const totalEnderecosNf = nfBusca ? enderecosDaNf(nfBusca).length : 0
  const podeFinalizar =
    selecaoAtiva &&
    paletesTotal != null &&
    enderecosSelecionados.length === paletesTotal &&
    enderecosSelecionados.length > 0 &&
    justificativa != null

  return (
    <>
      <div className="sidebar-block">
        <p className="muted">
          Digite o número da NF, informe quantos paletes vai retirar e clique nas posições no painel.
        </p>
        <div className="saida-busca">
          <input
            type="text"
            className="input-nf"
            placeholder="Número da NF"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
            disabled={selecaoAtiva}
          />
          <button type="button" className="btn primary" onClick={handleBuscar} disabled={selecaoAtiva}>
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
          <p className="muted">
            {totalEnderecosNf} posição(ões) em estoque · saída parcial por palete e endereço
          </p>

          <ul className="item-list saida-itens-info">
            {itensComEndereco.map((item) => (
              <li key={item.index}>
                <div className="item-row item-row--readonly">
                  <span className="item-text">
                    <strong>{item.codigo}</strong>
                    <span>{item.descricao}</span>
                    <span className="muted">
                      {item.allocatedAddresses.length} endereço(s)
                      {item.paletes != null ? ` · ${item.paletes} palete(s) cadastrado(s)` : ''}
                    </span>
                  </span>
                </div>
                <ul className="addr-mini addr-mini--saida">
                  {item.allocatedAddresses.map((a) => (
                    <li
                      key={a}
                      className={enderecosSelecionados.includes(a) ? 'addr-flagged' : ''}
                    >
                      {formatAddressLabel(a)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          {!selecaoAtiva ? (
            <div className="saida-paletes-form">
              <label className="consulta-campo">
                <span>Paletes nesta saída</span>
                <input
                  type="number"
                  min={1}
                  max={totalEnderecosNf}
                  step={1}
                  className="input-nf"
                  value={paletesInput}
                  onChange={(e) => setPaletesInput(e.target.value)}
                />
              </label>
              <p className="muted saida-paletes-hint">
                Informe quantos paletes vai retirar e depois selecione as posições correspondentes no
                mapa ao lado.
              </p>
              <button type="button" className="btn primary full" onClick={handleIniciarSelecao}>
                Selecionar posições no painel
              </button>
            </div>
          ) : (
            <div className="consulta-enderecar-box saida-enderecar-box">
              <p className="consulta-enderecar-titulo">Selecione as posições no painel</p>
              <p className="muted consulta-enderecar-texto">
                Clique nas células <strong>ocupadas desta NF</strong> (azul) no mapa ao lado para
                indicar de onde vai retirar. Marque exatamente{' '}
                <strong>
                  {paletesTotal ?? 0} posição{paletesTotal === 1 ? '' : 'ões'}
                </strong>{' '}
                — uma para cada palete informado.
              </p>
              <p className="consulta-enderecar-contagem">
                {enderecosSelecionados.length} de {paletesTotal ?? 0} selecionada(s)
              </p>
              {enderecosSelecionados.length > 0 && (
                <ul className="consulta-enderecos saida-enderecos-selecionados">
                  {enderecosSelecionados.map((addr) => (
                    <li key={addr}>{formatAddressLabel(addr)}</li>
                  ))}
                </ul>
              )}
              <div className="consulta-enderecar-actions">
                <button type="button" className="btn btn-ghost" onClick={onCancelarSelecao}>
                  Voltar
                </button>
              </div>
            </div>
          )}

          {selecaoAtiva && enderecosSelecionados.length === paletesTotal && paletesTotal! > 0 && (
            <div className="item-actions">
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

              {selecaoErro && <p className="error">{selecaoErro}</p>}

              <button
                type="button"
                className="btn warning full"
                disabled={!podeFinalizar}
                onClick={() => {
                  if (justificativa) onFinalizarSaida(justificativa)
                }}
              >
                Finalizar saída — {enderecosSelecionados.length} palete(s)
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
              A busca e as posições selecionadas serão descartadas. Nenhuma posição será liberada.
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
                  setNumero('')
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
