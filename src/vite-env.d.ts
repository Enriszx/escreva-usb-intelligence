/// <reference types="vite/client" />
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** SHA-256 de "usbi|senha" para a tela de senha. Vazio = sem senha. */
  readonly VITE_PASS_HASH?: string;
}
