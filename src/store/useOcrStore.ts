import { create } from 'zustand'

export interface OcrAnalyzedRecord {
  id: string // UUID 등 고유 식별자 (Supabase ID 매칭용)
  user_id?: string // 추후 Auth 연동용
  startDate: string // YYYY-MM-DD
  endDate: string | null // YYYY-MM-DD
  confidence: number // 0~100 (OCR 텍스트 인식 신뢰도)
  sourceImage?: string // 원본 이미지 레퍼런스 (선택)
}

interface OcrState {
  isAnalyzing: boolean
  analyzedRecords: OcrAnalyzedRecord[]
  setAnalyzing: (status: boolean) => void
  setAnalyzedRecords: (records: OcrAnalyzedRecord[]) => void
  addAnalyzedRecord: (record: OcrAnalyzedRecord) => void
  removeAnalyzedRecord: (id: string) => void
  clearAnalyzedRecords: () => void
}

export const useOcrStore = create<OcrState>()((set) => ({
  isAnalyzing: false,
  analyzedRecords: [],
  setAnalyzing: (status) => set({ isAnalyzing: status }),
  setAnalyzedRecords: (records) => set({ analyzedRecords: records }),
  addAnalyzedRecord: (record) => set((state) => ({ 
    analyzedRecords: [...state.analyzedRecords, record] 
  })),
  removeAnalyzedRecord: (id) => set((state) => ({ 
    analyzedRecords: state.analyzedRecords.filter(r => r.id !== id) 
  })),
  clearAnalyzedRecords: () => set({ analyzedRecords: [] })
}))
