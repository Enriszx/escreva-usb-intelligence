import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.usbintelligence.app',
  appName: 'USB Intelligence',
  webDir: 'dist',
  android: {
    // O conteúdo vem empacotado no APK: funciona sem internet desde o primeiro uso.
    allowMixedContent: false,
  },
};

export default config;
