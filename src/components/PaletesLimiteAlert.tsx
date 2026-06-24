import { useBodyScrollLock } from '../hooks/useBodyScrollLock'

type Props = {
  kind: 'sem_paletes' | 'maximo' | 'incompleto'
  onClose: () => void
}

export function PaletesLimiteAlert({ kind, onClose }: Props) {
  useBodyScrollLock(true)

  const title =
    kind === 'sem_paletes'
      ? 'Informe os paletes'
      : kind === 'incompleto'
        ? 'Endereços incompletos'
        : 'Limite de endereços'
  const message =
    kind === 'sem_paletes'
      ? 'Informe a quantidade de paletes do item antes de selecionar endereços no painel.'
      : kind === 'incompleto'
        ? 'Selecione todos os endereços correspondentes aos paletes do item antes de confirmar.'
        : 'Você atingiu o limite máximo de endereços para este item.'

  return (
    <div className="alert-backdrop" onClick={onClose} role="presentation">
      <div
        className="alert-box"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="paletes-limite-title"
      >
        <h2 id="paletes-limite-title">{title}</h2>
        <p>{message}</p>
        <button type="button" className="btn primary full" onClick={onClose}>
          Entendi
        </button>
      </div>
    </div>
  )
}
