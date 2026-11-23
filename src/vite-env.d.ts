/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The accounts and leaderboard API (set by scripts/deploy.mjs at build time). Without it, accounts stay in this browser. */
  readonly VITE_API_URL?: string
}
interface ImportMeta { readonly env: ImportMetaEnv }
