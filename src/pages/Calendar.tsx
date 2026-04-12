import { useState } from 'react'
import { track } from '@/lib/analytics'
import { useRecordStore } from '@/store/useRecordStore'
import { useSettingStore } from '@/store/useSettingStore'
import { getAverageCycle, getAveragePeriodDays, getOvulationDate, getOvulationPeriod, parseLocalDate } from '@/utils/cycleCalculators'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { ChevronLeft, ChevronRight, Camera, Trash2, Info } from 'lucide-react'
import { OCRScannerModal } from '@/components/ui/OCRScannerModal'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth,
  isSameDay, isWithinInterval, addDays, differenceInDays
} from 'date-fns'

export function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isOCRModalOpen, setIsOCRModalOpen] = useState(false)
  const [parsedRecords, setParsedRecords] = useState<{ start: string, end: string | null }[]>([])
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [showGuideModal, setShowGuideModal] = useState(false)

  const { records, addRecord, endRecord, removeRecord } = useRecordStore()
  const { defaultCycle, defaultPeriodDays, isManualCycle, manualCycleDays, manualPeriodDays } = useSettingStore()

  const avgCycle = isManualCycle ? manualCycleDays : getAverageCycle(records, defaultCycle)
  const avgPeriod = isManualCycle ? manualPeriodDays : getAveragePeriodDays(records, defaultPeriodDays)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: startDate, end: endDate })

  const sortedRecords = [...records].sort((a, b) => parseLocalDate(a.startDate).getTime() - parseLocalDate(b.startDate).getTime())

  const fertileWindows: { start: Date, end: Date, expectedNext?: Date }[] = []

  if (sortedRecords.length > 0) {
    const maxExtrapolationDate = addMonths(monthEnd, 3)
    let currentAnchorIndex = 0
    let currentVirtualStart = parseLocalDate(sortedRecords[0].startDate)
    let loopCount = 0

    while (currentVirtualStart.getTime() < maxExtrapolationDate.getTime() && loopCount < 500) {
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

      const isPastLastRecord = currentVirtualStart.getTime() >= parseLocalDate(sortedRecords[sortedRecords.length - 1].startDate).getTime()

      fertileWindows.push({
        ...getOvulationPeriod(ovulationDate),
        expectedNext: (isPastLastRecord || !isActualNext) ? nextStart : undefined
      })

      currentVirtualStart = nextStart
    }
  }

  const getDayType = (date: Date) => {
    const record = records.find(r => {
      const start = parseLocalDate(r.startDate)
      const end = r.endDate ? parseLocalDate(r.endDate) : addDays(start, avgPeriod - 1)
      return isWithinInterval(date, { start, end }) || isSameDay(date, start)
    })
    if (record) return 'period'

    const expectedMatch = fertileWindows.find(w => w.expectedNext && isSameDay(date, w.expectedNext))
    if (expectedMatch) return 'expected'

    const inFertile = fertileWindows.some(w => isWithinInterval(date, { start: w.start, end: w.end }) || isSameDay(date, w.start) || isSameDay(date, w.end))
    if (inFertile) return 'fertile'

    return 'normal'
  }

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')
  const currentRecord = records.find(r =>
    isSameDay(selectedDate, parseLocalDate(r.startDate)) ||
    (r.endDate && (isSameDay(selectedDate, parseLocalDate(r.endDate)) || isWithinInterval(selectedDate, { start: parseLocalDate(r.startDate), end: parseLocalDate(r.endDate) }))) ||
    (!r.endDate && parseLocalDate(r.startDate).getTime() <= selectedDate.getTime())
  )

  let insightText = "아직 분석할 데이터가 부족해요. 꾸준히 시작일을 기록해 주세요."

  if (sortedRecords.length >= 2) {
    const latest = sortedRecords[sortedRecords.length - 1]
    const previous = sortedRecords[sortedRecords.length - 2]
    const curDiff = differenceInDays(parseLocalDate(latest.startDate), parseLocalDate(previous.startDate))

    if (sortedRecords.length >= 3) {
      const older = sortedRecords[sortedRecords.length - 3]
      const prevDiff = differenceInDays(parseLocalDate(previous.startDate), parseLocalDate(older.startDate))

      const diffChange = curDiff - prevDiff
      if (diffChange > 0) insightText = `지난번보다 주기가 ${diffChange}일 길어졌어요. 피로가 쌓였을 수 있으니 푹 휴식하세요.`
      else if (diffChange < 0) insightText = `지난번보다 주기가 ${Math.abs(diffChange)}일 짧아졌어요. 스트레스나 환경 변화에 유의해 주세요.`
      else insightText = "주기가 지난번과 동일하게 매우 일정합니다! 건강하게 유지되고 있어요."
    } else {
      insightText = `기록된 첫 주기는 ${curDiff}일이었어요. 데이터가 한 번 더 쌓이면 변화를 비교 분석해드릴게요!`
    }
  }

  const handleOCRResult = (text: string) => {
    let candidateDates: string[] = []

    // 1순위: Claude Vision이 반환한 YYYY-MM-DD JSON 배열
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        candidateDates = parsed.filter((d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
      }
    } catch { }

    // 2순위: 텍스트에서 날짜 패턴 추출 (폴백)
    if (candidateDates.length === 0) {
      const dateRegex = /(?:(?:(?:20)?\d{2})[년.\-/\s]+)?[01]?\d[월.\-/\s]+[0-3]?\d일?/g
      const matches = text.match(dateRegex) ?? []
      candidateDates = matches.map(m => {
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
      }).filter(Boolean) as string[]
    }

    if (candidateDates.length === 0) {
      alert('이미지에서 날짜를 찾지 못했어요. 생리 기록 날짜가 보이는 스크린샷을 사용해주세요.')
      return
    }

    // 최근 2년 이내 날짜만 유효 처리
    const twoYearsAgo = subMonths(new Date(), 24).getTime()
    const nowTime = new Date().getTime()
    const validDates = candidateDates
      .filter(d => { const t = new Date(d).getTime(); return t >= twoYearsAgo && t <= nowTime })
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

    if (validDates.length === 0) {
      alert('인식된 날짜가 모두 2년 이전이거나 미래 날짜예요. 최근 기록이 포함된 이미지를 사용해주세요.')
      return
    }

    const newRecords: { start: string, end: string | null }[] = []
    for (let i = 0; i < validDates.length; i++) {
      const next = validDates[i + 1]
      if (next && differenceInDays(new Date(next), new Date(validDates[i])) <= Math.max(avgPeriod * 2, 14)) {
        newRecords.push({ start: validDates[i], end: next })
        i++ // next를 end로 썼으니 건너뜀
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
      parsedRecords.forEach(pr => {
        if (!newStRecords.find(r => r.startDate === pr.start)) {
          newStRecords.push({
            id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            startDate: pr.start,
            endDate: pr.end
          })
        }
      })
      return { records: newStRecords }
    })
    setIsConfirmModalOpen(false)
    alert("과거 기록이 성공적으로 추가되었습니다!")
  }

  return (
    <div className="p-5 pb-8 space-y-6 animate-in fade-in duration-500 bg-[var(--color-secondary)] min-h-screen">
      <header className="pt-2 flex items-center justify-between">
        <h1 className="text-2xl font-black text-white flex items-center gap-2 tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
          내 주기 달력
          <button onClick={() => setShowGuideModal(true)} className="p-1 text-zinc-500 hover:text-pink-400 transition-colors active:scale-95">
            <Info size={18} strokeWidth={2.5} />
          </button>
        </h1>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]"></span>
            <span className="text-xs text-zinc-400 font-medium">터짐</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full border border-[var(--color-primary)]"></span>
            <span className="text-xs text-zinc-400 font-medium">예정</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full border border-white"></span>
            <span className="text-xs text-zinc-400 font-medium">가임</span>
          </div>
        </div>
      </header>

      <Card className="p-5 bg-zinc-900 border border-zinc-800 shadow-xl">
        <div className="flex justify-between items-center mb-6 px-2">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl active:scale-95 transition-all text-zinc-300 shadow-sm border border-zinc-700/50 flex items-center justify-center">
            <ChevronLeft size={22} strokeWidth={2.5} />
          </button>
          <span className="font-black text-2xl text-white tracking-wide">{format(currentMonth, 'yyyy년 M월')}</span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl active:scale-95 transition-all text-zinc-300 shadow-sm border border-zinc-700/50 flex items-center justify-center">
            <ChevronRight size={22} strokeWidth={2.5} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-y-4 mb-3 pb-3 border-b border-zinc-800/60 text-center text-[13px] font-bold text-zinc-400">
          <div className="text-pink-400/80">일</div>
          <div>월</div>
          <div>화</div>
          <div>수</div>
          <div>목</div>
          <div>금</div>
          <div className="text-blue-400/80">토</div>
        </div>

        <div className="grid grid-cols-7 gap-y-3 gap-x-1 text-center">
          {days.map((day, i) => {
            const isSelected = isSameDay(day, selectedDate)
            const isTodayDate = isSameDay(day, new Date())
            const type = getDayType(day)

            const isCurrentMonth = isSameMonth(day, currentMonth)
            let bgClass = ''
            let textClass = isCurrentMonth ? 'text-zinc-300 font-medium' : 'text-zinc-600 font-medium'

            if (type === 'period') {
              bgClass = 'bg-[var(--color-primary)]'
              textClass = isCurrentMonth ? 'text-white font-bold' : 'text-pink-950/40 font-bold'
            } else if (type === 'fertile') {
              bgClass = 'border border-white bg-transparent'
              textClass = isCurrentMonth ? 'text-white font-bold' : 'text-zinc-600 font-medium'
            } else if (type === 'expected') {
              bgClass = 'border-2 border-[var(--color-primary)]'
              textClass = isCurrentMonth ? 'text-[var(--color-primary)] font-bold' : 'text-zinc-600 font-medium'
            } else if (isTodayDate) {
              textClass = isCurrentMonth ? 'text-white font-bold' : 'text-zinc-600 font-medium'
            }

            if (isSelected) {
              bgClass += ' ring-2 ring-offset-2 ring-zinc-700 ring-offset-[#111]'
            }

            return (
              <div key={i} className="flex justify-center h-11 items-center relative">
                <button
                  onClick={() => setSelectedDate(day)}
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

      <section>
        <h3 className="text-lg font-extrabold mb-3 text-zinc-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{format(selectedDate, 'M월 d일')} 생리 기록</h3>
        {!currentRecord ? (
          <button onClick={() => { addRecord(selectedDateStr); track('record_added', { total: records.length + 1 }) }} className="w-full h-14 bg-zinc-900 border border-zinc-800 shadow-sm rounded-[var(--radius-xl)] flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors active:scale-[0.98]">
            <span className="w-3 h-3 rounded-full bg-[var(--color-primary)] shadow-[0_0_8px_rgba(255,42,122,0.8)]"></span>
            <span className="font-bold text-white text-lg">이날 터진 날</span>
          </button>
        ) : (
          <div className="space-y-3">
            {selectedDateStr === currentRecord.startDate && (
              <button onClick={() => removeRecord(currentRecord.id)} className="w-full h-14 bg-[var(--color-primary)] border border-pink-600 shadow-[0_0_15px_rgba(255,42,122,0.4)] rounded-[var(--radius-xl)] flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98]">
                <span className="w-3 h-3 rounded-full border-2 border-white/80"></span>
                <span className="font-bold text-white text-lg">터진 날 취소</span>
              </button>
            )}

            {selectedDateStr > currentRecord.startDate && (
              currentRecord.endDate === selectedDateStr ? (
                <button onClick={() => endRecord(currentRecord.id, null)} className="w-full h-14 bg-pink-600 border border-pink-500 shadow-md rounded-[var(--radius-xl)] flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98]">
                  <span className="w-3 h-3 rounded-full border-2 border-white/80"></span>
                  <span className="font-bold text-white text-lg">끝난 날 기록 취소</span>
                </button>
              ) : (
                <button onClick={() => { endRecord(currentRecord.id, selectedDateStr); track('record_ended') }} className="w-full h-14 bg-zinc-800 border border-zinc-700 shadow-sm rounded-[var(--radius-xl)] flex items-center justify-center gap-2 hover:bg-zinc-700 transition-all text-zinc-300 active:scale-[0.98]">
                  <span className="w-3 h-3 rounded-full bg-pink-700 shadow-sm"></span>
                  <span className="font-bold text-white text-lg">이날 끝난 날로 변경</span>
                </button>
              )
            )}

            <Card className="bg-zinc-900 border border-zinc-800 py-3 text-center shadow-inner mt-2">
              <p className="text-sm font-bold text-zinc-300">
                {currentRecord.endDate ?
                  `${format(parseLocalDate(currentRecord.startDate), 'M월 d일')} ~ ${format(parseLocalDate(currentRecord.endDate), 'M월 d일')} (직접 기록됨)` :
                  `${format(parseLocalDate(currentRecord.startDate), 'M월 d일')} ~ ${format(addDays(parseLocalDate(currentRecord.startDate), avgPeriod - 1), 'M월 d일')} (설정 기준 자동 적용)`}
              </p>
            </Card>
          </div>
        )}
      </section>

      {/* 사진 읽기 섹션 */}
      <section className="mt-6 mb-2">
        <button
          onClick={() => setIsOCRModalOpen(true)}
          className="w-full h-12 bg-[#18181A] border border-zinc-800 text-pink-400 font-bold rounded-[var(--radius-xl)] flex items-center justify-center gap-2 hover:bg-zinc-800 active:scale-95 transition-all text-sm mb-4"
        >
          <Camera size={18} /> 과거 기록 가져오기
        </button>
      </section>

      {/* 분석 차트 하단 섹션 */}
      {sortedRecords.length >= 2 && (
        <section className="mt-8 mb-4">
          <h3 className="text-lg font-extrabold mb-3 text-zinc-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">전체 주기 히스토리</h3>
          <Card className="p-5 flex flex-col gap-4 bg-zinc-900 border border-zinc-800">
            <p className="text-sm font-medium text-zinc-300 bg-black/40 p-3.5 rounded-xl border border-zinc-800 shadow-inner leading-relaxed">
              {insightText}
            </p>
            <div className="overflow-x-auto mt-2 pb-2 scrollbar-hide">
              <div className="flex items-end gap-4 min-w-max px-2 h-32">
                {sortedRecords.slice(-10).map((r) => {
                  const recordIndex = sortedRecords.findIndex(sr => sr.id === r.id);
                  if (recordIndex === 0) return null;
                  const prevRecord = sortedRecords[recordIndex - 1]
                  const diff = differenceInDays(parseLocalDate(r.startDate), parseLocalDate(prevRecord.startDate))
                  return (
                    <div key={r.id} className="flex flex-col items-center gap-2">
                      <span className="text-xs font-bold text-zinc-500">{diff}일</span>
                      <div className="w-9 bg-zinc-800 border border-zinc-700 shadow-inner relative flex flex-col justify-end h-20 rounded-t-sm">
                        <div
                          className="w-full bg-[var(--color-primary)] opacity-90 transition-all duration-1000 rounded-t-sm shadow-[0_0_8px_rgba(255,42,122,0.5)]"
                          style={{ height: `${Math.min((diff / 45) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] font-medium text-zinc-400 whitespace-nowrap">{format(parseLocalDate(r.startDate), 'yy.M.d')}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        </section>
      )}

      <OCRScannerModal
        isOpen={isOCRModalOpen}
        onClose={() => setIsOCRModalOpen(false)}
        onScanResult={handleOCRResult}
        mode="period"
        description="생리 기록 날짜가 보이는 스크린샷을 올려주세요. AI가 날짜를 자동으로 추출해요."
      />

      <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title="인식된 기록">
        <div className="space-y-4">
          {parsedRecords.length === 0 ? (
            <p className="text-center text-sm font-bold text-pink-500 py-6">날짜를 모두 지웠어요.</p>
          ) : (
            <>
              <p className="text-center text-2xl font-black text-white">
                {parsedRecords.length}개 주기
                <span className="text-base font-medium text-zinc-400 ml-2">를 찾았어요</span>
              </p>
              <p className="text-center text-xs text-zinc-500">잘못된 항목은 X를 눌러 빼주세요</p>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {parsedRecords.map((r, idx) => {
                  const startFmt = format(parseLocalDate(r.start), 'M월 d일')
                  const endFmt = r.end ? format(parseLocalDate(r.end), 'M월 d일') : null
                  return (
                    <div key={idx} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3">
                      <div>
                        <p className="font-bold text-white text-sm">
                          {startFmt}
                          {endFmt && <span className="text-zinc-400 font-normal"> → {endFmt}</span>}
                        </p>
                        <p className="text-xs text-zinc-600 mt-0.5">
                          {endFmt
                            ? `${differenceInDays(parseLocalDate(r.end!), parseLocalDate(r.start)) + 1}일간`
                            : '시작일만'}
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
            {parsedRecords.length > 0 ? `${parsedRecords.length}개 기록 저장하기` : '저장할 기록 없음'}
          </button>
        </div>
      </Modal>

      {/* 캘린더 이용 가이드 모달 */}
      <Modal isOpen={showGuideModal} onClose={() => setShowGuideModal(false)} title="홀시 캘린더 이용 가이드 💡">
        <div className="space-y-4 mt-2">
          
          <div className="bg-[#18181A] border border-zinc-800 p-4 rounded-[1.25rem]">
            <p className="text-pink-400 font-bold mb-1.5 flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-pink-500"></span> 터진 날과 끝난 날
            </p>
            <p className="text-zinc-300 font-medium text-xs sm:text-sm leading-relaxed break-keep">
              터진 날을 누르면 설정에 맞게 주기가 자동 세팅되지만, 앱의 더 정확한 예측을 위해 기록 저장 시 <strong className="text-pink-300">끝난 날</strong>을 꼭 한 번 더 직접 체크해 주세요!
            </p>
          </div>

          <div className="bg-[#18181A] border border-zinc-800 p-4 rounded-[1.25rem]">
            <p className="text-blue-400 font-bold mb-1.5 flex items-center gap-1.5 text-sm">
              <Camera size={14} className="text-blue-500" /> 과거 기록 가져오기
            </p>
            <p className="text-zinc-300 font-medium text-xs sm:text-sm leading-relaxed break-keep">
              하단의 <strong>과거 기록 가져오기</strong> 버튼을 통해 스크린샷만 올리면, AI가 날짜를 자동으로 추출해서 쉽고 빠르게 과거 기록을 채워줍니다.
            </p>
          </div>

          <div className="bg-[#18181A] border border-zinc-800 p-4 rounded-[1.25rem]">
            <p className="text-amber-400 font-bold mb-1.5 flex items-center gap-1.5 text-sm">
              📊 데이터와 그래프
            </p>
            <p className="text-zinc-300 font-medium text-xs sm:text-sm leading-relaxed break-keep">
              생리 기록 데이터가 <strong className="text-amber-300">2회 이상</strong> 쌓이면, 화면 하단에 월별 주기를 파악할 수 있는 전체 주기 히스토리 그래프가 형성되어 한눈에 변화를 볼 수 있어요.
            </p>
          </div>

          <button
            onClick={() => setShowGuideModal(false)}
            className="w-full mt-2 bg-[var(--color-primary)] hover:bg-pink-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(255,42,122,0.3)] active:scale-95"
          >
            확인했어요!
          </button>
        </div>
      </Modal>
    </div>
  )
}
