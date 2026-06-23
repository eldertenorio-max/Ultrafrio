import { useId, useState } from 'react'
import type { AddressId, NotaFiscal } from '../types'
import { formatAddressLabel } from '../layout/camaras'
import { findNotaByNumero } from '../lib/nfDuplicate'
import type { ManualNfInput } from '../lib/manualNf'

export type ManualNfModalResult =
  | { kind: 'existing'; nfId: string; itemIndex: number }
  | { kind: 'new'; input: ManualNfInput }

type Props = {
  addressId?: AddressId | null
  notas: NotaFiscal[]
  emitentesSugeridos: string[]
  serverError?: string | null
  onConfirm: (result: ManualNfModalResult) => void
  onClose: () => void
}

export function ManualNfModal({
  addressId,
  notas,
  emitentesSugeridos,
  serverError,
  onConfirm,
  onClose,
}: Props) {
  const [numero, setNumero] = useState('')
  const [searched, setSearched] = useState<NotaFiscal | null | undefined>(undefined)
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [serie, setSerie] = useState('')
  const [emitente, setEmitente] = useState('')
  const [codigo, setCodigo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [unidade, setUnidade] = useState('UN')
  const [error, setError] = useState<string | null>(null)
  const emitentesListId = useId()

  function handleBuscar() {
    setError(null)
    const trimmed = numero.trim()
    if (!trimmed) {
      setError('Informe o número da NF.')
      return
    }
    const nf = findNotaByNumero(notas, trimmed)
    setSearched(nf ?? null)
    setSelectedItemIndex(nf?.items[0]?.index ?? null)
    setShowCreate(!nf)
    if (!nf) {
      setSerie('')
      setEmitente('')
      setCodigo('')
      setDescricao('')
      setQuantidade('1')
      setUnidade('UN')
    }
  }

  function handleConfirm() {
    setError(null)

    if (searched === undefined) {
      setError('Busque a NF pelo número antes de confirmar.')
      return
    }

    if (searched && !showCreate) {
      if (selectedItemIndex == null) {
        setError('Selecione o item que ficará neste endereço.')
        return
      }
      onConfirm({ kind: 'existing', nfId: searched.id, itemIndex: selectedItemIndex })
      return
    }

    const qty = Number(quantidade.replace(',', '.'))
    const input: ManualNfInput = {
      numero: numero.trim(),
      serie,
      emitente,
      items: [{ codigo, descricao, quantidade: qty, unidade }],
    }

    if (!input.numero) {
      setError('Informe o número da NF.')
      return
    }
    if (!codigo.trim()) {
      setError('Informe o código do item.')
      return
    }
    if (!descricao.trim()) {
      setError('Informe a descrição do item.')
      return
    }
    if (!(qty > 0)) {
      setError('Informe uma quantidade válida.')
      return
    }

    onConfirm({ kind: 'new', input })
  }

  const alocarEndereco = addressId != null

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal manual-nf-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-nf-title"
      >
        <header className="modal-header">
          <div>
            <h2 id="manual-nf-title">
              {alocarEndereco ? 'Alocar endereço manualmente' : 'Cadastrar NF manual'}
            </h2>
            <p className="muted manual-nf-sub">
              {alocarEndereco
                ? 'Informe a nota fiscal e o item que ficará nesta posição.'
                : 'Cadastre a nota e o item sem XML — depois aloque nos endereços no painel.'}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>

        {alocarEndereco && (
          <section className="manual-nf-address">
            <span className="manual-nf-address-label">Endereço</span>
            <strong>{formatAddressLabel(addressId)}</strong>
          </section>
        )}

        <section className="modal-section modal-section--first">
          <h3>Nota fiscal</h3>
          <div className="saida-busca">
            <input
              type="text"
              className="input-nf"
              placeholder="Número da NF"
              value={numero}
              onChange={(e) => {
                setNumero(e.target.value)
                setSearched(undefined)
                setShowCreate(false)
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
            />
            <button type="button" className="btn primary" onClick={handleBuscar}>
              Registrar
            </button>
          </div>
        </section>

        {searched && !showCreate && (
          <section className="modal-section">
            <h3>Item neste endereço</h3>
            <p className="muted">
              NF {searched.numero}
              {searched.emitente ? ` · ${searched.emitente}` : ''}
            </p>
            <ul className="item-list manual-nf-item-list">
              {searched.items.map((item) => (
                <li key={item.index}>
                  <button
                    type="button"
                    className={`item-row ${selectedItemIndex === item.index ? 'item-row--active' : ''}`}
                    onClick={() => setSelectedItemIndex(item.index)}
                  >
                    <span className="item-check">{selectedItemIndex === item.index ? '●' : '○'}</span>
                    <span className="item-text">
                      <strong>{item.codigo}</strong>
                      <span>{item.descricao}</span>
                      <span className="muted">
                        {item.quantidade} {item.unidade} · {item.allocatedAddresses.length} end.
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreate(true)}>
              NF não encontrada? Cadastrar manualmente
            </button>
          </section>
        )}

        {(showCreate || (searched === null && searched !== undefined)) && (
          <section className="modal-section">
            <h3>{searched === null ? 'Cadastrar NF manual' : 'Nova NF manual'}</h3>
            {searched === null && (
              <p className="muted">NF {numero.trim()} não está no sistema. Preencha os dados abaixo.</p>
            )}
            <div className="manual-nf-form">
              <label className="manual-nf-field">
                <span>Série</span>
                <input type="text" className="input-nf" value={serie} onChange={(e) => setSerie(e.target.value)} />
              </label>
              <label className="manual-nf-field manual-nf-field--wide">
                <span>Emitente</span>
                <input
                  type="text"
                  className="input-nf"
                  list={emitentesListId}
                  value={emitente}
                  onChange={(e) => setEmitente(e.target.value)}
                  placeholder="Opcional"
                  autoComplete="off"
                />
                {emitentesSugeridos.length > 0 && (
                  <datalist id={emitentesListId}>
                    {emitentesSugeridos.map((nome) => (
                      <option key={nome} value={nome} />
                    ))}
                  </datalist>
                )}
              </label>
              <label className="manual-nf-field">
                <span>Código do item</span>
                <input type="text" className="input-nf" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
              </label>
              <label className="manual-nf-field manual-nf-field--wide">
                <span>Descrição</span>
                <input
                  type="text"
                  className="input-nf"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </label>
              <label className="manual-nf-field">
                <span>Quantidade</span>
                <input
                  type="text"
                  className="input-nf"
                  inputMode="decimal"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                />
              </label>
              <label className="manual-nf-field">
                <span>Unidade</span>
                <input type="text" className="input-nf" value={unidade} onChange={(e) => setUnidade(e.target.value)} />
              </label>
            </div>
            {searched && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>
                Voltar para NF existente
              </button>
            )}
          </section>
        )}

        {error && <p className="error manual-nf-error">{error}</p>}
        {serverError && !error && <p className="error manual-nf-error">{serverError}</p>}

        <div className="manual-nf-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn primary" onClick={handleConfirm}>
            {alocarEndereco ? 'Confirmar alocação' : 'Cadastrar NF'}
          </button>
        </div>
      </div>
    </div>
  )
}
