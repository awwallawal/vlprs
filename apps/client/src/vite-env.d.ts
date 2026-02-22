/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_RECAPTCHA_SITE_KEY: string;
  readonly VITE_SPRINT_LABEL: string;
  readonly VITE_NEXT_MILESTONE: string;
  readonly VITE_DEPLOY_TIMESTAMP: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
