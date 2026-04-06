import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface MenstrualRecord {
  id: string
  startDate: string // YYYY-MM-DD
  endDate: string | null // YYYY-MM-DD
  condition?: string
}

interface RecordState {
  records: MenstrualRecord[]
  addRecord: (startDate: string) => void
  endRecord: (id: string, endDate: string | null) => void
  removeRecord: (id: string) => void
  updateCondition: (id: string, condition: string) => void
}

export const useRecordStore = create<RecordState>()(
  persist(
    (set) => ({
      records: [],
      addRecord: (startDate) =>
        set((state) => ({
          records: [
             ...state.records, 
            { id: Date.now().toString(), startDate, endDate: null }
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
        }))
    }),
    {
      name: 'holsi-records-storage',
    }
  )
)
