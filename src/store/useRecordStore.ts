import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface MenstrualRecord {
  id: string
  startDate: string   // YYYY-MM-DD
  endDate: string | null  // YYYY-MM-DD
  flow?: 'light' | 'normal' | 'heavy'  // 유량
  pain?: number  // 0~5
  memo?: string  // 메모
  condition?: string  // 기존 호환
}

interface RecordState {
  records: MenstrualRecord[]
  addRecord: (startDate: string, autoEndDate?: string) => void
  endRecord: (id: string, endDate: string | null) => void
  removeRecord: (id: string) => void
  updateCondition: (id: string, condition: string) => void
  updateSymptom: (id: string, data: Partial<Pick<MenstrualRecord, 'flow' | 'pain' | 'memo'>>) => void
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
    }),
    {
      name: 'holsi-records-storage',
    }
  )
)
