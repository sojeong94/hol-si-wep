import { useTranslation } from 'react-i18next'
import { useRecordStore } from '@/store/useRecordStore'
import { usePillStore } from '@/store/usePillStore'
import { useSettingStore } from '@/store/useSettingStore'
import { useSubscriptionStore } from '@/store/useSubscriptionStore'
import { useUsageLimitStore } from '@/store/useUsageLimitStore'
import { TermTooltip } from '@/components/ui/TermTooltip'
import { getAverageCycle, getAveragePeriodDays, getNextPeriodDate, parseLocalDate } from '@/utils/cycleCalculators'
import { differenceInDays, format } from 'date-fns'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Share, Wind, RefreshCw, Info, MessageCircle, Send, Loader2, Crown } from 'lucide-react'
import { track } from '@/lib/analytics'
import { RecommendCards, type Recommendation } from '@/components/ui/RecommendCards'

export function Home() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { records } = useRecordStore()
  const { pills } = usePillStore()
  const { defaultCycle, defaultPeriodDays, isManualCycle, manualCycleDays, manualPeriodDays, userName, setUserName } = useSettingStore()
  const { isPremium, setShowPaywall } = useSubscriptionStore()
  const { remainingAI, incrementAI, isHoneymoon } = useUsageLimitStore()

  const openAdvisor = () => {
    if (!isPremium && !isHoneymoon() && remainingAI() <= 0) { setShowPaywall(true); return }
    setIsAdvisorOpen(true)
    setAdvisorAnswer('')
    setAdvisorQuestion('')
  }

  const openAdvisorWithQuestion = (q: string) => {
    if (!isPremium && !isHoneymoon() && remainingAI() <= 0) { setShowPaywall(true); return }
    setAdvisorQuestion(q)
    setIsAdvisorOpen(true)
  }

  // 모달 상태
  const [showWelcomeModal, setShowWelcomeModal] = useState(!userName)
  const [showNameModal, setShowNameModal] = useState(false)
  const [showAboutModal, setShowAboutModal] = useState(false)
  const [tempName, setTempName] = useState('')

  const handleSaveName = () => {
    if (tempName.trim()) {
      setUserName(tempName.trim())
      setShowNameModal(false)
      track('onboarding_complete')
    }
  }

  // 예상 주기 계산
  const avgCycle = isManualCycle ? manualCycleDays : getAverageCycle(records, defaultCycle)
  const avgPeriodDays = isManualCycle ? manualPeriodDays : getAveragePeriodDays(records, defaultPeriodDays)
  let nextDateStr = ''
  let dDay = null
  let isInPeriod = false
  let periodDay = 0

  if (records.length > 0) {
    const sortedRecords = [...records].sort((a, b) => parseLocalDate(a.startDate).getTime() - parseLocalDate(b.startDate).getTime())
    const lastRecord = sortedRecords[sortedRecords.length - 1]
    const today = new Date()
    const lastStartDate = parseLocalDate(lastRecord.startDate)
    const lastEndDate = lastRecord.endDate ? parseLocalDate(lastRecord.endDate) : null
    const daysSinceStart = differenceInDays(today, lastStartDate)

    // 현재 생리 중 여부 판단
    if (daysSinceStart >= 0) {
      if (lastEndDate) {
        // 끝난 날 기록이 있으면 그 날까지만 생리 중
        if (differenceInDays(lastEndDate, today) >= 0) {
          isInPeriod = true
          periodDay = daysSinceStart + 1
        }
      } else {
        // 끝난 날 기록이 없으면 평균 생리 기간 동안 생리 중으로 판단
        if (daysSinceStart < avgPeriodDays) {
          isInPeriod = true
          periodDay = daysSinceStart + 1
        }
      }
    }

    const nextDate = getNextPeriodDate(lastRecord.startDate, avgCycle)
    nextDateStr = format(nextDate, 'MM.dd')
    dDay = differenceInDays(nextDate, today)
  }

  let dDayContent = {
    title: '예측 불가',
    subtitle: '주기 데이터를 기록해주세요.',
    tag: null as string | null,
    gradient: 'bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 text-white shadow-xl',
    advice: userName ? `${userName}, 달력에 터진 날 기록해줘.\n데이터가 쌓여야 내가 챙겨줄 수 있잖아.` : '달력에 터진 날을 기록하면 주기를 예측해드려요.'
  }

  if (isInPeriod) {
    dDayContent = {
      title: `생리 ${periodDay}일차`,
      subtitle: `호르몬 재정비 중이에요`,
      tag: '생리 중',
      gradient: 'bg-gradient-to-br from-[#ff2a7a] via-rose-500 to-pink-600 border border-[#ff2a7a]/60 text-white shadow-[0_0_24px_rgba(255,42,122,0.5)]',
      advice: `${periodDay}일째야. 지금은 무조건 나한테 잘 해줘.\n철분이랑 마그네슘 챙겨, 지금 네 몸이 다 써버리고 있거든.`
    }
  } else if (dDay !== null) {
    if (dDay > 7) {
      dDayContent = {
        title: `D-${dDay}`,
        subtitle: `에너지가 가장 좋을 때`,
        tag: null,
        gradient: 'bg-gradient-to-br from-pink-400 to-rose-500 border border-pink-400/40 text-white shadow-lg shadow-pink-500/20',
        advice: `뭐야, 아직 ${dDay}일이나 남았잖아.\n지금 텐션 최고일 때 맛있는 거 먹어둬.`
      }
    } else if (dDay > 3) {
      dDayContent = {
        title: `D-${dDay}`,
        subtitle: `슬슬 발동 될 수 있어요`,
        tag: '예열 중',
        gradient: 'bg-gradient-to-tr from-pink-500 to-rose-400 border border-pink-500/40 text-white shadow-lg shadow-pink-500/20',
        advice: `슬슬 예민해질 때야. 그냥 달달한 거 먹어.\n내가 시켜서 먹는 거 아니야, 그냥 챙겨주는 거야.`
      }
    } else if (dDay > 0) {
      dDayContent = {
        title: `터짐주의 D-${dDay}`,
        subtitle: `파우치 잘 챙겨요`,
        tag: '주기 임박',
        gradient: 'bg-gradient-to-tr from-[#ff2a7a] to-pink-500 border border-[#ff2a7a]/50 text-white shadow-lg shadow-[#ff2a7a]/30',
        advice: `D-${dDay}. 건드리지 마. 나도 알아.\n마라탕 정도는 허락할게. 딱 오늘만.`
      }
    } else if (dDay === 0) {
      dDayContent = {
        title: 'D-DAY',
        subtitle: `호르몬 재정비 중`,
        tag: '터짐주의',
        gradient: 'bg-gradient-to-br from-[#ff2a7a] via-rose-500 to-[#ff2a7a] border border-[#ff2a7a]/60 text-white shadow-[0_0_24px_rgba(255,42,122,0.5)] animate-pulse',
        advice: `오늘이야. 건드리지 마.\n전기장판이랑 간식 챙겨줘. 부탁이 아니야, 명령이야.`
      }
    } else {
      // 예정일이 지났지만 아직 생리 기록 없음 → 기록 유도
      dDayContent = {
        title: `예정일 +${Math.abs(dDay)}일`,
        subtitle: `터진 날을 기록해주세요`,
        tag: '기록 필요',
        gradient: 'bg-gradient-to-br from-[#ff2a7a] to-rose-700 text-white shadow-[0_0_20px_rgba(255,42,122,0.3)]',
        advice: `예정일이 ${Math.abs(dDay)}일 지났어. 터진 날 기록해줘야 다음도 챙겨줄 수 있잖아.`
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

  // 영양제 상담 (홈)
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false)
  const [advisorQuestion, setAdvisorQuestion] = useState('')
  const [advisorAnswer, setAdvisorAnswer] = useState('')
  const [advisorRecommendations, setAdvisorRecommendations] = useState<Recommendation[]>([])
  const [isAsking, setIsAsking] = useState(false)

  const askAdvisor = async () => {
    if (!advisorQuestion.trim() || isAsking) return
    setIsAsking(true)
    setAdvisorAnswer('')
    setAdvisorRecommendations([])
    track('advisor_question', { phase: dDay !== null ? String(dDay) : 'unknown' })
    if (!isPremium) incrementAI()
    try {
      const res = await fetch('/api/pill-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: advisorQuestion, pills, dDay, userName }),
      })
      const data = await res.json()
      setAdvisorAnswer(data.answer ?? '답변을 가져오지 못했어요.')
      setAdvisorRecommendations(data.recommendations ?? [])
    } catch {
      setAdvisorAnswer('서버 연결에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsAsking(false)
    }
  }

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


  return (
    <div className="p-5 pb-8 space-y-6 animate-in fade-in duration-500 bg-[var(--color-secondary)] min-h-screen">
      {/* 웰컴 모달 (첫 방문) */}
      <Modal isOpen={showWelcomeModal} onClose={() => { }} title="안녕? 난 홀시야. 🌸">
        <div className="space-y-4 text-center mt-2">
          <p className="text-zinc-300 font-medium text-sm leading-relaxed break-keep">
            나는 네가 <TermTooltip term="생리불순" />이나 <TermTooltip term="PMS" />로 고생할 때 옆에서 잔소리도 하고, 영양제도 챙겨주는 <strong className="text-pink-400">호르몬 시스터(Hormone Sister)</strong>야.
          </p>
          <p className="text-zinc-300 font-medium text-sm leading-relaxed break-keep">
            어렵고 딱딱한 기록은 버리고, 이제 나랑 같이 편안하게 호르몬 주기를 관리해보자!
          </p>
          <button
            onClick={() => { setShowWelcomeModal(false); setShowNameModal(true) }}
            className="w-full mt-4 bg-[var(--color-primary)] text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(255,42,122,0.3)] active:scale-95"
          >
            {t('home_welcome_button')}
          </button>
        </div>
      </Modal>

      {/* 닉네임 설정 모달 */}
      <Modal isOpen={showNameModal} onClose={() => { }} title={t('home_name_modal_title')}>
        <p className="text-zinc-400 font-medium text-sm mb-6">
          {t('home_name_modal_desc')}
        </p>
        <div className="space-y-4">
          <input
            type="text"
            placeholder={t('home_name_placeholder')}
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
            {t('home_name_button')}
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

      <header className="pt-2">
        <h1 className="text-2xl font-black text-white flex items-center gap-2 tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
          오늘의 {userName ? `${userName}홀시` : '홀시'}
          <button onClick={() => setShowAboutModal(true)} className="p-1 text-zinc-500 hover:text-pink-400 transition-colors active:scale-95">
            <Info size={18} strokeWidth={2.5} />
          </button>
        </h1>
      </header>

      {/* 터짐주의 위젯 */}
      <div
        onClick={() => navigate('/calendar')}
        className={`relative overflow-hidden p-6 rounded-[var(--radius-xl)] transition-all duration-700 ease-out cursor-pointer active:scale-[0.98] ${dDayContent.gradient}`}
      >
        <div className="relative z-10">
          <p className="opacity-80 font-medium mb-3 text-xs tracking-wider">{nextDateStr ? `${t('home_dday_next')} ${nextDateStr}` : t('home_dday_no_data')}</p>
          <div className="flex flex-col gap-1">
            <h2 className="text-[1.6rem] leading-snug sm:text-3xl font-black tracking-tight drop-shadow-md break-keep">
              <span className="block">{dDayContent.title}</span>
              <span className="opacity-90">{dDayContent.subtitle}</span>
            </h2>
          </div>
        </div>
      </div>

      {/* 홀시의 참견 - AI 맞춤 조언 */}
      <section>
        <h3 className="text-lg font-extrabold mb-3 flex items-center gap-2 text-zinc-50 tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" style={{ fontFamily: '"Gowun Dodum", sans-serif' }}>
          {t('home_advice_section')}
        </h3>
        <Card className="p-5 bg-zinc-900 border border-zinc-800 shadow-xl relative transition-all min-h-[160px] flex flex-col justify-center rounded-[2rem]">
          <div className="w-full bg-pink-500/10 border border-pink-500/20 rounded-2xl px-5 py-5 text-[15px] text-pink-50 transition-all min-h-[6.5rem] mb-4 break-keep flex items-center justify-center text-center font-medium shadow-inner leading-relaxed whitespace-pre-wrap" style={{ fontFamily: '"Gowun Dodum", sans-serif' }}>
            {isLoadingAdvice ? (
              <span className="text-pink-400/70 animate-pulse">{t('home_advice_loading')}</span>
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
              <Share size={16} strokeWidth={2.5} /> {t('home_advice_share')}
            </button>
          </div>
          {/* 쿠팡 파트너스 추천 */}
          <RecommendCards recommendations={aiRecommendations} />
        </Card>
      </section>

      {/* 영양제 상담 */}
      <section>
        <h3 className="text-lg font-extrabold mb-3 flex items-center gap-2 text-zinc-50 tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{t('home_consultation_section')}</h3>
        <Card className="p-5 bg-zinc-900 border border-zinc-800 shadow-xl rounded-[2rem]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/30 rounded-2xl flex items-center justify-center shrink-0">
              <MessageCircle size={20} className="text-[var(--color-primary)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-zinc-100 text-sm mb-0.5">{t('home_consultation_title')}</p>
              <p className="text-xs text-zinc-500 truncate">{t('home_consultation_desc')}</p>
            </div>
            <button
              onClick={openAdvisor}
              className="shrink-0 px-4 py-2 bg-[var(--color-primary)] text-white text-xs font-bold rounded-xl shadow-[0_0_10px_rgba(255,42,122,0.3)] active:scale-95 transition-all flex items-center gap-1"
            >
              {!isPremium && !isHoneymoon() && <Crown size={12} />}
              {isPremium
                ? '상담하기'
                : isHoneymoon()
                  ? '7일 무료 체험'
                  : remainingAI() > 0
                    ? `무료 ${remainingAI()}회 남음`
                    : '프리미엄'}
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide mt-3 pb-0.5 -mx-1 px-1">
            {['지금 먹으면 좋은 영양제 뭐야?', '같이 먹으면 안 되는 조합 있어?', '생리통에 좋은 영양제 알려줘'].map(q => (
              <button
                key={q}
                onClick={() => openAdvisorWithQuestion(q)}
                className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 px-3 py-1.5 rounded-full hover:border-pink-500/50 transition-colors whitespace-nowrap flex-shrink-0"
              >
                {q}
              </button>
            ))}
          </div>
        </Card>
      </section>

      {/* 영양제 상담 모달 */}
      <Modal isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} title={t('home_consultation_modal_title')}>
        <div className="space-y-4">
          {advisorAnswer && (
            <Card className="p-4 bg-zinc-900 border border-zinc-700 text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
              {advisorAnswer}
              <RecommendCards recommendations={advisorRecommendations} label="관련 영양제 보기" />
            </Card>
          )}
          <div className="flex w-full gap-2 items-center">
            <input
              type="text"
              value={advisorQuestion}
              onChange={e => setAdvisorQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && askAdvisor()}
              placeholder={t('home_consultation_placeholder')}
              className="flex-1 min-w-0 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-[var(--color-primary)] transition-all"
            />
            <button
              onClick={askAdvisor}
              disabled={isAsking || !advisorQuestion.trim()}
              className="shrink-0 w-12 h-12 bg-[var(--color-primary)] disabled:opacity-40 rounded-xl flex items-center justify-center active:scale-95 transition-all shadow-[0_0_10px_rgba(255,42,122,0.4)]"
            >
              {isAsking ? <Loader2 size={18} className="text-white animate-spin" /> : <Send size={18} className="text-white" />}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {['지금 먹으면 좋은 영양제 뭐야?', '같이 먹으면 안 되는 조합 있어?', '생리통에 좋은 영양제 알려줘', '월경 기간에 더 챙겨야 할 게 있어?'].map(q => (
              <button
                key={q}
                onClick={() => setAdvisorQuestion(q)}
                className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 px-3 py-1.5 rounded-full hover:border-pink-500/50 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* 광고 배너 */}
      {/* <AdBanner slot="5445746484" className="my-2" /> */}

      {/* 감정 쓰레기통 */}
      <section>
        <h3 className="text-lg font-extrabold mb-3 flex items-center gap-1.5 text-zinc-50 tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{t('home_trash_section')}</h3>
        <Card className="p-4 bg-zinc-900 border border-zinc-800 shadow-inner relative overflow-hidden transition-all duration-700 min-h-[160px] flex flex-col justify-center">
          {isBurned ? (
            <div className="flex flex-col items-center justify-center p-4 text-zinc-500 animate-in zoom-in-95 duration-500">
              <Wind size={32} className="mb-2 text-pink-500/50" />
              <p className="font-bold text-sm text-zinc-300 mb-1">{t('home_trash_burned_title')}</p>
              <p className="text-xs text-zinc-600">{t('home_trash_burned_desc')}</p>
            </div>
          ) : (
            <div className={`transition-all duration-1000 ${isBurning ? 'opacity-0 translate-y-[-20px] blur-sm scale-95' : 'opacity-100'}`}>
              <textarea
                placeholder={t('home_trash_placeholder')}
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
                {t('home_trash_button')} <Wind size={16} />
              </button>
            </div>
          )}
        </Card>
      </section>

    </div>
  )
}
