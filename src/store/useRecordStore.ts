import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface DailySymptom {
  flow?: 'light' | 'normal' | 'heavy'
  pain?: number  // 0~5
  memo?: string
}

export interface MenstrualRecord {
  id: string
  startDate: string   // YYYY-MM-DD
  endDate: string | null  // YYYY-MM-DD
  flow?: 'light' | 'normal' | 'heavy'  // 기존 호환
  pain?: number  // 기존 호환
  memo?: string  // 기존 호환
  condition?: string  // 기존 호환
  dailySymptoms?: Record<string, DailySymptom>  // key: YYYY-MM-DD
}

interface RecordState {
  records: MenstrualRecord[]
  addRecord: (startDate: string, autoEndDate?: string) => void
  endRecord: (id: string, endDate: string | null) => void
  removeRecord: (id: string) => void
  updateCondition: (id: string, condition: string) => void
  updateSymptom: (id: string, data: Partial<Pick<MenstrualRecord, 'flow' | 'pain' | 'memo'>>) => void
  updateDailySymptom: (id: string, date: string, data: Partial<DailySymptom>) => void
}

export const useRecordStore = create<RecordState>()(
  persist(
    (set) => ({
      records: [],
      addRecord: (startDate, autoEndDate) =>
        set((state) => ({
          records: [
            ...state.records,
            {
              id: Date.now().toString(),
              startDate,
              endDate: autoEndDate ?? null,
            },
          ],
        })),
      endRecord: (id, endDate) =>
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, endDate } : r
          ),
        })),
      removeRecord: (id) =>
        set((state) => ({
          records: state.records.filter((r) => r.id !== id),
        })),
      updateCondition: (id, condition) =>
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, condition } : r
          ),
        })),
      updateSymptom: (id, data) =>
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, ...data } : r
          ),
        })),
      updateDailySymptom: (id, date, data) =>
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id
              ? {
                  ...r,
                  dailySymptoms: {
                    ...r.dailySymptoms,
                    [date]: { ...r.dailySymptoms?.[date], ...data },
                  },
                }
              : r
          ),
        })),
    }),
    {
      name: 'holsi-records-storage',
    }
  )
)
