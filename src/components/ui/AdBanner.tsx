import { useEffect, useRef } from 'react'

interface AdBannerProps {
  slot: string        // AdSense 광고 슬롯 ID (예: "1234567890")
  format?: 'auto' | 'rectangle' | 'horizontal'
  className?: string
}

/** Google AdSense 배너
 *  사용법:
 *  1. index.html의 AdSense script 주석 해제 후 ca-pub-XXXXXXXXXX를 본인 ID로 교체
 *  2. <AdBanner slot="발급받은 슬롯ID" /> 로 삽입
 */
export function AdBanner({ slot, format = 'auto', className = '' }: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    try {
      // @ts-ignore
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {}
  }, [])

  // AdSense가 활성화되지 않은 개발 환경에서는 회색 플레이스홀더 표시
  const isAdSenseEnabled = !!import.meta.env.VITE_ADSENSE_ID

  if (!isAdSenseEnabled) {
    return (
      <div className={`flex items-center justify-center bg-zinc-900/50 border border-dashed border-zinc-800 rounded-xl text-zinc-600 text-xs font-medium h-14 ${className}`}>
        광고 영역 (AdSense 연동 후 활성화)
      </div>
    )
  }

  return (
    <ins
      ref={adRef}
      className={`adsbygoogle block ${className}`}
      style={{ display: 'block' }}
      data-ad-client={`ca-pub-${import.meta.env.VITE_ADSENSE_ID}`}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  )
}
