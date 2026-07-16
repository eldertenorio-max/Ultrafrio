import { PortalBackButton } from '../components/PortalBackButton'
import { SystemProductMark } from '../components/SystemProductMark'
import { getHubSystemOptions, type SystemId } from '../lib/systemPortal'
import './SystemSelectorScreen.css'

type Props = {
  onSelect: (id: SystemId) => void
  usuario?: string
  onSair?: () => void
  /** Volta ao login do portal (tela anterior ao hub). */
  onVoltar?: () => void
  erro?: string | null
  busy?: boolean
}

export default function SystemSelectorScreen({
  onSelect,
  usuario,
  onSair,
  onVoltar,
  erro,
  busy,
}: Props) {
  const systems = getHubSystemOptions()

  return (
    <div className="system-selector" role="main">
      {onVoltar ? (
        <PortalBackButton onClick={onVoltar} label="Voltar" />
      ) : null}
      <div className="system-selector__inner">
        <header className="system-selector__header">
          <h1 className="system-selector__title">Escolha o sistema</h1>
          <p className="system-selector__subtitle">
            {usuario
              ? `Olá, ${usuario} — selecione Light, Plus ou Pro`
              : 'Selecione Light, Plus ou Pro'}
          </p>
          {onSair ? (
            <button type="button" className="system-selector__sair" onClick={onSair}>
              Sair
            </button>
          ) : null}
        </header>

        {erro ? (
          <p className="system-selector__erro" role="alert">
            {erro}
          </p>
        ) : null}

        <div className="system-selector__grid">
          {systems.map((system) => (
            <button
              key={system.id}
              type="button"
              className="system-selector__card"
              disabled={busy}
              onClick={() => onSelect(system.id)}
            >
              <SystemProductMark
                variant={system.variant}
                productName={system.productName}
                logoSrc={system.logoSrc}
                logoOnly={system.logoOnly}
                compact
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
