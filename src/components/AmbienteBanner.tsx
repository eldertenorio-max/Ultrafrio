import { getAmbienteDeploy } from '../lib/appAmbiente'

export function AmbienteBanner() {
  const ambiente = getAmbienteDeploy()

  if (ambiente === 'homolog') {
    return (
      <div className="ambiente-banner ambiente-banner--homolog" role="status" aria-live="polite">
        <strong>Homologação</strong>
        <span>Ambiente de validação — use para testar antes de publicar no WMS oficial.</span>
      </div>
    )
  }

  if (ambiente === 'producao') {
    return (
      <div className="ambiente-banner ambiente-banner--producao" role="status" aria-live="polite">
        <strong>Produção</strong>
        <span>Ambiente oficial — dados operacionais em uso pela equipe.</span>
      </div>
    )
  }

  return null
}
