import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { track } from '@/lib/analytics'
import { usePillStore } from '@/store/usePillStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Plus, MessageCircle, Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RecommendCards, type Recommendation } from '@/components/ui/RecommendCards'

export function Pills() {
  const { t } = useTranslation()
  const DAYS = [t('days_sun'), t('days_mon'), t('days_tue'), t('days_wed'), t('days_thu'), t('days_fri'), t('days_sat')]
  const { pills, addPill, removePill, togglePill, updatePillTime } = usePillStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [newPill, setNewPill] = useState<{ name: string, time: string, cycle: 'everyday' | 'specific', days: number[] }>({ name: '', time: '08:00', cycle: 'everyday', days: [0, 1, 2, 3, 4, 5, 6] })

  // AI 상담
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
    try {
      const res = await fetch('/api/pill-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: advisorQuestion, pills }),
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

  const handleAdd = () => {
    if (!newPill.name.trim()) return
    addPill(newPill)
    setIsModalOpen(false)
    setNewPill({ name: '', time: '08:00', cycle: 'everyday', days: [0, 1, 2, 3, 4, 5, 6] })
  }

  const toggleDay = (dayIndex: number) => {
    setNewPill(prev => {
      let newDays;
      if (prev.days.includes(dayIndex)) {
        newDays = prev.days.filter(d => d !== dayIndex)
      } else {
        newDays = [...prev.days, dayIndex].sort()
      }
      return { ...prev, cycle: newDays.length === 7 ? 'everyday' : 'specific', days: newDays }
    })
  }

  const getDaysText = (days: number[] = [0, 1, 2, 3, 4, 5, 6]) => {
    if (days.length === 7) return t('pills_everyday')
    if (days.length === 0) return t('pills_none')
    if (days.length === 5 && !days.includes(0) && !days.includes(6)) return t('pills_weekday')
    if (days.length === 2 && days.includes(0) && days.includes(6)) return t('pills_weekend')
    return days.map(d => DAYS[d]).join(', ')
  }

  return (
    <div className="p-5 pb-8 space-y-4 animate-in fade-in duration-500 bg-[var(--color-secondary)] min-h-screen relative text-white">
      <header className="pt-2 flex justify-between items-center mb-6">
        <h1 className="text-3xl font-black tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">{t('pills_header')}</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className="text-pink-500 font-bold active:opacity-70 transition-opacity text-lg drop-shadow-[0_0_8px_rgba(255,42,122,0.4)]"
          >
            {isEditMode ? t('pills_done') : t('pills_edit')}
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-pink-500 active:opacity-70 transition-opacity drop-shadow-[0_0_8px_rgba(255,42,122,0.4)]"
          >
            <Plus size={32} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      {pills.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center text-zinc-500 border-none shadow-none bg-transparent">
          <p className="mb-2 font-bold text-lg text-zinc-400">{t('pills_empty_title')}</p>
          <p className="text-sm">{t('pills_empty_desc')}</p>
        </Card>
      ) : (
        <div className="space-y-0">
          {pills.map((pill) => (
            <div key={pill.id} className="flex items-center gap-4 py-4 border-b border-zinc-800">
              {isEditMode && (
                <button onClick={() => removePill(pill.id)} className="shrink-0 w-6 h-6 rounded-full bg-pink-600 flex items-center justify-center shadow-sm">
                  <div className="w-3 h-0.5 bg-white rounded-full"></div>
                </button>
              )}

              <div className="flex-1 flex justify-between items-center transition-opacity" style={{ opacity: pill.isActive === false ? 0.5 : 1 }}>
                <div className="flex flex-col">
                  {isEditMode ? (
                    <label className="relative inline-flex items-center mb-1 group">
                      <span className="text-4xl font-light text-white py-0.5 pr-5 border-b-2 border-zinc-800 group-focus-within:border-[var(--color-primary)] transition-colors">
                        {pill.time}
                      </span>
                      <span className="absolute right-0 text-pink-500 text-xs shadow-white">✏️</span>
                      <input
                        type="time"
                        defaultValue={pill.time}
                        onChange={(e) => e.target.value && updatePillTime(pill.id, e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </label>
                  ) : (
                    <span className="text-5xl font-light text-white mb-1">{pill.time}</span>
                  )}
                  <span className="text-sm font-medium text-zinc-400">
                    {pill.name}, {getDaysText(pill.days)}
                  </span>
                </div>

                {!isEditMode && (
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={pill.isActive !== false} onChange={() => { togglePill(pill.id); track('pill_checked', { pill_name: pill.name }) }} />
                    <div className="w-14 h-8 bg-black/50 border border-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[24px] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-7 after:w-7 after:transition-all peer-checked:bg-[var(--color-primary)] peer-checked:border-[var(--color-primary)] shadow-inner"></div>
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI 영양제 상담 플로팅 버튼 */}
      {!isEditMode && (
        <button
          onClick={() => { setIsAdvisorOpen(true); setAdvisorAnswer(''); setAdvisorQuestion('') }}
          className="fixed bottom-24 right-5 w-14 h-14 bg-[var(--color-primary)] rounded-full shadow-[0_0_20px_rgba(255,42,122,0.5)] flex items-center justify-center active:scale-95 transition-all z-40 border border-pink-400"
        >
          <MessageCircle size={24} className="text-white" />
        </button>
      )}

      {/* 영양제 상담 모달 */}
      <Modal isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} title={t('pills_qa_title')}>
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
              placeholder={t('pills_qa_placeholder')}
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
            {[t('pills_qa_suggestion_1', '같이 먹으면 안 되는 조합이 있어?'), t('pills_qa_suggestion_2', '공복에 먹어도 돼?'), t('pills_qa_suggestion_3', '월경 기간에 더 챙겨야 할 게 있어?')].map(q => (
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('pills_add_title')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">{t('pills_name_label')}</label>
            <input
              type="text"
              value={newPill.name}
              onChange={e => setNewPill({ ...newPill, name: e.target.value })}
              className="w-full bg-[#18181A] border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--color-primary)] transition-all text-lg"
              placeholder={t('pills_name_placeholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">{t('pills_time_label')}</label>
            <input
              type="time"
              value={newPill.time}
              onChange={e => setNewPill({ ...newPill, time: e.target.value })}
              className="w-full bg-[#18181A] border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--color-primary)] transition-all text-2xl font-bold"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2 mt-4">{t('pills_days_label')}</label>
            <div className="flex justify-between gap-1">
              {DAYS.map((day, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleDay(idx)}
                  className={cn(
                    "w-10 h-10 rounded-full font-bold flex items-center justify-center transition-all text-sm",
                    newPill.days.includes(idx)
                      ? "bg-[var(--color-primary)] text-white shadow-[0_0_10px_rgba(255,42,122,0.5)]"
                      : "bg-zinc-800 text-zinc-500 border border-zinc-700 hover:bg-zinc-700"
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
          <Button className="w-full mt-6 bg-[var(--color-primary)] text-white font-bold h-14 rounded-xl shadow-[0_0_15px_rgba(255,42,122,0.4)]" size="lg" onClick={handleAdd}>{t('pills_save')}</Button>
        </div>
      </Modal>
    </div>
  )
}
