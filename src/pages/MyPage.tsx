import { useState } from 'react'
import { useSettingStore } from '@/store/useSettingStore'
import { useRecordStore } from '@/store/useRecordStore'
import { getAverageCycle, getAveragePeriodDays } from '@/utils/cycleCalculators'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Bell, Download, Upload, Info, UserRound, Pencil } from 'lucide-react'
import { subscribePush, unsubscribePush } from '@/lib/pushService'
import { usePillStore } from '@/store/usePillStore'

export function MyPage() {
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

  const handlePushToggle = async (enable: boolean) => {
    if (enable) {
      // iOS 기기인지 확인
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
    } else {
      await unsubscribePush()
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

  return (
    <div className="p-5 pb-8 space-y-6 animate-in fade-in duration-500 bg-[var(--color-secondary)] min-h-screen text-white">
      <header className="pt-2 flex items-center gap-3">
        <div className="w-12 h-12 bg-zinc-900 backdrop-blur-md rounded-full shadow-inner flex items-center justify-center border border-zinc-800">
          <UserRound size={24} className="text-[var(--color-primary)] drop-shadow-[0_0_8px_rgba(255,42,122,0.4)]" />
        </div>
        <h1 className="text-2xl font-black tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">마이페이지</h1>
      </header>

      {/* 내 정보 (닉네임 & 소셜 연동) */}
      <section>
        <h3 className="text-sm font-extrabold text-zinc-500 mb-2 ml-1 tracking-wide">내 정보</h3>
        <Card className="flex flex-col gap-4 p-5 bg-zinc-900 border border-zinc-800">
           <div className="flex justify-between items-center">
             <div>
               <p className="text-xs text-zinc-400 mb-1 font-medium">나의 애칭</p>
               <p className="text-xl font-bold">{userName || '미설정'} 님</p>
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
             <p className="text-xs text-zinc-400 mb-3 font-medium">계정 연동 (추후 결제 및 복구 지원)</p>
             <div className="flex gap-2">
               <button className="flex-1 py-3 flex justify-center items-center gap-2 bg-[#111] border border-zinc-700 rounded-xl opacity-60 hover:opacity-100 transition-opacity">
                 <span className="w-4 h-4 rounded-full bg-yellow-400 block shrink-0"></span>
                 <span className="text-sm font-bold text-zinc-300">카카오 로그인</span>
               </button>
               <button className="flex-1 py-3 flex justify-center items-center gap-2 bg-[#111] border border-zinc-700 rounded-xl opacity-60 hover:opacity-100 transition-opacity">
                 <span className="w-4 h-4 rounded-full bg-white block shrink-0"></span>
                 <span className="text-sm font-bold text-zinc-300">Google 연동</span>
               </button>
             </div>
           </div>
        </Card>
      </section>

      {/* 내 건강 사이클 정보 영역 */}
      <section>
        <div className="flex justify-between items-center mb-2 ml-1">
          <h3 className="text-sm font-extrabold text-zinc-500 tracking-wide">나의 주기 진단</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-400">수동 설정</span>
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
                <span className="font-medium text-zinc-300">예측되는 평균 주기</span>
                <span className="text-xl font-bold text-[var(--color-primary)] drop-shadow-[0_0_8px_rgba(255,42,122,0.4)]">{avgCycle}일</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="font-medium text-zinc-300">예측되는 터진 기간</span>
                <span className="text-xl font-bold text-pink-400">{avgPeriod}일</span>
              </div>
              <p className="text-xs text-zinc-500 mt-2 bg-black/40 p-3 rounded-xl shadow-inner border border-zinc-800 font-medium">달력에 기록된 데이터를 바탕으로 AI가 자동 진단한 결과입니다. 기록이 많아질수록 정확해집니다.</p>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-zinc-300">평균 주기</span>
                  <span className="text-xl font-bold text-[var(--color-primary)] drop-shadow-[0_0_8px_rgba(255,42,122,0.4)]">{manualCycleDays}일</span>
                </div>
                <input 
                  type="range" min="15" max="40" 
                  value={manualCycleDays} 
                  onChange={e => setManualCycleDays(Number(e.target.value))}
                  className="w-full accent-[var(--color-primary)]"
                />
              </div>
              <div className="pt-2 border-t border-zinc-800">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-zinc-300">터진 기간</span>
                  <span className="text-xl font-bold text-pink-400">{manualPeriodDays}일</span>
                </div>
                <input 
                  type="range" min="2" max="14" 
                  value={manualPeriodDays} 
                  onChange={e => setManualPeriodDays(Number(e.target.value))}
                  className="w-full accent-pink-500"
                />
              </div>
            </div>
          )}
        </Card>
      </section>

      <section>
        <h3 className="text-sm font-extrabold text-zinc-500 mb-2 ml-1 tracking-wide">기본 제어</h3>
        <Card className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 !rounded-[var(--radius-xl)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 shadow-inner flex items-center justify-center text-[var(--color-primary)] border border-pink-500/20">
              <Bell size={20} />
            </div>
            <div>
              <p className="font-bold text-white">앱 푸시 알림 허용</p>
              <p className="text-xs text-zinc-400 font-medium mt-0.5">배경에서도 영양제 복용 시간을 알려드려요</p>
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
        <h3 className="text-sm font-extrabold text-zinc-500 mb-2 ml-1 tracking-wide">안전한 데이터 백업</h3>
        <div className="space-y-3">
          <Card className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800 transition-colors bg-zinc-900 border border-zinc-800 !rounded-[var(--radius-xl)]" onClick={handleBackup}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#111] shadow-inner flex items-center justify-center text-zinc-400 border border-zinc-700">
                <Download size={20} />
              </div>
              <div>
                <p className="font-bold text-white">이 기기의 데이터 백업하기</p>
                <p className="text-xs text-zinc-500 font-medium mt-0.5">안전하게 로컬 JSON 파일로 보관하세요</p>
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
                  <p className="font-bold text-white">다른 기기 데이터 복구하기</p>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5">기기를 변경해도 그대로 이어갈 수 있어요</p>
                </div>
              </div>
            </Card>
          </label>
        </div>
      </section>

      <section>
        <Card className="flex items-center justify-between p-4 bg-transparent border border-zinc-800 shadow-none !rounded-xl">
          <div className="flex items-center gap-2 text-zinc-500">
            <Info size={16} />
            <p className="font-medium text-sm">Holsi App Version</p>
          </div>
          <span className="text-sm text-zinc-600 font-bold font-mono tracking-widest">v2.0.0</span>
        </Card>
      </section>

      <Modal isOpen={isNameModalOpen} onClose={() => setIsNameModalOpen(false)} title="애칭 변경">
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">나를 부를 애칭을 자유롭게 정해주세요.</p>
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
             수정 완료
          </button>
        </div>
      </Modal>
    </div>
  )
}
