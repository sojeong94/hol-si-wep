import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingStore } from '@/store/useSettingStore'
import { useRecordStore } from '@/store/useRecordStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useSubscriptionStore } from '@/store/useSubscriptionStore'
import { getAverageCycle, getAveragePeriodDays } from '@/utils/cycleCalculators'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { SubscriptionModal } from '@/components/ui/SubscriptionModal'
import { Bell, Download, Upload, Info, UserRound, Pencil, Users, MessageSquare, Globe, LogOut, Crown, Sparkles, Trash2 } from 'lucide-react'
import { subscribePush, unsubscribePush } from '@/lib/pushService'
import {
  requestLocalNotificationPermission,
  scheduleLocalNotifications,
  cancelLocalNotifications,
} from '@/lib/localNotificationService'
import { usePillStore } from '@/store/usePillStore'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import AppleSignIn from '@/plugins/AppleSignIn'

export function MyPage() {
  const { t, i18n } = useTranslation()
  const {
    pushEnabled, setPushEnabled,
    defaultCycle, defaultPeriodDays,
    isManualCycle, setIsManualCycle,
    manualCycleDays, setManualCycleDays,
    manualPeriodDays, setManualPeriodDays,
    userName, setUserName
  } = useSettingStore()
  const { records } = useRecordStore()
  const { pills } = usePillStore()
  const { user, logout, setAuth } = useAuthStore()
  const { isPremium, checkStatus } = useSubscriptionStore()
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  // 주기 수동 설정 — 로컬 임시값 (저장 버튼 누를 때만 반영)
  const [localCycleDays, setLocalCycleDays] = useState(manualCycleDays)
  const [localPeriodDays, setLocalPeriodDays] = useState(manualPeriodDays)
  const [cycleSaved, setCycleSaved] = useState(false)

  const handlePushToggle = async (enable: boolean) => {
    if (enable) {
      if (Capacitor.isNativePlatform()) {
        // 네이티브 앱 (Android / iOS): 로컬 알림 사용
        const granted = await requestLocalNotificationPermission()
        if (!granted) {
          alert('알림 권한이 필요해요.\n\n기기 설정 → 홀시 → 알림 → 허용 으로 변경해주세요.')
          setPushEnabled(false)
          return
        }
        const ok = await scheduleLocalNotifications(pills)
        if (ok) {
          setPushEnabled(true)
        } else {
          alert('알림 등록에 실패했어요. 잠시 후 다시 시도해주세요.')
          setPushEnabled(false)
        }
      } else {
        // 브라우저 / PWA: Web Push 사용
        const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
        const isPWA = window.matchMedia('(display-mode: standalone)').matches

        if (isIOS && !isPWA) {
          alert('iOS에서 알림을 받으려면 먼저 Safari 하단 메뉴에서\n"홈 화면에 추가"를 눌러 앱으로 설치해주세요.\n\n(iOS 16.4 이상 필요)')
          return
        }

        if (!('Notification' in window) || !('PushManager' in window)) {
          alert('이 브라우저는 푸시 알림을 지원하지 않아요.\nChrome 또는 Edge를 사용해주세요.')
          return
        }

        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          alert('알림이 차단되어 있어요.\n\n브라우저 주소창 왼쪽 자물쇠 아이콘 → 알림 → 허용 으로 변경해주세요.')
          setPushEnabled(false)
          return
        }
        const ok = await subscribePush(pills)
        if (ok) {
          setPushEnabled(true)
        } else {
          alert('알림 등록에 실패했어요. 잠시 후 다시 시도해주세요.')
          setPushEnabled(false)
        }
      }
    } else {
      if (Capacitor.isNativePlatform()) {
        await cancelLocalNotifications()
      } else {
        await unsubscribePush()
      }
      setPushEnabled(false)
    }
  }

  const [isNameModalOpen, setIsNameModalOpen] = useState(false)
  const [tempName, setTempName] = useState(userName || '')

  const avgCycle = getAverageCycle(records, defaultCycle)
  const avgPeriod = getAveragePeriodDays(records, defaultPeriodDays)

  const handleBackup = () => {
    const lsKeys = ['holsi-records-storage', 'holsi-pills-storage', 'holsi-settings-storage']
    const data: Record<string, string | null> = {}
    lsKeys.forEach(key => {
      data[key] = localStorage.getItem(key)
    })
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `holsi_backup_${new Date().getTime()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string)
        if (data['holsi-records-storage']) localStorage.setItem('holsi-records-storage', data['holsi-records-storage'])
        if (data['holsi-pills-storage']) localStorage.setItem('holsi-pills-storage', data['holsi-pills-storage'])
        if (data['holsi-settings-storage']) localStorage.setItem('holsi-settings-storage', data['holsi-settings-storage'])
        alert('데이터가 성공적으로 복구되었습니다. 앱을 새로고침합니다.')
        window.location.reload()
      } catch (err) {
        alert('올바르지 않은 백업 파일입니다.')
      }
    }
    reader.readAsText(file)
  }

  const handleSaveName = () => {
    if (tempName.trim()) {
      setUserName(tempName.trim())
      setIsNameModalOpen(false)
    }
  }

  const handleOAuthLogin = async (provider: 'google' | 'kakao') => {
    if (Capacitor.isNativePlatform()) {
      // Chrome Custom Tabs로 열기 — WebView 아니라 구글 정책 통과
      await Browser.open({ url: `https://hol-si.com/api/auth/${provider}?platform=native` })
    } else {
      window.location.href = `/api/auth/${provider}`
    }
  }

  const handleAppleLogin = async () => {
    try {
      const result = await AppleSignIn.authorize()
      const { identityToken, givenName, familyName, email } = result.response
      const res = await fetch('https://hol-si.com/api/auth/apple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identityToken, givenName, familyName, email }),
      })
      const data = await res.json()
      if (data.token) {
        const userRes = await fetch('https://hol-si.com/api/auth/me', {
          headers: { Authorization: `Bearer ${data.token}` },
        })
        const user = await userRes.json()
        setAuth(data.token, user)
      } else {
        alert('Apple 로그인에 실패했어요. 다시 시도해주세요.')
      }
    } catch (err: any) {
      // 사용자가 취소한 경우는 무시
      const msg = err?.message ?? String(err)
      if (msg.includes('cancel') || msg.includes('dismiss') || msg.includes('Cancel')) return
      alert(`Apple 로그인 오류: ${msg}`)
    }
  }

  const handleLogout = () => {
    logout()
  }

  const handleDeleteAccount = async () => {
    const token = useAuthStore.getState().token
    setIsDeleting(true)
    try {
      await fetch('/api/auth/user', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      // 서버 오류여도 로컬 로그아웃 진행
    } finally {
      setIsDeleting(false)
      setIsDeleteModalOpen(false)
      logout()
    }
  }

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang)
  }

  return (
    <div className="p-5 pb-8 space-y-6 animate-in fade-in duration-500 bg-[var(--color-secondary)] min-h-screen text-white">
      <header className="pt-2 flex items-center gap-3">
        <div className="w-12 h-12 bg-zinc-900 backdrop-blur-md rounded-full shadow-inner flex items-center justify-center border border-zinc-800">
          {user?.avatar
            ? <img src={user.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
            : <UserRound size={24} className="text-[var(--color-primary)] drop-shadow-[0_0_8px_rgba(255,42,122,0.4)]" />
          }
        </div>
        <h1 className="text-2xl font-black tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">{t('mypage_title')}</h1>
      </header>

      {/* 내 정보 (닉네임 & 소셜 연동) */}
      <section>
        <h3 className="text-sm font-extrabold text-zinc-500 mb-2 ml-1 tracking-wide">{t('mypage_info')}</h3>
        <Card className="flex flex-col gap-4 p-5 bg-zinc-900 border border-zinc-800">
           <div className="flex justify-between items-center">
             <div>
               <p className="text-xs text-zinc-400 mb-1 font-medium">{t('mypage_nickname_label')}</p>
               <p className="text-xl font-bold">{userName || t('mypage_nickname_default')} {t('mypage_nickname_suffix')}</p>
             </div>
             <button
               onClick={() => { setTempName(userName || ''); setIsNameModalOpen(true); }}
               className="p-2 bg-[#18181A] rounded-xl border border-zinc-700 text-zinc-400 hover:text-white transition-colors"
             >
               <Pencil size={18} />
             </button>
           </div>

           <div className="h-[1px] w-full bg-zinc-800 my-2"></div>

           <div>
             <p className="text-xs text-zinc-400 mb-3 font-medium">{t('mypage_account_label')}</p>
             {user ? (
               <div className="space-y-2">
                 <div className="flex items-center gap-3 bg-zinc-800 rounded-xl p-3">
                   {user.avatar && <img src={user.avatar} alt="" className="w-8 h-8 rounded-full" />}
                   <div className="flex-1 min-w-0">
                     <p className="text-xs text-zinc-400">{t('mypage_logged_in_as')}</p>
                     <p className="font-bold text-sm truncate">{user.name ?? user.email ?? user.provider}</p>
                   </div>
                   <span className={`text-xs px-2 py-1 rounded-full font-bold shrink-0 ${
                     user.provider === 'google' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'
                   }`}>{user.provider}</span>
                 </div>
                 <button
                   onClick={handleLogout}
                   className="w-full py-2.5 flex justify-center items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-xl hover:bg-zinc-700 transition-colors"
                 >
                   <LogOut size={14} className="text-zinc-400" />
                   <span className="text-sm font-bold text-zinc-300">{t('mypage_logout')}</span>
                 </button>
                 <button
                   onClick={() => setIsDeleteModalOpen(true)}
                   className="w-full py-2.5 flex justify-center items-center gap-2 bg-zinc-900 border border-red-900/50 rounded-xl hover:bg-red-950/30 transition-colors"
                 >
                   <Trash2 size={14} className="text-red-500/70" />
                   <span className="text-sm font-bold text-red-500/70">계정 삭제</span>
                 </button>
               </div>
             ) : (
               <div className="flex flex-col gap-2">
                 {Capacitor.isNativePlatform() && (
                   <button
                     onClick={handleAppleLogin}
                     className="w-full py-3 flex justify-center items-center gap-2 bg-white border border-zinc-200 rounded-xl hover:brightness-95 transition-all"
                   >
                     <svg width="16" height="16" viewBox="0 0 16 16" fill="black"><path d="M11.182 0C11.67 0 12.5.5 12.5.5s-1.182.818-1.182 2.182c0 1.5 1.318 2.136 1.318 2.136S11.5 6 9.818 6c-.68 0-1.318-.5-2.136-.5-.818 0-1.636.5-2.182.5C3.682 6 2 4.364 2 2.182 2 .818 3.182 0 4.5 0c.818 0 1.5.5 2.182.5.682 0 1.5-.5 2.318-.5H11.182zm-4 9c-2.182 0-4 1.818-4 4s1.818 3 4 3 4-1.818 4-4-1.818-3-4-3z"/></svg>
                     <span className="text-sm font-bold text-zinc-900">Apple로 로그인</span>
                   </button>
                 )}
                 <div className="flex gap-2">
                   <button
                     onClick={() => handleOAuthLogin('kakao')}
                     className="flex-1 py-3 flex justify-center items-center gap-2 bg-[#FEE500] border border-yellow-400 rounded-xl hover:brightness-95 transition-all"
                   >
                     <span className="w-4 h-4 rounded-full bg-zinc-900 block shrink-0"></span>
                     <span className="text-sm font-bold text-zinc-900">{t('mypage_kakao_login')}</span>
                   </button>
                   <button
                     onClick={() => handleOAuthLogin('google')}
                     className="flex-1 py-3 flex justify-center items-center gap-2 bg-white border border-zinc-200 rounded-xl hover:brightness-95 transition-all"
                   >
                     <span className="w-4 h-4 rounded-full bg-zinc-800 block shrink-0"></span>
                     <span className="text-sm font-bold text-zinc-800">{t('mypage_google_login')}</span>
                   </button>
                 </div>
               </div>
             )}
           </div>
        </Card>
      </section>

      {/* 구독 상태 카드 */}
      <section>
        {isPremium ? (
          <Card className="p-4 bg-gradient-to-r from-[#ff2a7a]/20 to-rose-500/10 border border-[#ff2a7a]/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#ff2a7a]/20 flex items-center justify-center">
                  <Crown size={20} className="text-[#ff2a7a]" />
                </div>
                <div>
                  <p className="text-white font-black text-sm">프리미엄 구독 중</p>
                  <p className="text-zinc-400 text-xs font-medium mt-0.5">모든 기능 무제한 이용 가능</p>
                </div>
              </div>
              <button
                onClick={() => checkStatus()}
                className="text-xs text-zinc-500 px-3 py-1.5 bg-zinc-800 rounded-xl border border-zinc-700"
              >
                갱신
              </button>
            </div>
          </Card>
        ) : (
          <Card
            className="p-4 cursor-pointer active:scale-[0.99] transition-all bg-zinc-900 border border-zinc-700 overflow-hidden relative"
            onClick={() => setShowSubscriptionModal(true)}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#ff2a7a]/5 to-transparent pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#ff2a7a]/10 border border-[#ff2a7a]/20 flex items-center justify-center">
                  <Sparkles size={20} className="text-[#ff2a7a]" />
                </div>
                <div>
                  <p className="text-white font-black text-sm">프리미엄 시작하기</p>
                  <p className="text-zinc-400 text-xs font-medium mt-0.5">7일 무료 · ₩4,900/월</p>
                </div>
              </div>
              <div className="shrink-0 px-3 py-1.5 bg-[#ff2a7a] rounded-xl">
                <span className="text-white text-xs font-black">업그레이드</span>
              </div>
            </div>
          </Card>
        )}
      </section>

      {/* 내 건강 사이클 정보 영역 */}
      <section>
        <div className="flex justify-between items-center mb-2 ml-1">
          <h3 className="text-sm font-extrabold text-zinc-500 tracking-wide">{t('mypage_cycle_title')}</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-400">{t('mypage_manual_toggle')}</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={isManualCycle} onChange={e => setIsManualCycle(e.target.checked)} />
              <div className="w-10 h-6 bg-black border border-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[16px] after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-zinc-300 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-primary)] peer-checked:border-[var(--color-primary)] shadow-inner"></div>
            </label>
          </div>
        </div>
        
        <Card className="flex flex-col p-5 bg-[#18181A] border border-zinc-800 !rounded-[var(--radius-xl)]">
          {!isManualCycle ? (
            <>
              <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                <span className="font-medium text-zinc-300">{t('mypage_avg_cycle')}</span>
                <span className="text-xl font-bold text-[var(--color-primary)] drop-shadow-[0_0_8px_rgba(255,42,122,0.4)]">{avgCycle}일</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="font-medium text-zinc-300">{t('mypage_avg_period')}</span>
                <span className="text-xl font-bold text-pink-400">{avgPeriod}일</span>
              </div>
              <p className="text-xs text-zinc-500 mt-2 bg-black/40 p-3 rounded-xl shadow-inner border border-zinc-800 font-medium">{t('mypage_cycle_help')}</p>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-zinc-300">{t('mypage_manual_cycle')}</span>
                  <span className="text-xl font-bold text-[var(--color-primary)] drop-shadow-[0_0_8px_rgba(255,42,122,0.4)]">{localCycleDays}일</span>
                </div>
                <input
                  type="range" min="15" max="40"
                  value={localCycleDays}
                  onChange={e => { setLocalCycleDays(Number(e.target.value)); setCycleSaved(false) }}
                  className="w-full accent-[var(--color-primary)]"
                />
              </div>
              <div className="pt-2 border-t border-zinc-800">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-zinc-300">{t('mypage_manual_period')}</span>
                  <span className="text-xl font-bold text-pink-400">{localPeriodDays}일</span>
                </div>
                <input
                  type="range" min="2" max="14"
                  value={localPeriodDays}
                  onChange={e => { setLocalPeriodDays(Number(e.target.value)); setCycleSaved(false) }}
                  className="w-full accent-pink-500"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setLocalCycleDays(manualCycleDays); setLocalPeriodDays(manualPeriodDays); setCycleSaved(false) }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-zinc-800 border border-zinc-700 text-zinc-400 active:scale-95 transition-all"
                >
                  되돌리기
                </button>
                <button
                  onClick={() => { setManualCycleDays(localCycleDays); setManualPeriodDays(localPeriodDays); setCycleSaved(true); setTimeout(() => setCycleSaved(false), 2000) }}
                  className={`flex-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${cycleSaved ? 'bg-zinc-700 text-zinc-300' : 'bg-[var(--color-primary)] text-white shadow-[0_0_12px_rgba(255,42,122,0.4)]'}`}
                >
                  {cycleSaved ? '저장됐어요 ✓' : '저장하기'}
                </button>
              </div>
            </div>
          )}
        </Card>
      </section>

      <section>
        <h3 className="text-sm font-extrabold text-zinc-500 mb-2 ml-1 tracking-wide">{t('mypage_control')}</h3>
        <Card className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 !rounded-[var(--radius-xl)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 shadow-inner flex items-center justify-center text-[var(--color-primary)] border border-pink-500/20">
              <Bell size={20} />
            </div>
            <div>
              <p className="font-bold text-white">{t('mypage_push_title')}</p>
              <p className="text-xs text-zinc-400 font-medium mt-0.5">{t('mypage_push_desc')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handlePushToggle(!pushEnabled)}
            className={`relative w-14 h-8 rounded-full border transition-all duration-300 shadow-inner shrink-0 ${
              pushEnabled
                ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                : 'bg-black/50 border-zinc-700'
            }`}
          >
            <span className={`absolute top-[2px] left-[2px] w-7 h-7 bg-white rounded-full shadow transition-transform duration-300 ${
              pushEnabled ? 'translate-x-6' : 'translate-x-0'
            }`} />
          </button>
        </Card>
      </section>

      <section>
        <h3 className="text-sm font-extrabold text-zinc-500 mb-2 ml-1 tracking-wide">{t('mypage_community')}</h3>
        <div className="space-y-3">
          <Card
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800 transition-colors bg-zinc-900 border border-zinc-800 !rounded-[var(--radius-xl)]"
            onClick={() => window.open('https://open.kakao.com/o/gGEIsxpi', '_blank')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-400/10 shadow-inner flex items-center justify-center text-yellow-400 border border-yellow-400/20">
                <Users size={20} />
              </div>
              <div>
                <p className="font-bold text-white">{t('mypage_chat_title')}</p>
                <p className="text-xs text-zinc-500 font-medium mt-0.5">{t('mypage_chat_desc')}</p>
              </div>
            </div>
          </Card>

          <Card
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800 transition-colors bg-zinc-900 border border-zinc-800 !rounded-[var(--radius-xl)]"
            onClick={() => window.open('https://forms.gle/JnKHiYTAc2579xjh6', '_blank')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 shadow-inner flex items-center justify-center text-[var(--color-primary)] border border-pink-500/20">
                <MessageSquare size={20} />
              </div>
              <div>
                <p className="font-bold text-white">{t('mypage_feedback_title')}</p>
                <p className="text-xs text-zinc-500 font-medium mt-0.5">{t('mypage_feedback_desc')}</p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-extrabold text-zinc-500 mb-2 ml-1 tracking-wide">{t('mypage_backup')}</h3>
        <div className="space-y-3">
          <Card className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800 transition-colors bg-zinc-900 border border-zinc-800 !rounded-[var(--radius-xl)]" onClick={handleBackup}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#111] shadow-inner flex items-center justify-center text-zinc-400 border border-zinc-700">
                <Download size={20} />
              </div>
              <div>
                <p className="font-bold text-white">{t('mypage_backup_button')}</p>
                <p className="text-xs text-zinc-500 font-medium mt-0.5">{t('mypage_backup_desc')}</p>
              </div>
            </div>
          </Card>

          <label className="block w-full">
            <input type="file" accept=".json" className="hidden" onChange={handleRestore} />
            <Card className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800 transition-colors bg-zinc-900 border border-zinc-800 !rounded-[var(--radius-xl)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#111] shadow-inner flex items-center justify-center text-[var(--color-primary)] border border-[var(--color-primary)] border-opacity-30">
                  <Upload size={20} />
                </div>
                <div>
                  <p className="font-bold text-white">{t('mypage_restore_button')}</p>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5">{t('mypage_restore_desc')}</p>
                </div>
              </div>
            </Card>
          </label>
        </div>
      </section>

      {/* 언어 설정 */}
      <section>
        <h3 className="text-sm font-extrabold text-zinc-500 mb-2 ml-1 tracking-wide">{t('mypage_language')}</h3>
        <Card className="p-4 bg-zinc-900 border border-zinc-800 !rounded-[var(--radius-xl)]">
          <div className="flex items-center gap-2 mb-3">
            <Globe size={16} className="text-zinc-400" />
            <span className="text-sm font-bold text-zinc-300">{t('mypage_language')}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['ko', 'en', 'ja'] as const).map(lang => (
              <button
                key={lang}
                onClick={() => changeLanguage(lang)}
                className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${
                  i18n.language === lang
                    ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                }`}
              >
                {t(`mypage_lang_${lang}`)}
              </button>
            ))}
          </div>
        </Card>
      </section>

      <section>
        <Card className="flex items-center justify-between p-4 bg-transparent border border-zinc-800 shadow-none !rounded-xl">
          <div className="flex items-center gap-2 text-zinc-500">
            <Info size={16} />
            <p className="font-medium text-sm">{t('mypage_version')}</p>
          </div>
          <span className="text-sm text-zinc-600 font-bold font-mono tracking-widest">v2.0.0</span>
        </Card>
      </section>

      <SubscriptionModal isOpen={showSubscriptionModal} onClose={() => setShowSubscriptionModal(false)} />

      <Modal isOpen={isNameModalOpen} onClose={() => setIsNameModalOpen(false)} title={t('mypage_nickname_modal_title')}>
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">{t('mypage_nickname_modal_desc')}</p>
          <input 
            type="text"
            className="w-full bg-[#111] border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--color-primary)] transition-all"
            value={tempName}
            onChange={e => setTempName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveName()}
          />
          <button 
             className="w-full bg-[var(--color-primary)] disabled:opacity-50 text-white font-bold h-12 rounded-xl transition-all shadow-[0_0_15px_rgba(255,42,122,0.4)]"
             onClick={handleSaveName}
             disabled={!tempName.trim()}
          >
             {t('mypage_nickname_modal_button')}
          </button>
        </div>
      </Modal>

      {/* 계정 삭제 확인 모달 */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="계정 삭제">
        <div className="space-y-5">
          <p className="text-sm text-zinc-300 leading-relaxed">
            계정을 삭제하면 모든 데이터(생리 기록, 영양제 정보, 설정)가 <span className="text-red-400 font-bold">영구적으로 삭제</span>되며 복구할 수 없어요.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="flex-1 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold text-sm"
            >
              취소
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="flex-1 py-3 rounded-xl bg-red-600 disabled:opacity-50 text-white font-bold text-sm"
            >
              {isDeleting ? '삭제 중...' : '삭제할게요'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
