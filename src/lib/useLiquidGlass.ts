import { useEffect } from 'react'

export function useLiquidGlass() {
  useEffect(() => {
    const apply = (beta: number, gamma: number) => {
      // beta: 앞뒤 기울기 (-180~180), gamma: 좌우 기울기 (-90~90)
      const x = Math.max(-30, Math.min(30, gamma)) / 30  // -1 ~ 1
      const y = Math.max(-30, Math.min(30, beta - 45)) / 30  // -1 ~ 1 (자연스러운 파지 각도 보정)

      const el = document.documentElement
      el.style.setProperty('--glass-x', String(x))
      el.style.setProperty('--glass-y', String(y))
      // 빛 반사 각도 (deg)
      const angle = Math.atan2(y, x) * (180 / Math.PI) + 135
      el.style.setProperty('--glass-angle', `${angle}deg`)
      // 기울기 강도 (0~1)
      const intensity = Math.min(1, Math.sqrt(x * x + y * y))
      el.style.setProperty('--glass-intensity', String(intensity))
    }

    const handler = (e: DeviceOrientationEvent) => {
      apply(e.beta ?? 0, e.gamma ?? 0)
    }

    // iOS 13+는 권한 요청 필요
    const DevOrient = DeviceOrientationEvent as any
    if (typeof DevOrient.requestPermission === 'function') {
      // 권한은 사용자 제스처(버튼 클릭 등)에서만 요청 가능 — 이미 granted라면 바로 등록
      DevOrient.requestPermission()
        .then((perm: string) => {
          if (perm === 'granted') window.addEventListener('deviceorientation', handler, true)
        })
        .catch(() => {})
    } else {
      window.addEventListener('deviceorientation', handler, true)
    }

    return () => window.removeEventListener('deviceorientation', handler, true)
  }, [])
}
