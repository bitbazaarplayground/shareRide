/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_STRIPE_BACKEND: string;
  readonly VITE_MAPS_KEY: string;
  // Add any other frontend-exposed variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
