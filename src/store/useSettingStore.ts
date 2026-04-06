import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingState {
  pushEnabled: boolean
  defaultCycle: number
  defaultPeriodDays: number
  isManualCycle: boolean
  manualCycleDays: number
  manualPeriodDays: number
  userName: string
  setPushEnabled: (enabled: boolean) => void
  setDefaultCycle: (days: number) => void
  setDefaultPeriodDays: (days: number) => void
  setIsManualCycle: (manual: boolean) => void
  setManualCycleDays: (days: number) => void
  setManualPeriodDays: (days: number) => void
  setUserName: (name: string) => void
}

export const useSettingStore = create<SettingState>()(
  persist(
    (set) => ({
      pushEnabled: false,
      defaultCycle: 28,
      defaultPeriodDays: 5,
      isManualCycle: false,
      manualCycleDays: 28,
      manualPeriodDays: 5,
      userName: '',
      setPushEnabled: (enabled) => set({ pushEnabled: enabled }),
      setDefaultCycle: (days) => set({ defaultCycle: days }),
      setDefaultPeriodDays: (days) => set({ defaultPeriodDays: days }),
      setIsManualCycle: (manual) => set({ isManualCycle: manual }),
      setManualCycleDays: (days) => set({ manualCycleDays: days }),
      setManualPeriodDays: (days) => set({ manualPeriodDays: days }),
      setUserName: (name) => set({ userName: name }),
    }),
    {
      name: 'holsi-settings-storage',
    }
  )
)
