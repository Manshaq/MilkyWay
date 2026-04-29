/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_APP_URL?: string;
  readonly VITE_PAYSTACK_PUBLIC_KEY?: string;
  readonly VITE_FIREBASE_DB_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
