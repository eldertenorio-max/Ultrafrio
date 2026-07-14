export type SystemId = 'light' | 'plus' | 'pro' | 'original'

export type SystemOption = {
  id: SystemId
  variant: string
  productName?: string
  logoSrc: string
  logoOnly?: boolean
  /** null = permanece neste app (WMS Plus) */
  url: string | null
}

export const CURRENT_SYSTEM_ID: SystemId = 'plus'

const PRODUCTION_URLS = {
  light: 'https://doca-livre-wms-light.onrender.com/',
  pro: 'https://doca-livre-wms-pro.onrender.com/',
  original: 'https://sistema.docalivre.com.br/login',
} as const

function envUrl(key: string): string | undefined {
  const value = import.meta.env[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** Hub pós-login do portal único (só Light / Plus / Pro). */
export function getHubSystemOptions(): SystemOption[] {
  return [
    {
      id: 'light',
      variant: 'Light',
      productName: 'WMS',
      logoSrc: '/systems/logo-wms-light.png',
      url: envUrl('VITE_WMS_LIGHT_URL') ?? PRODUCTION_URLS.light,
    },
    {
      id: 'plus',
      variant: 'Plus',
      productName: 'WMS',
      logoSrc: '/systems/logo-wms-plus.png',
      url: null,
    },
    {
      id: 'pro',
      variant: 'Pro',
      productName: 'WMS',
      logoSrc: '/systems/logo-wms-pro.png',
      url: envUrl('VITE_WMS_PRO_URL') ?? PRODUCTION_URLS.pro,
    },
  ]
}

export function getSystemOptions(): SystemOption[] {
  return getHubSystemOptions()
}

export function getSystemById(id: SystemId): SystemOption | undefined {
  return getSystemOptions().find((s) => s.id === id)
}
