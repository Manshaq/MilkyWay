import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.milkyway.app',
  appName: 'MilkyWay',
  webDir: 'dist',
  server: {
    // This allows the native app to connect to your live backend during development
    // In production, your React app will talk to your deployed API URL
    androidScheme: 'https'
  }
};

export default config;
