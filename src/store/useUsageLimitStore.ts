import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { format } from 'date-fns'

const FREE_AI_LIMIT = 3
const FREE_OCR_LIMIT = 1
const HONEYMOON_DAYS = 7

interface MonthlyUsage {
  month: string   // YYYY-MM
  aiCount: number
  ocrCount: number
}

interface UsageLimitStore {
  usage: MonthlyUsage
  firstOpenAt: string | null
  isHoneymoon: () => boolean
  remainingAI: () => number
  remainingOCR: () => number
  incrementAI: () => void
  incrementOCR: () => void
}

function currentMonth() {
  return format(new Date(), 'yyyy-MM')
}

function freshUsage(): MonthlyUsage {
  return { month: currentMonth(), aiCount: 0, ocrCount: 0 }
}

function ensureCurrentMonth(usage: MonthlyUsage): MonthlyUsage {
  return usage.month === currentMonth() ? usage : freshUsage()
}

export const useUsageLimitStore = create<UsageLimitStore>()(
  persist(
    (set, get) => ({
      usage: freshUsage(),
      firstOpenAt: new Date().toISOString(),

      isHoneymoon: () => {
        const { firstOpenAt } = get()
        if (!firstOpenAt) return false
        const diff = Date.now() - new Date(firstOpenAt).getTime()
        return diff < HONEYMOON_DAYS * 24 * 60 * 60 * 1000
      },

      remainingAI: () => {
        if (get().isHoneymoon()) return 999
        const u = ensureCurrentMonth(get().usage)
        return Math.max(0, FREE_AI_LIMIT - u.aiCount)
      },

      remainingOCR: () => {
        const u = ensureCurrentMonth(get().usage)
        return Math.max(0, FREE_OCR_LIMIT - u.ocrCount)
      },

      incrementAI: () =>
        set((state) => {
          if (get().isHoneymoon()) return state
          const u = ensureCurrentMonth(state.usage)
          return { usage: { ...u, aiCount: u.aiCount + 1 } }
        }),

      incrementOCR: () =>
        set((state) => {
          const u = ensureCurrentMonth(state.usage)
          return { usage: { ...u, ocrCount: u.ocrCount + 1 } }
        }),
    }),
    { name: 'holsi-usage-storage' }
  )
)
