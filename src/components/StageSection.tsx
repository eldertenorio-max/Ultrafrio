import { contarItensStage, STAGE_AREA_ID, STAGE_LABEL } from '../layout/stage'
import type { NotaFiscal } from '../types'

type Props = {
  notas: NotaFiscal[]
  highlighted?: boolean
  onOpen: () => void
}

export function StageSection({ notas, highlighted, onOpen }: Props) {
  const total = contarItensStage(notas)

  return (
    <section className={`stage-section${highlighted ? ' stage-section--highlight' : ''}`}>
      <div className="stage-section-head">
        <h2 className="camara-title">{STAGE_LABEL}</h2>
        <p className="muted stage-section-hint">Área de separação · armazenamento ilimitado</p>
      </div>
      <button
        type="button"
        className="stage-area-cell"
        data-address-id={STAGE_AREA_ID}
        onClick={onOpen}
        aria-label={`Abrir stage com ${total} item(ns)`}
      >
        <span className="stage-area-label">STAGE</span>
        <span className="stage-area-count">
          {total} item{total === 1 ? '' : 's'}
        </span>
        <span className="stage-area-hint">Clique para ver o conteúdo</span>
      </button>
    </section>
  )
}
