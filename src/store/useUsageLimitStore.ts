import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { format } from 'date-fns'

const FREE_AI_LIMIT = 3
const FREE_OCR_LIMIT = 1

interface MonthlyUsage {
  month: string   // YYYY-MM
  aiCount: number
  ocrCount: number
}

interface UsageLimitStore {
  usage: MonthlyUsage
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

      remainingAI: () => {
        const u = ensureCurrentMonth(get().usage)
        return Math.max(0, FREE_AI_LIMIT - u.aiCount)
      },

      remainingOCR: () => {
        const u = ensureCurrentMonth(get().usage)
        return Math.max(0, FREE_OCR_LIMIT - u.ocrCount)
      },

      incrementAI: () =>
        set((state) => {
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
