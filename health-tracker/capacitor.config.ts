import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'id.jejaksehat.app',
  appName: 'Jejak Sehat',
  webDir: 'dist',
  android: { allowMixedContent: false },
  plugins: {
    SystemBars: { style: 'DARK', initialViewportFitValueHint: 'cover' },
    LocalNotifications: { smallIcon: 'ic_stat_notify', iconColor: '#2f6b4f' },
  },
};

export default config;
