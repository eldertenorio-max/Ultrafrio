import { useState, type ChangeEvent, type MouseEvent } from 'react'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import type { EntradaItemCampos } from '../lib/entradaCampos'
import type { NotaFiscal } from '../types'
import { itemEnderecamentoCompleto } from '../lib/paletes'
import { NfItensTable } from './NfItensTable'
import { NfResumoGrid } from './NfResumoGrid'

type Props = {
  notas: NotaFiscal[]
  activeNfId: string | null
  selectedNfIds: string[]
  activeItemIndex: number | null
  pendingCount: number
  onUpload: (files: File[]) => void | Promise<void>
  onCadastrarManual: () => void
  onSelectNf: (id: string, event?: MouseEvent) => void
  onSelectItem: (index: number) => void
  onUpdateItemCampos: (itemIndex: number, patch: EntradaItemCampos) => void
  onUpdateItemQuantidade: (itemIndex: number, quantidade: string) => void
  onUpdateItemPaletes: (itemIndex: number, paletes: string) => void
  onDesmembrarItem: (itemIndex: number) => void
  paletesRestantes: number | null
  onConfirmItem: () => void
  onFinishEntrada: () => void
  onCancelarEntrada: (nfId: string) => void
  onLimparSelecao: () => void
  uploadError: string | null
}

