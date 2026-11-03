import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.colorstack3d.game',
  appName: 'Color Stack 3D',
  webDir: 'dist',
  backgroundColor: '#131629',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
};

export default config;
