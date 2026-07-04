/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** homolog | producao — define banner e título do ambiente */
  readonly VITE_APP_AMBIENTE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