export function EntradaPanel({
  notas,
  activeNfId,
  selectedNfIds,
  activeItemIndex,
  pendingCount,
  onUpload,
  onCadastrarManual,
  onSelectNf,
  onSelectItem,
  onUpdateItemCampos,
  onUpdateItemQuantidade,
  onUpdateItemPaletes,
  onDesmembrarItem,
  paletesRestantes,
  onConfirmItem,
  onFinishEntrada,
  onCancelarEntrada,
  onLimparSelecao,
  uploadError,
}: Props) {
  const [confirmarCancelar, setConfirmarCancelar] = useState<string | null>(null)
  useBodyScrollLock(confirmarCancelar !== null)
  const emAndamento = notas.filter((n) => n.status === 'em_andamento')
  const selectedSet = new Set(selectedNfIds)
  const activeNf = notas.find((n) => n.id === activeNfId) ?? null

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : []
    if (files.length > 0) void onUpload(files)
    e.target.value = ''
  }

  return (
    <>
      <div className="sidebar-block">
        <label className="upload-btn">
          <input
            type="file"
            accept=".xml,text/xml,application/xml"
            multiple
            hidden
            onChange={handleFile}
          />
          Subir XML da NF-e (entrada)
        </label>
        <p className="muted entrada-upload-hint">Selecione um ou vários XMLs. NFs repetidas são ignoradas.</p>

        <button type="button" className="upload-btn upload-btn--muted" onClick={onCadastrarManual}>
          Cadastrar NF manual
        </button>
        {uploadError && <p className="error">{uploadError}</p>}
      </div>

      {emAndamento.length > 0 && (
        <div className="sidebar-block">
          <h3>Entradas em andamento</h3>
          <p className="muted nf-list-hint">Ctrl+clique para selecionar várias · Shift+clique para intervalo</p>
          <ul className="nf-list">
            {emAndamento.map((nf) => {
              const pendentes = nf.items.filter((it) => !itemEnderecamentoCompleto(it)).length
              const isSelected = selectedSet.has(nf.id)
              const isActive = nf.id === activeNfId
              return (
              <li key={nf.id}>
                <button
                  type="button"
                  className={`nf-chip${isSelected ? ' nf-chip--selected' : ''}${isActive ? ' nf-chip--active' : ''}`}
                  onClick={(e) => onSelectNf(nf.id, e)}
                >
                  <strong>NF {nf.numero}</strong>
                  <span className="nf-chip-meta">
                    {nf.items.length} item(ns)
                    {pendentes > 0 ? ` · ${pendentes} pendente(s)` : ' · endereçada'}
                  </span>
                  {isActive && selectedSet.size > 1 && (
                    <span className="nf-chip-focus">Em edição</span>
                  )}
                  <span className="nf-chip-hint">{isActive ? 'Trabalhando nesta NF' : 'Ver nota e itens'}</span>
                </button>
              </li>
              )
            })}
          </ul>
          {selectedSet.size > 1 && (
            <p className="nf-multi-count">{selectedSet.size} notas selecionadas</p>
          )}
        </div>
      )}

      {activeNf && activeNf.status === 'em_andamento' && (
        <>
          <div className="sidebar-block nf-leitura-panel">
            <h3 className="nf-section-title">Nota fiscal</h3>
            <div className="nf-leitura-card">
              <div className="nf-detail-head">
                <h4 className="nf-leitura-numero">NF {activeNf.numero}</h4>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setConfirmarCancelar(activeNf.id)}
                >
                  Cancelar entrada
                </button>
              </div>
              {activeNf.nfCanceladaOrigemNumero && (
                <p className="vinculo-entrada-badge">
                  Substitui NF cancelada <strong>{activeNf.nfCanceladaOrigemNumero}</strong>
                </p>
              )}
              <dl className="meta-list meta-list--nf">
                <div><dt>Emitente</dt><dd>{activeNf.emitente || '—'}</dd></div>
                <div><dt>Emissão</dt><dd>{formatDate(activeNf.dataEmissao)}</dd></div>
                {activeNf.serie && (
                  <div><dt>Série</dt><dd>{activeNf.serie}</dd></div>
                )}
              </dl>
              <p className="nf-leitura-subtitle">Totais do documento</p>
              <NfResumoGrid nf={activeNf} />
            </div>
          </div>

          <div className="sidebar-block nf-itens-panel">
            <h3 className="nf-section-title">Itens da nota</h3>
            <p className="muted nf-itens-intro">
              Informe os <strong>paletes</strong> do item — cada palete corresponde a um endereço no
              painel. Preencha UP, lote, datas e quantidade abaixo. Use <strong>Desmembrar</strong>{' '}
              quando o mesmo produto vier com mais de uma data.
            </p>
            <NfItensTable
              items={activeNf.items}
              activeItemIndex={activeItemIndex}
              onSelectItem={onSelectItem}
              onUpdateItemCampos={onUpdateItemCampos}
              onUpdateItemQuantidade={onUpdateItemQuantidade}
              onUpdateItemPaletes={onUpdateItemPaletes}
              onDesmembrarItem={onDesmembrarItem}
              canEdit={activeNf.status === 'em_andamento'}
            />

          {activeItemIndex != null && (
            <div className="item-actions">
              {paletesRestantes != null && (
                <p className="item-paletes-counter">
                  {paletesRestantes}{' '}
                  {paletesRestantes === 1 ? 'palete a endereçar' : 'paletes a endereçar'}
                </p>
              )}
              <p className="muted">{pendingCount} endereço(s) selecionado(s)</p>
              <div className="item-actions-row">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onLimparSelecao}
                  disabled={pendingCount === 0}
                >
                  Limpar tudo
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={onConfirmItem}
                  disabled={
                    pendingCount === 0 ||
                    (paletesRestantes != null && paletesRestantes > 0)
                  }
                >
                  Confirmar endereços do item
                </button>
              </div>
            </div>
          )}

          {activeNf && activeNf.status === 'em_andamento' && (
            <button type="button" className="btn success full" onClick={onFinishEntrada}>
              Finalizar entrada — NF {activeNf.numero}
            </button>
          )}
          </div>
        </>
      )}

      {confirmarCancelar && (() => {
        const nf = notas.find((n) => n.id === confirmarCancelar)
        if (!nf) return null
        return (
          <div className="confirm-backdrop" onClick={() => setConfirmarCancelar(null)}>
            <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
              <h4>Cancelar entrada?</h4>
              <p>
                NF <strong>{nf.numero}</strong>
              </p>
              <p className="confirm-warn">
                A nota será removida, as posições marcadas serão liberadas e o registro de entrada será excluído do histórico.
              </p>
              <div className="confirm-actions">
                <button type="button" className="btn" onClick={() => setConfirmarCancelar(null)}>
                  Voltar
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    onCancelarEntrada(nf.id)
                    setConfirmarCancelar(null)
                  }}
                >
                  Cancelar entrada
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}

function formatDate(raw: string): string {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10)
  return d.toLocaleString('pt-BR')
}
