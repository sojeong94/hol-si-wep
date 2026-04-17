import { create } from 'zustand'
import { Capacitor } from '@capacitor/core'
import type { PurchasesPackage } from '@revenuecat/purchases-capacitor'

const ENTITLEMENT_ID = 'premium'

function isActive(customerInfo: any): boolean {
  return !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]
}

interface SubscriptionStore {
  isPremium: boolean
  isLoading: boolean
  packages: PurchasesPackage[]
  initialized: boolean
  showPaywall: boolean
  setShowPaywall: (show: boolean) => void
  initialize: () => Promise<void>
  loadPackages: () => Promise<void>
  purchase: (pkg: PurchasesPackage) => Promise<boolean>
  restore: () => Promise<boolean>
  checkStatus: () => Promise<void>
}

export const useSubscriptionStore = create<SubscriptionStore>((set, get) => ({
  isPremium: false,
  isLoading: false,
  packages: [],
  initialized: false,
  showPaywall: false,

  setShowPaywall: (show) => set({ showPaywall: show }),

  initialize: async () => {
    if (!Capacitor.isNativePlatform()) return
    if (get().initialized) return
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor')
      const apiKey = Capacitor.getPlatform() === 'ios'
        ? 'appl_pMKnJpSZOUZkljTJsICdYqFJgTu'
        : 'test_DwFyRdVueCGMreGJGinGSWgpLzp'
      await Purchases.configure({ apiKey })
      const { customerInfo } = await Purchases.getCustomerInfo()
      set({ initialized: true, isPremium: isActive(customerInfo) })
      Purchases.addCustomerInfoUpdateListener((customerInfo: any) => {
        set({ isPremium: isActive(customerInfo) })
      })
    } catch (e) {
      console.error('[RC] init error', e)
      set({ initialized: true })
    }
  },

  loadPackages: async () => {
    if (!Capacitor.isNativePlatform()) return
    if (get().packages.length > 0) return
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor')
      const offerings = await Purchases.getOfferings()
      const pkgs = offerings.current?.availablePackages ?? []
      set({ packages: pkgs })
    } catch (e) {
      console.error('[RC] offerings error', e)
    }
  },

  purchase: async (pkg: PurchasesPackage): Promise<boolean> => {
    set({ isLoading: true })
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor')
      const result = await Purchases.purchasePackage({ aPackage: pkg })
      const premium = isActive(result.customerInfo)
      set({ isPremium: premium, isLoading: false })
      return premium
    } catch (e: any) {
      if (!e?.userCancelled) console.error('[RC] purchase error', e)
      set({ isLoading: false })
      return false
    }
  },

  restore: async (): Promise<boolean> => {
    set({ isLoading: true })
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor')
      const { customerInfo } = await Purchases.restorePurchases()
      const premium = isActive(customerInfo)
      set({ isPremium: premium, isLoading: false })
      return premium
    } catch (e) {
      console.error('[RC] restore error', e)
      set({ isLoading: false })
      return false
    }
  },

  checkStatus: async () => {
    if (!Capacitor.isNativePlatform()) return
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor')
      const { customerInfo } = await Purchases.getCustomerInfo()
      set({ isPremium: isActive(customerInfo) })
    } catch (e) {
      console.error('[RC] checkStatus error', e)
    }
  },
}))
