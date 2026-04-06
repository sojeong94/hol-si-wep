import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Pill {
  id: string
  name: string
  time: string // HH:mm
  cycle: 'everyday' | 'specific' // 간단히 매일 혹은 특정기간
  days: number[] // 요일 배열 (0: 일요일, 1: 월요일, ...)
  isActive: boolean
}

export interface IntakeLog {
  id: string
  pillId: string
  date: string // YYYY-MM-DD
  time: string // HH:mm
}

interface PillState {
  pills: Pill[]
  intakeLogs: IntakeLog[]
  triggerAlarm: string | null
  setTriggerAlarm: (id: string | null) => void
  addPill: (pill: Omit<Pill, 'id' | 'isActive'>) => void
  removePill: (id: string) => void
  updatePillTime: (id: string, time: string) => void
  togglePill: (id: string) => void
  logIntake: (pillId: string, date: string, time: string) => void
  removeIntakeLog: (pillId: string, date: string) => void
}

export const usePillStore = create<PillState>()(
  persist(
    (set) => ({
      pills: [],
      intakeLogs: [],
      triggerAlarm: null,
      setTriggerAlarm: (id) => set({ triggerAlarm: id }),
      addPill: (pill) =>
        set((state) => ({
          pills: [...state.pills, { ...pill, id: Date.now().toString(), isActive: true, days: pill.days ?? [0, 1, 2, 3, 4, 5, 6] }],
        })),
      removePill: (id) =>
        set((state) => ({
          pills: state.pills.filter((p) => p.id !== id),
        })),
      updatePillTime: (id, time) =>
        set((state) => ({
          pills: state.pills.map((p) => p.id === id ? { ...p, time } : p)
        })),
      togglePill: (id) =>
        set((state) => ({
          pills: state.pills.map((p) =>
            p.id === id ? { ...p, isActive: !p.isActive } : p
          ),
        })),
      logIntake: (pillId, date, time) =>
        set((state) => ({
          intakeLogs: [
            ...state.intakeLogs,
            { id: Date.now().toString(), pillId, date, time },
          ],
        })),
      removeIntakeLog: (pillId, date) =>
        set((state) => ({
          intakeLogs: state.intakeLogs.filter(
            (log) => !(log.pillId === pillId && log.date === date)
          ),
        })),
    }),
    {
      name: 'holsi-pills-storage',
    }
  )
)
