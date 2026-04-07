import { useRecordStore } from '@/store/useRecordStore'
import { usePillStore } from '@/store/usePillStore'
import { useSettingStore } from '@/store/useSettingStore'
import { getAverageCycle, getNextPeriodDate, parseLocalDate } from '@/utils/cycleCalculators'
import { differenceInDays, format } from 'date-fns'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Share, Wind, RefreshCw, Info } from 'lucide-react'
import { RecommendCards, type Recommendation } from '@/components/ui/RecommendCards'
import { AdBanner } from '@/components/ui/AdBanner'

export function Home() {
  const { records } = useRecordStore()
  const { pills, togglePill } = usePillStore()
  const { defaultCycle, isManualCycle, manualCycleDays, userName, setUserName } = useSettingStore()

  // 모달 상태
  const [showWelcomeModal, setShowWelcomeModal] = useState(!userName)
  const [showNameModal, setShowNameModal] = useState(false)
  const [showAboutModal, setShowAboutModal] = useState(false)
  const [tempName, setTempName] = useState('')

  const handleSaveName = () => {
    if (tempName.trim()) {
      setUserName(tempName.trim())
      setShowNameModal(false)
    }
  }

  // 예상 주기 계산
  const avgCycle = isManualCycle ? manualCycleDays : getAverageCycle(records, defaultCycle)
  let nextDateStr = ''
  let dDay = null

  if (records.length > 0) {
    const sortedRecords = [...records].sort((a, b) => parseLocalDate(a.startDate).getTime() - parseLocalDate(b.startDate).getTime())
    const lastRecord = sortedRecords[sortedRecords.length - 1]
    const nextDate = getNextPeriodDate(lastRecord.startDate, avgCycle)
    nextDateStr = format(nextDate, 'MM.dd')
    dDay = differenceInDays(nextDate, new Date())
  }

  let dDayContent = {
    title: '예측 불가',
    subtitle: '주기를 예측할 수 없어요',
    tag: null as string | null,
    gradient: 'bg-gradient-to-br from-[#ff2a7a]/20 to-[#ff2a7a]/5 backdrop-blur-xl border-[#ff2a7a]/30 text-white shadow-xl shadow-[#ff2a7a]/10',
    advice: userName ? `${userName}님, 아직 주기를 예측할 데이터가 부족해요.` : '터진 날을 기록하면 주기를 예측해드려요.'
  }

  if (dDay !== null) {
    if (dDay > 7) {
      dDayContent = {
        title: `D-${dDay}`,
        subtitle: `에너지가 가장 좋을 때`,
        tag: null,
        gradient: 'bg-gradient-to-br from-pink-400/70 to-rose-300/50 backdrop-blur-xl border border-pink-400/50 text-white shadow-lg shadow-pink-500/10',
        advice: `터짐주의 D-${dDay}\n텐션 폭발! 무조건 맛있는 음식을 먹자구요.`
      }
    } else if (dDay > 3) {
      dDayContent = {
        title: `D-${dDay}`,
        subtitle: `슬슬 발동 될 수 있어요`,
        tag: '예열 중',
        gradient: 'bg-gradient-to-tr from-pink-500/70 to-rose-400/50 backdrop-blur-xl border border-pink-500/50 text-white shadow-lg shadow-pink-500/10',
        advice: `터짐주의 D-${dDay}\n당 떨어지기 전 달달한 디저트 조공 바람!`
      }
    } else if (dDay > 0) {
      dDayContent = {
        title: `터짐주의 D-${dDay}`,
        subtitle: `파우치 잘 챙겨요`,
        tag: '주기 임박',
        gradient: 'bg-gradient-to-tr from-[#ff2a7a]/80 to-pink-500/60 backdrop-blur-xl border border-[#ff2a7a]/50 text-white shadow-lg shadow-[#ff2a7a]/15',
        advice: `터짐주의 D-${dDay} \n매우 민감함. 생존을 위해 마라탕 긴급 수혈 요망.`
      }
    } else if (dDay === 0) {
      dDayContent = {
        title: 'D-DAY',
        subtitle: `호르몬 재정비 중`,
        tag: '터짐주의',
        gradient: 'bg-gradient-to-br from-[#ff2a7a]/90 via-rose-500/80 to-[#ff2a7a]/90 backdrop-blur-xl border border-[#ff2a7a]/60 text-white shadow-[0_0_20px_rgba(255,42,122,0.4)] animate-pulse',
        advice: `대망의 D-DAY 입니다.\n건드리면 뭅니다. 따뜻한 전기장판과 간식을 세팅 부탁해요.`
      }
    } else {
      dDayContent = {
        title: `D+${Math.abs(dDay)}`,
        subtitle: `새로운 호르몬으로 에너지를 채워가는 중`,
        tag: null,
        gradient: 'bg-gradient-to-tr from-indigo-500/60 to-purple-400/40 backdrop-blur-xl border border-indigo-500/40 text-white shadow-lg shadow-indigo-500/10',
        advice: `회복 중인 D+${Math.abs(dDay)}\n대자연과 싸우며 앓는 중. 맛있는 배달 음식 하나 어때요?`
      }
    }
  }

  // AI 조언 + 추천
  const [aiAdvice, setAiAdvice] = useState<string | null>(null)
  const [aiRecommendations, setAiRecommendations] = useState<Recommendation[]>([])
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false)

  // fetchAdvice 가 pills/dDay/userName 변경마다 재생성되면 매 토글/리렌더마다 재요청이 나가므로
  // 최신 값은 ref 로 넘기고 콜백 자체는 stable 하게 유지
  const latestAdviceInput = useRef({ dDay, userName, pills })
  useEffect(() => {
    latestAdviceInput.current = { dDay, userName, pills }
  })

  // 중복 호출 방지 + 너무 잦은 재요청 방지 (최소 60초 간격)
  const lastFetchedAtRef = useRef<number>(0)
  const inFlightRef = useRef(false)

  const fetchAdvice = useCallback(async (opts?: { force?: boolean }) => {
    if (inFlightRef.current) return
    const now = Date.now()
    if (!opts?.force && now - lastFetchedAtRef.current < 60_000) return

    inFlightRef.current = true
    setIsLoadingAdvice(true)
    try {
      const { dDay, userName, pills } = latestAdviceInput.current
      const res = await fetch('/api/holsi-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dDay,
          userName,
          pills: pills.filter(p => p.isActive !== false),
        }),
      })
      const data = await res.json()
      if (data.advice) setAiAdvice(data.advice)
      if (data.recommendations) setAiRecommendations(data.recommendations)
      lastFetchedAtRef.current = Date.now()
    } catch {
      // 서버 연결 실패 시 기존 하드코딩 조언 유지
    } finally {
      inFlightRef.current = false
      setIsLoadingAdvice(false)
    }
  }, [])

  // 최초 진입 시 1회, 그리고 앱이 background → foreground 로 돌아올 때만 새로고침
  useEffect(() => {
    fetchAdvice({ force: true })

    const handleVisible = () => {
      if (document.visibilityState === 'visible') fetchAdvice()
    }
    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener('focus', handleVisible)
    return () => {
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener('focus', handleVisible)
    }
  }, [fetchAdvice])

  const [trashText, setTrashText] = useState('')
  const [isBurning, setIsBurning] = useState(false)
  const [isBurned, setIsBurned] = useState(false)

  const handleShare = async () => {
    const advice = aiAdvice ?? dDayContent.advice
    const textContext = `${advice}\n\n- 홀시 (holsi.app)`
    if (navigator.share) {
      try {
        await navigator.share({ title: '오늘의 홀시 상태', text: textContext })
      } catch (e) { }
    } else {
      navigator.clipboard.writeText(textContext)
      alert('복사됐어요. 카톡에 붙여넣어 공유해보세요.')
    }
  }

  const burnTrash = () => {
    if (!trashText.trim()) return
    setIsBurning(true)
    setTimeout(() => {
      setIsBurning(false)
      setIsBurned(true)
      setTrashText('')
      setTimeout(() => setIsBurned(false), 5000)
    }, 1200)
  }

  const headerRef = useRef<HTMLElement>(null)
  const trashRef = useRef<HTMLElement>(null)
  const hasSeenTrash = useRef<boolean | 'done'>(false)
  const [showToast, setShowToast] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  const dismissBanner = () => {
    localStorage.setItem('holsi-pwa-dismissed-v4', 'true')
    setShowGuide(false)
    setShowToast(false)
  }

  useEffect(() => {
    const isDismissed = localStorage.getItem('holsi-pwa-dismissed-v4') === 'true'
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as any).standalone)

    if (isDismissed || isStandalone || hasSeenTrash.current === 'done') return

    const handleScroll = () => {
      if (hasSeenTrash.current === 'done') return

      if (trashRef.current) {
        const trashRect = trashRef.current.getBoundingClientRect()
        if (trashRect.top < window.innerHeight - 50) {
          hasSeenTrash.current = true
        }
      }

      if (hasSeenTrash.current === true && headerRef.current) {
        const headerRect = headerRef.current.getBoundingClientRect()
        if (headerRect.bottom > 0) {
          setShowToast(true)
          hasSeenTrash.current = 'done'
        }
      }
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <div className="p-5 pb-8 space-y-6 animate-in fade-in duration-500 bg-[var(--color-secondary)] min-h-screen">
      {/* 웰컴 모달 (첫 방문) */}
      <Modal isOpen={showWelcomeModal} onClose={() => { }} title="안녕? 난 홀시야. 🌸">
        <div className="space-y-4 text-center mt-2">
          <p className="text-zinc-300 font-medium text-sm leading-relaxed break-keep">
            나는 네가 생리불순이나 PMS로 고생할 때 옆에서 잔소리도 하고, 영양제도 챙겨주는 <strong className="text-pink-400">호르몬 시스터(Hormone Sister)</strong>야.
          </p>
          <p className="text-zinc-300 font-medium text-sm leading-relaxed break-keep">
            어렵고 딱딱한 기록은 버리고, 이제 나랑 같이 편안하게 호르몬 주기를 관리해보자!
          </p>
          <button
            onClick={() => { setShowWelcomeModal(false); setShowNameModal(true) }}
            className="w-full mt-4 bg-[var(--color-primary)] text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(255,42,122,0.3)] active:scale-95"
          >
            시작하기
          </button>
        </div>
      </Modal>

      {/* 닉네임 설정 모달 */}
      <Modal isOpen={showNameModal} onClose={() => { }} title="반가워요!">
        <p className="text-zinc-400 font-medium text-sm mb-6">
          들었을때 기분이 좋아지는 애칭을 알려주세요.
        </p>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="이를테면 공주랄까..?"
            className="w-full bg-black/50 border border-zinc-700 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-[var(--color-primary)] placeholder:text-zinc-600 transition-colors"
            value={tempName}
            onChange={e => setTempName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveName()}
          />
          <button
            onClick={handleSaveName}
            disabled={!tempName.trim()}
            className="w-full bg-[var(--color-primary)] disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(255,42,122,0.3)] active:scale-95"
          >
            이 이름으로 시작하기
          </button>
        </div>
      </Modal>

      {/* 어바웃 홀시 모달 */}
      <Modal isOpen={showAboutModal} onClose={() => setShowAboutModal(false)} title="호르몬 시스터, 홀시 🌸">
        <div className="space-y-4 mt-2">
          <div className="bg-pink-500/10 border border-pink-500/20 p-4 rounded-xl text-center">
            <p className="text-pink-400 font-black text-lg mb-1">Hol-Si</p>
            <p className="text-pink-300/80 font-medium text-xs">Hormone Sister</p>
          </div>
          <p className="text-zinc-300 font-medium text-sm leading-relaxed px-1 break-keep text-center">
            홀시는 복잡한 의료 기록 앱이 아니에요.<br /><br />
            가장 친한 언니처럼, 때로는 친구처럼 잔소리도 해주고 영양제도 챙겨주며 여러분의 멘탈과 건강을 케어해주는 당신만의 <strong className="text-[var(--color-primary)]">호르몬 시스터</strong>입니다.<br /><br />
            귀찮은 날엔 그냥 '터진 날' 버튼 하나만 툭 눌러주세요. 그 다음은 홀시가 알아서 챙겨줄게요!
          </p>
          <button
            onClick={() => setShowAboutModal(false)}
            className="w-full mt-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95"
          >
            알겠어요!
          </button>
        </div>
      </Modal>

      <header className="pt-2" ref={headerRef}>
        <h1 className="text-2xl font-black text-white flex items-center gap-2 tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
          오늘의 {userName ? `${userName}홀시` : '홀시'}
          <button onClick={() => setShowAboutModal(true)} className="p-1 text-zinc-500 hover:text-pink-400 transition-colors active:scale-95">
            <Info size={18} strokeWidth={2.5} />
          </button>
        </h1>
      </header>

      {/* 터짐주의 위젯 */}
      <Card className={`relative overflow-hidden p-6 border transition-all duration-700 ease-out ${dDayContent.gradient}`}>
        <div className="relative z-10">
          <p className="opacity-90 font-medium mb-3 text-xs tracking-wider">{nextDateStr ? `다음 예정일 ${nextDateStr}` : '주기를 예측할 수 없어요'}</p>
          <div className="flex flex-col gap-1">
            <h2 className="text-[1.6rem] leading-snug sm:text-3xl font-black tracking-tight drop-shadow-md break-keep">
              <span className="block">{dDayContent.title}</span>
              <span className="opacity-90">{dDayContent.subtitle}</span>
            </h2>
            {dDayContent.tag && (
              <span className="bg-white/20 text-white px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold inline-block mt-2 w-max backdrop-blur-sm border border-white/20">
                {dDayContent.tag}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* 홀시의 참견 - AI 맞춤 조언 */}
      <section>
        <h3 className="text-lg font-extrabold mb-3 flex items-center gap-2 text-zinc-50 tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" style={{ fontFamily: '"Gowun Dodum", sans-serif' }}>
          홀시의 참견
        </h3>
        <Card className="p-5 bg-zinc-900 border border-zinc-800 shadow-xl relative transition-all min-h-[160px] flex flex-col justify-center rounded-[2rem]">
          <div className="w-full bg-pink-500/10 border border-pink-500/20 rounded-2xl px-5 py-5 text-[15px] text-pink-50 transition-all min-h-[6.5rem] mb-4 break-keep flex items-center justify-center text-center font-medium shadow-inner leading-relaxed whitespace-pre-wrap" style={{ fontFamily: '"Gowun Dodum", sans-serif' }}>
            {isLoadingAdvice ? (
              <span className="text-pink-400/70 animate-pulse">홀시가 생각 중이에요...</span>
            ) : (
              aiAdvice ?? dDayContent.advice
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchAdvice({ force: true })}
              disabled={isLoadingAdvice}
              className="shrink-0 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white font-bold py-3.5 px-4 rounded-xl transition-all active:scale-95 flex items-center justify-center border border-zinc-700"
            >
              <RefreshCw size={16} className={isLoadingAdvice ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleShare}
              className="flex-1 bg-[var(--color-primary)] hover:bg-pink-600 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 text-sm shadow-[0_0_15px_rgba(255,42,122,0.4)] border border-pink-400"
            >
              <Share size={16} strokeWidth={2.5} /> 카톡에 공유하기
            </button>
          </div>
          {/* 쿠팡 파트너스 추천 */}
          <RecommendCards recommendations={aiRecommendations} />
        </Card>
      </section>

      {/* 영양제 체크리스트 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-extrabold text-zinc-50 tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">알림</h3>
        </div>
        {pills.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed border-2 border-zinc-700 bg-zinc-900/50 backdrop-blur-sm group cursor-pointer transition-all hover:bg-zinc-800" onClick={() => window.location.href = '/pills'}>
            <p className="font-bold text-[var(--color-primary)] mb-1">나를 위한 작은 홀시비서</p>
            <p className="text-xs text-zinc-500 font-medium">루틴을 설정하고 나를 더 아껴봐요!</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {pills.map(pill => {
              const isActive = pill.isActive !== false
              return (
                <Card
                  key={pill.id}
                  className={`flex items-center justify-between p-4 transition-all ${isActive ? 'bg-[#18181A] border-zinc-700' : 'opacity-40 bg-black border-transparent'}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className={`font-bold flex items-center gap-2 ${!isActive ? 'text-zinc-600' : 'text-zinc-100'}`}>
                          {pill.name}
                        </p>
                        <p className="text-xs font-medium flex items-center gap-1 mt-0.5 text-zinc-500">
                          <span className={`inline-block w-2 h-2 rounded-full ${!isActive ? 'bg-zinc-700' : 'bg-[var(--color-primary)]'}`} />
                          {pill.time}
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={isActive}
                        onChange={() => togglePill(pill.id)}
                      />
                      <div className="w-14 h-8 bg-black/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[24px] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-7 after:w-7 after:transition-all peer-checked:bg-[var(--color-primary)] shadow-inner"></div>
                    </label>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* 광고 배너 */}
      <AdBanner slot="5445746484" className="my-2" />


      {/* 감정 쓰레기통 */}
      <section ref={trashRef}>
        <h3 className="text-lg font-extrabold mb-3 flex items-center gap-1.5 text-zinc-50 tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">비밀 상자</h3>
        <Card className="p-4 bg-zinc-900 border border-zinc-800 shadow-inner relative overflow-hidden transition-all duration-700 min-h-[160px] flex flex-col justify-center">
          {isBurned ? (
            <div className="flex flex-col items-center justify-center p-4 text-zinc-500 animate-in zoom-in-95 duration-500">
              <Wind size={32} className="mb-2 text-pink-500/50" />
              <p className="font-bold text-sm text-zinc-300 mb-1">어둠 속으로 사라졌어요.</p>
              <p className="text-xs text-zinc-600">이곳에 남긴 감정은 누구도 볼 수 없습니다.</p>
            </div>
          ) : (
            <div className={`transition-all duration-1000 ${isBurning ? 'opacity-0 translate-y-[-20px] blur-sm scale-95' : 'opacity-100'}`}>
              <textarea
                placeholder="짜증, 우울, 혹은 말 못할 고민들. 이곳에 털어놓고 쿨하게 잊어버리세요."
                className="w-full bg-[#111] border border-zinc-800 rounded-xl px-4 py-3 text-base text-zinc-200 focus:outline-none focus:border-[var(--color-primary)] transition-all resize-none h-24 mb-3"
                value={trashText}
                onChange={(e) => setTrashText(e.target.value)}
                disabled={isBurning}
              />
              <button
                onClick={burnTrash}
                disabled={isBurning || !trashText.trim()}
                className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:bg-black/30 disabled:border-transparent disabled:text-zinc-600 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 text-sm shadow-[0_0_15px_rgba(0,0,0,0.2)]"
              >
                흔적 없이 날려버리기 <Wind size={16} />
              </button>
            </div>
          )}
        </Card>
      </section>

      {/* PWA Install 팝업 */}
      <div
        className={`fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md transition-all duration-700 ease-out ${showToast && !showGuide ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setShowGuide(true)}
      >
        <Card className={`w-full max-w-[320px] p-6 text-center shadow-2xl transition-all duration-700 delay-100 ${showToast && !showGuide ? 'scale-100 translate-y-0' : 'scale-95 translate-y-10'} bg-zinc-900 border border-zinc-800 !rounded-[2rem]`}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 animate-bounce relative">
            <div className="absolute inset-0 bg-[var(--color-primary)] blur-lg opacity-40 rounded-full"></div>
            <img src="/favicon.svg" alt="홀시 아이콘" className="w-16 h-16 relative z-10 animate-pulse" />
          </div>
          <h3 className="text-2xl font-black text-white mb-2">나를 꺼내줄래?</h3>
          <p className="text-zinc-400 font-medium text-sm mb-6 leading-relaxed px-2">
            이대로 브라우저에 남겨둔다면<br />
            제일 중요한 너의 시간을 놓칠지도 몰라.
          </p>
          <button className="w-full bg-[var(--color-primary)] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-pink-600/20 active:scale-95 transition-transform">
            홈 화면으로 꺼내주기
          </button>
        </Card>
      </div>

      {/* 홈 화면 추가 가이드 모달 */}
      {showGuide && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in" onClick={dismissBanner}>
          <Card className="w-full max-w-sm p-6 bg-zinc-900 border border-zinc-800 animate-in slide-in-from-bottom-8 sm:zoom-in-95 !rounded-3xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 text-white text-center">App 설치 가이드</h3>
            <div className="space-y-4 text-sm font-medium text-zinc-300">
              <div className="bg-[#18181A] p-4 rounded-2xl border border-zinc-800">
                <p className="font-bold text-pink-400 mb-1">iPhone (Safari)</p>
                <p className="text-zinc-400">화면 하단의 [공유] 버튼을 누르고,<br />목록에서 [홈 화면에 추가]를 눌러주세요.</p>
              </div>
              <div className="bg-[#18181A] p-4 rounded-2xl border border-zinc-800">
                <p className="font-bold text-pink-400 mb-1">Android (Chrome)</p>
                <p className="text-zinc-400">화면 우측 상단의 [메뉴(⋮)] 버튼을 누르고,<br />[홈 화면에 추가]를 눌러주세요.</p>
              </div>
            </div>
            <button
              onClick={dismissBanner}
              className="w-full mt-6 bg-[var(--color-primary)] text-white font-bold py-3.5 rounded-xl active:scale-95 transition-transform shadow-lg shadow-black/40"
            >
              알겠어요! 지금 추가할게요
            </button>
          </Card>
        </div>
      )}
    </div>
  )
}
