import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.holsi.app',
  appName: 'Holsi',
  webDir: 'dist',
  // 앱에서 hol-si.com 서버에 API 요청 — 로컬 번들 + 서버 통신
  server: {
    url: 'https://hol-si.com',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#000000',
    preferredContentMode: 'mobile',
    scrollEnabled: true,
  },
}

export default config
