import { BrowserRouter, Routes, Route, useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { format } from 'date-fns'
import { usePillStore } from '@/store/usePillStore'
import { useSettingStore } from '@/store/useSettingStore'
import { useAuthStore } from '@/store/useAuthStore'
import { BottomNav } from '@/components/layout/BottomNav'
import { syncPillsToServer } from '@/lib/pushService'

import { Home } from '@/pages/Home'
import { CalendarPage } from '@/pages/Calendar'
import { Pills } from '@/pages/Pills'
import { MyPage } from '@/pages/MyPage'
import { Admin } from '@/pages/Admin'
import Privacy from '@/pages/Privacy'
import { AlarmRingingModal } from '@/components/ui/AlarmRingingModal'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

// 탭 전환 시 스크롤 상단으로 초기화
function ScrollReset() {
  const { pathname } = useLocation()
  useEffect(() => {
    const el = document.getElementById('scroll-container')
    if (el) el.scrollTop = 0
  }, [pathname])
  return null
}

// OAuth 콜백 처리: /mypage?token=xxx
function AuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  useEffect(() => {
    const token = params.get('token')
    if (!token) return
    // 토큰으로 사용자 정보 조회
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(user => {
        setAuth(token, user)
        navigate('/mypage', { replace: true })
      })
      .catch(() => navigate('/mypage', { replace: true }))
  }, [])

  return null
}

function App() {
  const { pills, setTriggerAlarm } = usePillStore()
  const { pushEnabled } = useSettingStore()

  // 앱 실행 모드 추적 (GA4)
  useEffect(() => {
    const gtag = (window as any).gtag
    if (!gtag) return
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in navigator && (navigator as any).standalone)
    // 홈화면에서 실행 = PWA 설치 완료 상태
    gtag('event', 'app_launch', {
      event_category: 'PWA',
      event_label: isStandalone ? 'standalone' : 'browser',
    })
    if (isStandalone) {
      gtag('event', 'app_launch_standalone', { event_category: 'PWA' })
    }
  }, [])

  // 영양제 변경 시 서버 자동 동기화 (push 활성화된 경우에만)
  useEffect(() => {
    if (pushEnabled && Notification.permission === 'granted') {
      syncPillsToServer(pills)
    }
  }, [pills, pushEnabled])

  useEffect(() => {
    if ('Notification' in window && pushEnabled && Notification.permission === 'default') {
      try {
        const promise = Notification.requestPermission()
        if (promise) promise.then().catch(() => {})
      } catch (e) {
        // fallback for older Safari
      }
    }

    let lastCheckedMinute = ''

    const interval = setInterval(() => {
      const now = new Date()
      const minuteStr = format(now, 'yyyy-MM-dd HH:mm')
      const timeString = format(now, 'HH:mm')
      const currentDay = now.getDay() // 0 is Sunday, 6 is Saturday
      
      if (minuteStr !== lastCheckedMinute) {
        lastCheckedMinute = minuteStr
        
        const duePills = pills.filter(p => {
          if (p.isActive === false) return false
          if (p.time !== timeString) return false
          if (p.days && !p.days.includes(currentDay)) return false
          return true
        })

        // 앱이 열려있을 때는 in-app 모달 + 오디오 알람만 트리거.
        // OS 알림은 서버 Web Push 가 담당 (앱 닫혀있을 때도 동작).
        // 양쪽에서 동시에 OS 알림을 띄우면 이중 발송이라 여기서는 Notification API 호출 안함.
        duePills.forEach(pill => setTriggerAlarm(pill.id))
      }
    }, 1000) // 백그라운드 스로틀링 등에 대비해 체크 주기를 1초로 강화 

    return () => clearInterval(interval)
  }, [pills, pushEnabled])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        {/* 글래스모피즘 분위기의 동적 메시 배경 — fixed로 전체 화면 차지 */}
        <div className="fixed inset-0 w-full overflow-hidden bg-gradient-to-br from-orange-50/50 via-rose-50/50 to-orange-100/50">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-pink-300/20 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[50%] bg-orange-300/20 rounded-full blur-[120px] pointer-events-none"></div>

          {/* iOS safe area + CSS scroll 컨테이너 */}
          <div
            id="scroll-container"
            className="max-w-md mx-auto h-full relative"
            style={{
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <BottomNav />
            <AlarmRingingModal />
            <AuthCallback />
            <ScrollReset />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/pills" element={<Pills />} />
              <Route path="/mypage" element={<MyPage />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route
                path="*"
                element={
                  <div className="p-8 text-center text-zinc-400">
                    <p className="text-lg font-bold text-zinc-100 mb-2">페이지를 찾지 못했어요</p>
                    <p className="text-sm">상단 메뉴에서 다시 선택해주세요.</p>
                  </div>
                }
              />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
