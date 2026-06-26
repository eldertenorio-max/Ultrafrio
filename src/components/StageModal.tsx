import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { STAGE_LABEL, type StageItemRef } from '../layout/stage'
import { formatQuantidadeNfe } from '../lib/formatNfeItem'

type Props = {
  itens: StageItemRef[]
  onClose: () => void
}

export function StageModal({ itens, onClose }: Props) {
  useBodyScrollLock(true)

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal stage-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="stage-modal-head">
          <div>
            <h2>{STAGE_LABEL}</h2>
            <p className="muted">
              {itens.length} item(ns) em separação — capacidade ilimitada
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>
        {itens.length === 0 ? (
          <p className="muted stage-modal-empty">Nenhum item no stage no momento.</p>
        ) : (
          <ul className="stage-modal-list">
            {itens.map((it) => (
              <li key={`${it.nfId}-${it.itemIndex}`} className="stage-modal-item">
                <div className="stage-modal-item-head">
                  <strong>NF {it.nfNumero}</strong>
                  <span className="muted">{it.emitente}</span>
                </div>
                <p className="stage-modal-item-prod">
                  <span className="stage-modal-cod">{it.codigo}</span>
                  <span>{it.descricao}</span>
                </p>
                <p className="muted stage-modal-item-meta">
                  {formatQuantidadeNfe(it.quantidade)} {it.unidade}
                  {it.lote && <> · lote {it.lote}</>}
                  {it.up && <> · UP {it.up}</>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
