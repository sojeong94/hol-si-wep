// GA4 이벤트 트래킹 유틸
export function track(eventName: string, params?: Record<string, string | number | boolean>) {
  ;(window as any).gtag?.('event', eventName, params)
}
