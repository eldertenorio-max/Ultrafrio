export type AppAmbiente = 'producao' | 'homolog'

const HOSTS_HOMOLOG = ['ultrafrio.onrender.com']

function normalizarAmbiente(value: string | undefined): AppAmbiente | null {
  const v = value?.trim().toLowerCase()
  if (!v) return null
  if (v === 'homolog' || v === 'homologacao' || v === 'staging') return 'homolog'
  if (v === 'producao' || v === 'production' || v === 'prod') return 'producao'
  return null
}

/** Ambiente definido no build (VITE_APP_AMBIENTE) ou inferido pelo domínio. */
export function getAppAmbiente(): AppAmbiente {
  const fromEnv = normalizarAmbiente(import.meta.env.VITE_APP_AMBIENTE)
  if (fromEnv) return fromEnv

  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (HOSTS_HOMOLOG.some((h) => host === h || host.endsWith(`.${h}`))) {
      return 'homolog'
    }
  }

  return 'producao'
}

export function isHomologacao(): boolean {
  return getAppAmbiente() === 'homolog'
}

export function tituloApp(): string {
  return isHomologacao() ? 'Doca Livre WMS — Homologação' : 'Doca Livre WMS'
}
