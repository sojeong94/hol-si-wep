import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { track } from '@/lib/analytics'
import { useRecordStore } from '@/store/useRecordStore'
import { useSettingStore } from '@/store/useSettingStore'
import { useSubscriptionStore } from '@/store/useSubscriptionStore'
import { useUsageLimitStore } from '@/store/useUsageLimitStore'
import {
  getAverageCycle,
  getOvulationDate,
  getOvulationPeriod,
  parseLocalDate,
} from '@/utils/cycleCalculators'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import {
  ChevronLeft,
  ChevronRight,
  Camera,
  Trash2,
  Info,
} from 'lucide-react'
import { OCRScannerModal } from '@/components/ui/OCRScannerModal'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  addDays,
  differenceInDays,
} from 'date-fns'

// ─── 유량 레이블 ──────────────────────────────────────────────
const FLOW_OPTIONS = [
  { value: 'light' as const,  label: '적음' },
  { value: 'normal' as const, label: '보통' },
  { value: 'heavy' as const,  label: '많음' },
]

export function CalendarPage() {
  const { t } = useTranslation()
  const { isPremium, setShowPaywall } = useSubscriptionStore()
  const { remainingOCR, incrementOCR } = useUsageLimitStore()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isOCRModalOpen, setIsOCRModalOpen] = useState(false)
  const [parsedRecords, setParsedRecords] = useState<{ start: string; end: string | null }[]>([])
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [localFlow, setLocalFlow] = useState<'light' | 'normal' | 'heavy' | undefined>(undefined)
  const [localPain, setLocalPain] = useState<number | undefined>(undefined)
  const [localMemo, setLocalMemo] = useState('')
  const [symptomSaved, setSymptomSaved] = useState(false)

  const { records, addRecord, removeRecord, updateDailySymptom, endRecord } = useRecordStore()
  const {
    defaultCycle,
    isManualCycle,
    manualCycleDays,
    manualPeriodDays,
  } = useSettingStore()

  const avgCycle  = isManualCycle ? manualCycleDays  : getAverageCycle(records, defaultCycle)
  const avgPeriod = manualPeriodDays  // 항상 마이페이지 설정값 사용

  const monthStart = startOfMonth(currentMonth)
  const monthEnd   = endOfMonth(monthStart)
  const startDate  = startOfWeek(monthStart)
  const endDate    = endOfWeek(monthEnd)
  const days       = eachDayOfInterval({ start: startDate, end: endDate })

  const sortedRecords = [...records].sort(
    (a, b) => parseLocalDate(a.startDate).getTime() - parseLocalDate(b.startDate).getTime()
  )

  // ─── 배란/가임기 윈도우 계산 (기존 로직 그대로) ──────────────
  const fertileWindows: { start: Date; end: Date; expectedNext?: Date }[] = []

  if (sortedRecords.length > 0) {
    const maxExtrapolationDate = addMonths(monthEnd, 3)
    let currentAnchorIndex = 0
    let currentVirtualStart = parseLocalDate(sortedRecords[0].startDate)
    let loopCount = 0

    while (
      currentVirtualStart.getTime() < maxExtrapolationDate.getTime() &&
      loopCount < 500
    ) {
      loopCount++
      let nextStart: Date
      let isActualNext = false

      if (currentAnchorIndex < sortedRecords.length - 1) {
        const actualNext = parseLocalDate(sortedRecords[currentAnchorIndex + 1].startDate)
        const diff = differenceInDays(actualNext, currentVirtualStart)

        if (diff < 20) {
          currentAnchorIndex++
          continue
        } else if (diff <= avgCycle + 20) {
          nextStart = actualNext
          isActualNext = true
          currentAnchorIndex++
        } else {
          nextStart = addDays(currentVirtualStart, avgCycle)
          if (nextStart.getTime() >= actualNext.getTime()) {
            nextStart = actualNext
            isActualNext = true
            currentAnchorIndex++
          }
        }
      } else {
        nextStart = addDays(currentVirtualStart, avgCycle)
      }

      const predictedNextForOvulation = addDays(currentVirtualStart, avgCycle)
      const ovulationDate = getOvulationDate(predictedNextForOvulation)

      const isPastLastRecord =
        currentVirtualStart.getTime() >=
        parseLocalDate(sortedRecords[sortedRecords.length - 1].startDate).getTime()

      fertileWindows.push({
        ...getOvulationPeriod(ovulationDate),
        expectedNext:
          isPastLastRecord || !isActualNext ? nextStart : undefined,
      })

      currentVirtualStart = nextStart
    }
  }

  // ─── 날짜 타입 분류 ──────────────────────────────────────────
  const getDayType = (date: Date) => {
    const record = records.find((r) => {
      const start = parseLocalDate(r.startDate)
      const end   = r.endDate
        ? parseLocalDate(r.endDate)
        : addDays(start, avgPeriod - 1)
      return isWithinInterval(date, { start, end }) || isSameDay(date, start)
    })
    if (record) return 'period'

    const expectedMatch = fertileWindows.find(
      (w) => w.expectedNext && isSameDay(date, w.expectedNext)
    )
    if (expectedMatch) return 'expected'

    const inFertile = fertileWindows.some(
      (w) =>
        isWithinInterval(date, { start: w.start, end: w.end }) ||
        isSameDay(date, w.start) ||
        isSameDay(date, w.end)
    )
    if (inFertile) return 'fertile'

    return 'normal'
  }

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')

  // 선택된 날짜가 속한 기록 찾기
  const currentRecord = records.find((r) => {
    const start = parseLocalDate(r.startDate)
    const end   = r.endDate
      ? parseLocalDate(r.endDate)
      : addDays(start, avgPeriod - 1)
    return (
      isSameDay(selectedDate, start) ||
      isWithinInterval(selectedDate, { start, end })
    )
  })

  // 선택 날짜가 기존 기록의 종료일 바로 다음날인지 확인 (연장 버튼용)
  const previousRecord = !currentRecord
    ? records.find((r) => {
        const end = r.endDate
          ? parseLocalDate(r.endDate)
          : addDays(parseLocalDate(r.startDate), avgPeriod - 1)
        return isSameDay(addDays(end, 1), selectedDate)
      })
    : undefined

  // ─── 인사이트 계산 ────────────────────────────────────────────

  // 1) 주기 요약
  const lastRecord = sortedRecords[sortedRecords.length - 1]
  const nextPeriodDate =
    lastRecord
      ? addDays(parseLocalDate(lastRecord.startDate), avgCycle)
      : null

  const currentCycleLength =
    sortedRecords.length >= 2
      ? differenceInDays(
          parseLocalDate(sortedRecords[sortedRecords.length - 1].startDate),
          parseLocalDate(sortedRecords[sortedRecords.length - 2].startDate)
        )
      : null

  // 2) 트렌드
  let trendText = ''
  if (sortedRecords.length >= 3) {
    const latest   = sortedRecords[sortedRecords.length - 1]
    const previous = sortedRecords[sortedRecords.length - 2]
    const older    = sortedRecords[sortedRecords.length - 3]
    const curDiff  = differenceInDays(parseLocalDate(latest.startDate),   parseLocalDate(previous.startDate))
    const prevDiff = differenceInDays(parseLocalDate(previous.startDate), parseLocalDate(older.startDate))
    const delta    = curDiff - prevDiff
    if (delta > 0)      trendText = `이번 주기가 지난달보다 ${delta}일 더 길었어요`
    else if (delta < 0) trendText = `이번 주기가 지난달보다 ${Math.abs(delta)}일 더 짧았어요`
    else                trendText = '이번 주기가 지난달과 똑같아요'
  } else if (sortedRecords.length === 2) {
    const curDiff = differenceInDays(
      parseLocalDate(sortedRecords[1].startDate),
      parseLocalDate(sortedRecords[0].startDate)
    )
    trendText = `첫 주기 간격 ${curDiff}일이 기록됐어요`
  }

  // 3) 증상 패턴 — dailySymptoms 우선, 없으면 기존 record 레벨 호환
  const allSymptoms = sortedRecords.flatMap((r) => {
    const daily = r.dailySymptoms ? Object.values(r.dailySymptoms) : []
    if (daily.length > 0) return daily
    // 기존 데이터 호환
    if (r.flow || r.pain !== undefined) return [{ flow: r.flow, pain: r.pain }]
    return []
  })
  const symptomsWithPain = allSymptoms.filter((s) => s.pain !== undefined && s.pain !== null)
  const avgPainLevel =
    symptomsWithPain.length >= 3
      ? Math.round(symptomsWithPain.reduce((s, d) => s + (d.pain ?? 0), 0) / symptomsWithPain.length)
      : null

  const flowCounts = { light: 0, normal: 0, heavy: 0 }
  allSymptoms.forEach((s) => { if (s.flow) flowCounts[s.flow]++ })
  const totalFlowRecords = flowCounts.light + flowCounts.normal + flowCounts.heavy
  const dominantFlowEntry = Object.entries(flowCounts).sort((a, b) => b[1] - a[1])[0]
  const dominantFlowLabel =
    dominantFlowEntry[0] === 'light' ? '적음' :
    dominantFlowEntry[0] === 'normal' ? '보통' : '많음'
  const hasSymptomData = totalFlowRecords >= 3 || symptomsWithPain.length >= 3

  // ─── OCR 핸들러 (기존 로직 그대로) ──────────────────────────
  const handleOCRResult = (text: string) => {
    let candidateDates: string[] = []
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        candidateDates = parsed.filter(
          (d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
        )
      }
    } catch {}

    if (candidateDates.length === 0) {
      const dateRegex =
        /(?:(?:(?:20)?\d{2})[년.\-/\s]+)?[01]?\d[월.\-/\s]+[0-3]?\d일?/g
      const matches = text.match(dateRegex) ?? []
      candidateDates = matches
        .map((m) => {
          const numbers = m.match(/\d+/g)
          if (!numbers) return null
          let y, mStr, dStr
          if (numbers.length === 2) {
            y = new Date().getFullYear().toString()
            mStr = numbers[0]; dStr = numbers[1]
          } else if (numbers.length >= 3) {
            y = numbers[0]; mStr = numbers[1]; dStr = numbers[2]
          } else return null
          if (y.length === 2) y = '20' + y
          return `${y}-${mStr.padStart(2, '0')}-${dStr.padStart(2, '0')}`
        })
        .filter(Boolean) as string[]
    }

    if (candidateDates.length === 0) { alert(t('calendar_ocr_no_date')); return }

    const twoYearsAgo = subMonths(new Date(), 24).getTime()
    const nowTime     = new Date().getTime()
    const validDates  = candidateDates
      .filter((d) => { const ts = new Date(d).getTime(); return ts >= twoYearsAgo && ts <= nowTime })
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

    if (validDates.length === 0) { alert(t('calendar_ocr_old_dates')); return }

    const newRecords: { start: string; end: string | null }[] = []
    for (let i = 0; i < validDates.length; i++) {
      const next = validDates[i + 1]
      if (
        next &&
        differenceInDays(new Date(next), new Date(validDates[i])) <=
          Math.max(avgPeriod * 2, 14)
      ) {
        newRecords.push({ start: validDates[i], end: next })
        i++
      } else {
        newRecords.push({ start: validDates[i], end: null })
      }
    }

    setParsedRecords(newRecords)
    setIsConfirmModalOpen(true)
  }

  const handleSaveParsedRecords = () => {
    useRecordStore.setState((state) => {
      const newStRecords = [...state.records]
      parsedRecords.forEach((pr) => {
        if (!newStRecords.find((r) => r.startDate === pr.start)) {
          newStRecords.push({
            id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            startDate: pr.start,
            endDate: pr.end,
          })
        }
      })
      return { records: newStRecords }
    })
    if (!isPremium) incrementOCR()
    setIsConfirmModalOpen(false)
    alert(t('calendar_ocr_saved_success'))
  }

  // ─── 일별 증상 핸들러 ─────────────────────────────────────────
  const handleSaveSymptoms = () => {
    if (!currentRecord) return
    updateDailySymptom(currentRecord.id, selectedDateStr, {
      flow: localFlow,
      pain: localPain,
      memo: localMemo.trim() || undefined,
    })
    setSymptomSaved(true)
    setTimeout(() => setSymptomSaved(false), 2000)
  }

  const handleDayClick = (day: Date) => {
    setSelectedDate(day)
    const dateStr = format(day, 'yyyy-MM-dd')
    const rec = records.find((r) => {
      const s = parseLocalDate(r.startDate)
      const e = r.endDate ? parseLocalDate(r.endDate) : addDays(s, avgPeriod - 1)
      return isSameDay(day, s) || isWithinInterval(day, { start: s, end: e })
    })
    const daily = rec?.dailySymptoms?.[dateStr]
    setLocalFlow(daily?.flow)
    setLocalPain(daily?.pain)
    setLocalMemo(daily?.memo ?? '')
    setSymptomSaved(false)
  }

  // ─── 렌더 ─────────────────────────────────────────────────────
  return (
    <div className="p-5 pb-8 space-y-6 animate-in fade-in duration-500 bg-[var(--color-secondary)] min-h-screen">

      {/* 헤더 */}
      <header className="pt-2 flex items-center justify-between">
        <h1 className="text-2xl font-black text-white flex items-center gap-2 tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
          {t('calendar_title')}
          <button
            onClick={() => setShowGuideModal(true)}
            className="p-1 text-zinc-500 hover:text-pink-400 transition-colors active:scale-95"
          >
            <Info size={18} strokeWidth={2.5} />
          </button>
        </h1>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]"></span>
            <span className="text-xs text-zinc-400 font-medium">{t('calendar_period')}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full border border-[var(--color-primary)]"></span>
            <span className="text-xs text-zinc-400 font-medium">{t('calendar_expected')}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full border border-white"></span>
            <span className="text-xs text-zinc-400 font-medium">{t('calendar_fertile')}</span>
          </div>
        </div>
      </header>

      {/* 캘린더 */}
      <Card className="p-5 bg-zinc-900 border border-zinc-800 shadow-xl">
        <div className="flex justify-between items-center mb-6 px-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl active:scale-95 transition-all text-zinc-300 shadow-sm border border-zinc-700/50"
          >
            <ChevronLeft size={22} strokeWidth={2.5} />
          </button>
          <span className="font-black text-2xl text-white tracking-wide">
            {format(currentMonth, t('calendar_month_fmt'))}
          </span>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl active:scale-95 transition-all text-zinc-300 shadow-sm border border-zinc-700/50"
          >
            <ChevronRight size={22} strokeWidth={2.5} />
          </button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-y-4 mb-3 pb-3 border-b border-zinc-800/60 text-center text-[13px] font-bold text-zinc-400">
          <div className="text-pink-400/80">{t('days_sun')}</div>
          <div>{t('days_mon')}</div>
          <div>{t('days_tue')}</div>
          <div>{t('days_wed')}</div>
          <div>{t('days_thu')}</div>
          <div>{t('days_fri')}</div>
          <div className="text-blue-400/80">{t('days_sat')}</div>
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-y-3 gap-x-1 text-center">
          {days.map((day, i) => {
            const isSelected   = isSameDay(day, selectedDate)
            const isTodayDate  = isSameDay(day, new Date())
            const type         = getDayType(day)
            const isCurrentMonth = isSameMonth(day, currentMonth)

            let bgClass   = ''
            let textClass = isCurrentMonth ? 'text-zinc-300 font-medium' : 'text-zinc-600 font-medium'

            if (type === 'period') {
              bgClass   = 'bg-[var(--color-primary)]'
              textClass = isCurrentMonth ? 'text-white font-bold' : 'text-pink-950/40 font-bold'
            } else if (type === 'fertile') {
              bgClass   = 'border border-white bg-transparent'
              textClass = isCurrentMonth ? 'text-white font-bold' : 'text-zinc-600 font-medium'
            } else if (type === 'expected') {
              bgClass   = 'border-2 border-[var(--color-primary)]'
              textClass = isCurrentMonth ? 'text-[var(--color-primary)] font-bold' : 'text-zinc-600 font-medium'
            }

            if (isSelected) bgClass += ' ring-2 ring-offset-2 ring-zinc-700 ring-offset-[#111]'

            return (
              <div key={i} className="flex justify-center h-11 items-center relative">
                <button
                  onClick={() => handleDayClick(day)}
                  className={`w-9 h-9 flex relative items-center justify-center rounded-full transition-all focus:outline-none ${bgClass} ${textClass} ${isTodayDate && type === 'normal' ? 'bg-zinc-800/80' : ''}`}
                >
                  <span className="text-[15px]">{format(day, 'd')}</span>
                  {isTodayDate && (
                    <span className="absolute -bottom-1.5 w-1.5 h-1.5 bg-zinc-300 rounded-full shadow-[0_0_4px_rgba(255,255,255,0.3)]"></span>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </Card>

      {/* ── 날짜 기록 섹션 ── */}
      <section>
        <h3 className="text-lg font-extrabold mb-3 text-zinc-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          {format(selectedDate, t('calendar_date_fmt'))} {t('calendar_record_title')}
        </h3>

        {!currentRecord ? (
          <div className="space-y-3">
            {/* 연장 버튼 — 전날이 생리 기간인 경우 */}
            {previousRecord && (
              <button
                onClick={() => {
                  endRecord(previousRecord.id, selectedDateStr)
                  track('record_extended', { date: selectedDateStr })
                }}
                className="w-full h-14 bg-zinc-900 border border-[var(--color-primary)]/50 shadow-[0_0_12px_rgba(255,42,122,0.15)] rounded-[var(--radius-xl)] flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all active:scale-[0.98]"
              >
                <span className="w-3 h-3 rounded-full bg-[var(--color-primary)]/70 shadow-[0_0_8px_rgba(255,42,122,0.6)]"></span>
                <span className="font-bold text-pink-300 text-base">아직 생리 중이에요 · 하루 연장</span>
              </button>
            )}

            {/* 시작 버튼 */}
            <button
              onClick={() => {
                const autoEnd = format(addDays(parseLocalDate(selectedDateStr), avgPeriod - 1), 'yyyy-MM-dd')
                addRecord(selectedDateStr, autoEnd)
                track('record_added', { total: records.length + 1 })
              }}
              className="w-full h-14 bg-zinc-900 border border-zinc-800 shadow-sm rounded-[var(--radius-xl)] flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors active:scale-[0.98]"
            >
              <span className="w-3 h-3 rounded-full bg-[var(--color-primary)] shadow-[0_0_8px_rgba(255,42,122,0.8)]"></span>
              <span className="font-bold text-white text-lg">{t('calendar_start_button')}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 시작일 취소 */}
            {selectedDateStr === currentRecord.startDate && (
              <button
                onClick={() => removeRecord(currentRecord.id)}
                className="w-full h-14 bg-[var(--color-primary)] border border-pink-600 shadow-[0_0_15px_rgba(255,42,122,0.4)] rounded-[var(--radius-xl)] flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98]"
              >
                <span className="w-3 h-3 rounded-full border-2 border-white/80"></span>
                <span className="font-bold text-white text-lg">{t('calendar_cancel_start')}</span>
              </button>
            )}


            {/* 기록 요약 카드 */}
            <Card className="bg-zinc-900 border border-zinc-800 py-3 px-4 shadow-inner">
              <p className="text-sm font-bold text-zinc-300 text-center">
                {format(parseLocalDate(currentRecord.startDate), t('calendar_date_fmt'))}
                {' '}~{' '}
                {format(
                  currentRecord.endDate
                    ? parseLocalDate(currentRecord.endDate)
                    : addDays(parseLocalDate(currentRecord.startDate), avgPeriod - 1),
                  t('calendar_date_fmt')
                )}
              </p>
              <p className="text-xs text-zinc-500 text-center mt-1">
                마이페이지에서 생리 기간 설정 가능
              </p>
            </Card>

            {/* ── 증상 기록 카드 ── */}
            <Card className="bg-zinc-900 border border-zinc-800 p-4 space-y-4">
              <p className="text-xs font-extrabold text-zinc-400 tracking-wide">
                {format(selectedDate, 'M월 d일')} 기록
              </p>

              {/* 유량 */}
              <div>
                <p className="text-xs font-bold text-zinc-500 mb-2">유량</p>
                <div className="flex gap-2">
                  {FLOW_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setLocalFlow(localFlow === opt.value ? undefined : opt.value)}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${
                        localFlow === opt.value
                          ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-[0_0_10px_rgba(255,42,122,0.4)]'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 통증 */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-bold text-zinc-500">통증</p>
                  <p className="text-xs text-zinc-500">
                    {localPain !== undefined
                      ? localPain === 0 ? '없음' : `${localPain}/5`
                      : '탭해서 기록'}
                  </p>
                </div>
                <div className="flex gap-2 justify-between">
                  {[0, 1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      onClick={() => setLocalPain(localPain === level ? undefined : level)}
                      className={`flex-1 h-8 rounded-lg border text-xs font-bold transition-all ${
                        localPain === level
                          ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-white'
                      }`}
                    >
                      {level === 0 ? '없음' : level}
                    </button>
                  ))}
                </div>
              </div>

              {/* 메모 */}
              <div>
                <p className="text-xs font-bold text-zinc-500 mb-2">메모</p>
                <textarea
                  value={localMemo}
                  onChange={(e) => setLocalMemo(e.target.value)}
                  placeholder="오늘 컨디션을 자유롭게 기록해요"
                  rows={2}
                  style={{ fontSize: '16px' }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[var(--color-primary)] resize-none transition-all"
                />
              </div>

              {/* 저장 버튼 */}
              <button
                onClick={handleSaveSymptoms}
                className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                  symptomSaved
                    ? 'bg-zinc-700 text-zinc-300'
                    : 'bg-[var(--color-primary)] text-white shadow-[0_0_10px_rgba(255,42,122,0.3)]'
                }`}
              >
                {symptomSaved ? '저장됐어요 ✓' : '저장하기'}
              </button>
            </Card>
          </div>
        )}
      </section>

      {/* 과거 기록 가져오기 */}
      <section className="mt-2 mb-2">
        <button
          onClick={() => {
            if (isPremium || remainingOCR() > 0) setIsOCRModalOpen(true)
            else setShowPaywall(true)
          }}
          className="w-full h-12 bg-[#18181A] border border-zinc-800 text-pink-400 font-bold rounded-[var(--radius-xl)] flex items-center justify-center gap-2 hover:bg-zinc-800 active:scale-95 transition-all text-sm"
        >
          <Camera size={18} /> {t('calendar_import_past')}
          {!isPremium && (
            <span className="ml-1 text-[10px] bg-[#ff2a7a]/20 text-[#ff2a7a] px-1.5 py-0.5 rounded-full font-black">
              {remainingOCR() > 0 ? `무료 ${remainingOCR()}회` : 'PRO'}
            </span>
          )}
        </button>
      </section>

      {/* ── 인사이트 카드 섹션 ── */}
      {sortedRecords.length >= 2 && (
        <section className="mt-4 mb-4 space-y-3">
          <h3 className="text-lg font-extrabold text-zinc-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {t('calendar_history')}
          </h3>

          {/* 카드 1: 주기 요약 */}
          {nextPeriodDate && currentCycleLength && (
            <Card className="p-4 bg-zinc-900 border border-zinc-800 flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shrink-0 text-lg">
                📊
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-extrabold text-zinc-400 tracking-wide">주기 요약</p>
                <p className="text-sm font-bold text-white">
                  이번 주기 <span className="text-[var(--color-primary)]">{currentCycleLength}일</span>
                  {' '}&middot; 평균 <span className="text-zinc-300">{avgCycle}일</span>
                </p>
                <p className="text-xs text-zinc-500">
                  다음 생리 예정{' '}
                  <span className="text-pink-300 font-bold">
                    {format(nextPeriodDate, 'M월 d일')}
                  </span>
                </p>
              </div>
            </Card>
          )}

          {/* 카드 2: 트렌드 */}
          {trendText && (
            <Card className="p-4 bg-zinc-900 border border-zinc-800 flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 text-lg">
                📈
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-extrabold text-zinc-400 tracking-wide">트렌드</p>
                <p className="text-sm font-bold text-white">{trendText}</p>
              </div>
            </Card>
          )}

          {/* 카드 3: 증상 패턴 (3회 이상 기록 시) */}
          {hasSymptomData && (
            <Card className="p-4 bg-zinc-900 border border-zinc-800 flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-lg">
                💊
              </div>
              <div className="space-y-1">
                <p className="text-xs font-extrabold text-zinc-400 tracking-wide">
                  증상 패턴 ({Math.max(totalFlowRecords, symptomsWithPain.length)}회 기준)
                </p>
                {avgPainLevel !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 w-14">평균 통증</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((dot) => (
                        <span
                          key={dot}
                          className={`w-3 h-3 rounded-full ${
                            dot <= avgPainLevel
                              ? 'bg-[var(--color-primary)]'
                              : 'bg-zinc-700'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-zinc-400">
                      {avgPainLevel === 0 ? '없음' : `${avgPainLevel}/5`}
                    </span>
                  </div>
                )}
                {totalFlowRecords >= 3 && (
                  <p className="text-xs text-zinc-400">
                    유량 패턴: <span className="text-white font-bold">{dominantFlowLabel}</span>이 가장 많아요
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* 주기 그래프 (기존 유지) */}
          <Card className="p-5 flex flex-col gap-4 bg-zinc-900 border border-zinc-800">
            <p className="text-xs font-extrabold text-zinc-500 tracking-wide">주기 히스토리</p>
            <div className="overflow-x-auto pb-2 scrollbar-hide">
              <div className="flex items-end gap-4 min-w-max px-2 h-32">
                {sortedRecords.slice(-10).map((r) => {
                  const recordIndex = sortedRecords.findIndex((sr) => sr.id === r.id)
                  if (recordIndex === 0) return null
                  const prevRecord = sortedRecords[recordIndex - 1]
                  const diff = differenceInDays(
                    parseLocalDate(r.startDate),
                    parseLocalDate(prevRecord.startDate)
                  )
                  return (
                    <div key={r.id} className="flex flex-col items-center gap-2">
                      <span className="text-xs font-bold text-zinc-500">{diff}일</span>
                      <div className="w-9 bg-zinc-800 border border-zinc-700 shadow-inner relative flex flex-col justify-end h-20 rounded-t-sm">
                        <div
                          className="w-full bg-[var(--color-primary)] opacity-90 transition-all duration-1000 rounded-t-sm shadow-[0_0_8px_rgba(255,42,122,0.5)]"
                          style={{ height: `${Math.min((diff / 45) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-zinc-400 whitespace-nowrap">
                        {format(parseLocalDate(r.startDate), 'yy.M.d')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* OCR 모달 */}
      <OCRScannerModal
        isOpen={isOCRModalOpen}
        onClose={() => setIsOCRModalOpen(false)}
        onScanResult={handleOCRResult}
        mode="period"
        description={t('calendar_ocr_desc')}
      />

      {/* OCR 결과 확인 모달 */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title={t('calendar_ocr_result_title')}
      >
        <div className="space-y-4">
          {parsedRecords.length === 0 ? (
            <p className="text-center text-sm font-bold text-pink-500 py-6">
              {t('calendar_ocr_all_removed')}
            </p>
          ) : (
            <>
              <p className="text-center text-2xl font-black text-white">
                {t('calendar_ocr_found', { count: parsedRecords.length })}
                <span className="text-base font-medium text-zinc-400 ml-2">
                  {t('calendar_ocr_found_suffix')}
                </span>
              </p>
              <p className="text-center text-xs text-zinc-500">{t('calendar_ocr_remove_hint')}</p>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {parsedRecords.map((r, idx) => {
                  const startFmt = format(parseLocalDate(r.start), t('calendar_date_fmt'))
                  const endFmt   = r.end ? format(parseLocalDate(r.end), t('calendar_date_fmt')) : null
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3"
                    >
                      <div>
                        <p className="font-bold text-white text-sm">
                          {startFmt}
                          {endFmt && <span className="text-zinc-400 font-normal"> → {endFmt}</span>}
                        </p>
                        <p className="text-xs text-zinc-600 mt-0.5">
                          {endFmt
                            ? t('calendar_ocr_days_count', {
                                days: differenceInDays(parseLocalDate(r.end!), parseLocalDate(r.start)) + 1,
                              })
                            : t('calendar_ocr_start_only')}
                        </p>
                      </div>
                      <button
                        onClick={() => setParsedRecords(parsedRecords.filter((_, i) => i !== idx))}
                        className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-pink-900 flex items-center justify-center text-zinc-500 hover:text-pink-400 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )}
          <button
            onClick={handleSaveParsedRecords}
            disabled={parsedRecords.length === 0}
            className="w-full bg-[var(--color-primary)] text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(255,42,122,0.4)]"
          >
            {parsedRecords.length > 0
              ? t('calendar_ocr_save', { count: parsedRecords.length })
              : t('calendar_ocr_save_empty')}
          </button>
        </div>
      </Modal>

      {/* 가이드 모달 */}
      <Modal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        title={t('calendar_guide_button')}
      >
        <div className="space-y-4 mt-2">
          <div className="bg-[#18181A] border border-zinc-800 p-4 rounded-[1.25rem]">
            <p className="text-pink-400 font-bold mb-1.5 flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-pink-500"></span> 자동 종료일 설정
            </p>
            <p className="text-zinc-300 font-medium text-xs sm:text-sm leading-relaxed break-keep">
              시작일을 탭하면 마이페이지의 평균 기간 설정에 따라{' '}
              <strong className="text-pink-300">종료일이 자동으로 설정</strong>돼요.
              실제로 다른 날 끝났다면 그날을 탭해서 수정할 수 있어요.
            </p>
          </div>

          <div className="bg-[#18181A] border border-zinc-800 p-4 rounded-[1.25rem]">
            <p className="text-amber-400 font-bold mb-1.5 flex items-center gap-1.5 text-sm">
              💊 증상 기록
            </p>
            <p className="text-zinc-300 font-medium text-xs sm:text-sm leading-relaxed break-keep">
              생리 기간 중 날짜를 탭하면 <strong className="text-amber-300">유량·통증·메모</strong>를
              기록할 수 있어요. 3회 이상 쌓이면 나만의 증상 패턴을 확인할 수 있어요.
            </p>
          </div>

          <div className="bg-[#18181A] border border-zinc-800 p-4 rounded-[1.25rem]">
            <p className="text-blue-400 font-bold mb-1.5 flex items-center gap-1.5 text-sm">
              <Camera size={14} className="text-blue-500" /> 과거 기록 가져오기
            </p>
            <p className="text-zinc-300 font-medium text-xs sm:text-sm leading-relaxed break-keep">
              하단의 <strong>과거 기록 가져오기</strong> 버튼으로 스크린샷을 올리면
              AI가 날짜를 자동 추출해요.
            </p>
          </div>

          <div className="bg-[#18181A] border border-zinc-800 p-4 rounded-[1.25rem]">
            <p className="text-amber-400 font-bold mb-1.5 flex items-center gap-1.5 text-sm">
              📊 인사이트 카드
            </p>
            <p className="text-zinc-300 font-medium text-xs sm:text-sm leading-relaxed break-keep">
              기록이 <strong className="text-amber-300">2회 이상</strong> 쌓이면 주기 요약·트렌드·증상 패턴 카드가 생성돼요.
            </p>
          </div>

          <button
            onClick={() => setShowGuideModal(false)}
            className="w-full mt-2 bg-[var(--color-primary)] hover:bg-pink-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(255,42,122,0.3)] active:scale-95"
          >
            {t('calendar_guide_confirm')}
          </button>
        </div>
      </Modal>
    </div>
  )
}
