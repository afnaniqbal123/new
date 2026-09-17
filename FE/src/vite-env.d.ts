/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ENABLE_MOCKS?: string;
  readonly VITE_E2E?: string;
  readonly VITE_DEMO_EMAIL_PATTERN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
