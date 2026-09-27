/// <reference types="vite/client" />

/** Conta do login automático do servidor de dev (vite.config.ts); `null` em builds. */
declare const __DEV_AUTH__: { email: string; password: string } | null;
