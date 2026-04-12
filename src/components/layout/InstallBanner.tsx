import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { X, Share, PlusSquare, Download } from 'lucide-react'

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showAndroidBanner, setShowAndroidBanner] = useState(false)
  const [showIosBanner, setShowIosBanner] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // 이미 설치되었거나, 닫은 적 있으면 무시
    if (localStorage.getItem('holsi-install-dismissed') === 'true') return
    
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in window.navigator && (window.navigator as any).standalone)
    if (isStandalone) return

    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase())

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowAndroidBanner(true)
      setIsVisible(true)
    }

    if (isIos) {
      // iOS는 prompt 이벤트가 없으므로 무조건 노출
      setTimeout(() => {
        setShowIosBanner(true)
        setIsVisible(true)
      }, 2000) // 진입 2초 뒤에 스르륵 띄움
    } else {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  // gtag는 항상 최신 참조로 (로드 타이밍 문제 방지)
  const fireEvent = (name: string, params?: object) => {
    ;(window as any).gtag?.('event', name, { event_category: 'PWA', ...params })
  }

  const handleDismiss = () => {
    localStorage.setItem('holsi-install-dismissed', 'true')
    setIsVisible(false)
    fireEvent('install_banner_dismissed')
  }

  const handleInstallClick = async () => {
    fireEvent('install_button_click')
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setIsVisible(false)
      fireEvent('install_accepted', { event_label: 'conversion' })
    } else {
      fireEvent('install_rejected')
    }
    setDeferredPrompt(null)
  }

  // 배너 노출 시 이벤트 (Android/iOS 공통)
  useEffect(() => {
    if (isVisible) {
      const platform = showIosBanner ? 'ios' : 'android'
      fireEvent('install_banner_shown', { event_label: platform })
    }
  }, [isVisible])

  if (!isVisible) return null

  return (
    <div className="fixed bottom-[84px] left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] z-50 animate-in slide-in-from-bottom-5 fade-in duration-500">
      <Card className="p-4 bg-white/95 backdrop-blur-xl border border-[var(--color-primary)]/40 shadow-2xl flex items-start gap-4 relative overflow-hidden">
        <button onClick={handleDismiss} className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-600 bg-gray-100/50 rounded-full transition-colors z-10 active:scale-95">
          <X size={14} strokeWidth={3} />
        </button>
        
        <div className="w-11 h-11 bg-gradient-to-br from-[var(--color-primary)] to-orange-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner mt-0.5 border border-white/20">
          <Download size={20} className="text-white drop-shadow-sm" />
        </div>
        
        <div className="flex-1 pr-5 relative z-0">
          <h4 className="font-bold text-[var(--color-navy)] mb-1 text-sm tracking-tight">홀시 앱 다운로드</h4>
          
          {showAndroidBanner && (
            <>
              <p className="text-xs text-gray-500 font-medium leading-relaxed mb-3 tracking-tighter">
                바탕화면에 설치해두고<br/>더욱 편하게 주기를 관리하세요!
              </p>
              <button 
                onClick={handleInstallClick} 
                className="w-full bg-[var(--color-navy)] hover:bg-gray-800 text-white text-xs font-bold py-2.5 rounded-xl transition-all active:scale-95 shadow-md flex justify-center items-center"
              >
                네, 바로 설치할게요
              </button>
            </>
          )}

          {showIosBanner && (
            <div className="mt-1.5 space-y-2">
              <p className="text-[11px] text-gray-500 font-medium leading-relaxed bg-gray-50 p-2.5 rounded-xl border border-gray-100/50 shadow-inner tracking-tight">
                하단의 <Share size={12} className="inline mx-0.5 text-blue-500"/> <span className="text-blue-500 font-bold">공유 버튼</span>을 누르고<br/>
                <PlusSquare size={12} className="inline mx-0.5 text-gray-700"/> <span className="font-bold text-gray-700">홈 화면에 추가</span>를 선택하세요!
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
