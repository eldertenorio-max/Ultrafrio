import { useEffect, useState } from 'react'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import type { AddressId, JustificativaSaidaId, NotaFiscal } from '../types'
import type { SaidaPaleteDraft } from '../lib/saidaParcial'
import { nfTemEnderecos } from '../lib/movimentos'
import { JUSTIFICATIVAS_SAIDA } from '../lib/justificativaSaida'
import { NfResumoGrid } from './NfResumoGrid'
import { SaidaItensTable } from './SaidaItensTable'
import { SaidaPaleteForm } from './SaidaPaleteForm'

type Props = {
  nfBusca: NotaFiscal | null
  modoPalete: boolean
  paleteAtivo: AddressId | null
  caixasPalete: string
  paletesConfirmados: SaidaPaleteDraft[]
  onBuscar: (numero: string) => void
  onIniciarSelecao: () => void
  onCaixasPaleteChange: (value: string) => void
  onConfirmarPalete: () => void
  onRemoverPalete: (addressId: AddressId) => void
  onFinalizarSaida: (justificativa: JustificativaSaidaId) => void
  onCancelarSaida: () => void
  buscaErro: string | null
  selecaoErro: string | null
}

export function SaidaPanel({
  nfBusca,
  modoPalete,
  paleteAtivo,
  caixasPalete,
  paletesConfirmados,
  onBuscar,
  onIniciarSelecao,
  onCaixasPaleteChange,
  onConfirmarPalete,
  onRemoverPalete,
  onFinalizarSaida,
  onCancelarSaida,
  buscaErro,
  selecaoErro,
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
    setNumero('')
  }

  const podeFinalizar = paletesConfirmados.length > 0 && justificativa != null

  return (
    <>
      <div className="sidebar-block">
        <p className="muted">
          Busque a NF, selecione o palete no painel, informe as caixas e confirme cada retirada.
        </p>
        <div className="saida-busca">
          <input
            type="text"
            className="input-nf"
            placeholder="Número da NF"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
            disabled={modoPalete}
          />
          <button type="button" className="btn primary" onClick={handleBuscar} disabled={modoPalete}>
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

          <dl className="meta-list meta-list--nf">
            <div>
              <dt>Emitente</dt>
              <dd>{nfBusca.emitente || '—'}</dd>
            </div>
            <div>
              <dt>Emissão</dt>
              <dd>{formatDate(nfBusca.dataEmissao)}</dd>
            </div>
            {nfBusca.serie && (
              <div>
                <dt>Série</dt>
                <dd>{nfBusca.serie}</dd>
              </div>
            )}
          </dl>

          <p className="nf-leitura-subtitle">Totais do documento</p>
          <NfResumoGrid nf={nfBusca} compact />

          <h4 className="nf-section-title nf-section-title--sm">Itens da nota</h4>
          <p className="muted nf-itens-intro saida-itens-intro">
            A coluna <strong>Sobra</strong> é atualizada conforme você confirma cada palete na saída.
          </p>

          <SaidaItensTable
            items={nfBusca.items}
            paletesConfirmados={paletesConfirmados}
            paleteAtivo={paleteAtivo}
            paletesConfirmadosIds={paletesConfirmados.map((p) => p.addressId)}
          />

          <SaidaPaleteForm
            nf={nfBusca}
            modoPalete={modoPalete}
            paleteAtivo={paleteAtivo}
            caixasInput={caixasPalete}
            paletesConfirmados={paletesConfirmados}
            onCaixasChange={onCaixasPaleteChange}
            onIniciarSelecao={onIniciarSelecao}
            onConfirmarPalete={onConfirmarPalete}
            onRemoverPalete={onRemoverPalete}
            selecaoErro={selecaoErro}
          />

          {paletesConfirmados.length > 0 && (
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
                Finalizar saída
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
          <dl className="meta-list meta-list--nf">
            <div>
              <dt>Emitente</dt>
              <dd>{nfBusca.emitente || '—'}</dd>
            </div>
            <div>
              <dt>Emissão</dt>
              <dd>{formatDate(nfBusca.dataEmissao)}</dd>
            </div>
          </dl>
          <p className="nf-leitura-subtitle">Totais do documento</p>
          <NfResumoGrid nf={nfBusca} compact />
          <p className="muted sidebar-block">
            Esta NF não possui itens em estoque (posições já liberadas).
          </p>
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
              A busca e os paletes confirmados serão descartados. Nenhuma posição será liberada.
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

function formatDate(raw: string): string {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10)
  return d.toLocaleString('pt-BR')
}
