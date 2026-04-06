import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.papera.app',
  appName: 'Papera',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Papera',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: '#0f172a',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
    },
  },
  server: {
    iosScheme: 'capacitor',
    allowNavigation: ['veracious-pony-145.convex.site'],
  },
};

export default config;
