import { useEffect, useState } from 'react'
import { Crown, Check, X, Loader2, RotateCcw } from 'lucide-react'
import { useSubscriptionStore } from '@/store/useSubscriptionStore'
import type { PurchasesPackage } from '@revenuecat/purchases-capacitor'
import { Capacitor } from '@capacitor/core'

const FEATURES = [
  'AI 상담 무제한 (생리통, 영양제, 호르몬)',
  'OCR 스캐너 무제한 (과거 기록 사진 인식)',
  '광고 없는 깨끗한 화면',
  '모든 신규 기능 최우선 제공',
]

function getMonthlyPrice(pkg: PurchasesPackage): string {
  return pkg.product.priceString ?? '₩4,900'
}

function getAnnualPrice(pkg: PurchasesPackage): string {
  return pkg.product.priceString ?? '₩39,900'
}

function getAnnualMonthly(pkg: PurchasesPackage): string {
  const price = pkg.product.price
  if (!price) return '₩3,325'
  const monthly = Math.round(price / 12)
  return `₩${monthly.toLocaleString()}`
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function SubscriptionModal({ isOpen, onClose }: Props) {
  const { packages, isLoading, isPremium, loadPackages, purchase, restore } = useSubscriptionStore()
  const [selected, setSelected] = useState<'annual' | 'monthly'>('annual')
  const [restoring, setRestoring] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    if (isOpen) loadPackages()
  }, [isOpen])

  useEffect(() => {
    if (isPremium && isOpen) {
      setSuccessMsg('프리미엄이 활성화됐어요!')
      setTimeout(() => { setSuccessMsg(''); onClose() }, 1800)
    }
  }, [isPremium])

  if (!isOpen) return null

  const monthlyPkg = packages.find(p =>
    p.packageType === 'MONTHLY' || p.identifier.toLowerCase().includes('monthly')
  )
  const annualPkg = packages.find(p =>
    p.packageType === 'ANNUAL' || p.identifier.toLowerCase().includes('annual')
  )

  const selectedPkg = selected === 'annual' ? annualPkg : monthlyPkg

  const handlePurchase = async () => {
    if (!selectedPkg) return
    const ok = await purchase(selectedPkg)
    if (!ok && !isPremium) {
      // 취소됐거나 에러 (이미 isPremium useEffect에서 처리)
    }
  }

  const handleRestore = async () => {
    setRestoring(true)
    const ok = await restore()
    setRestoring(false)
    if (!ok) alert('복원할 구독을 찾지 못했어요.')
  }

  const isNative = Capacitor.isNativePlatform()

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-900 rounded-t-3xl border-t border-zinc-800 pb-safe animate-in slide-in-from-bottom-8 duration-300"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="relative bg-gradient-to-r from-[#ff2a7a]/90 to-rose-500/80 rounded-t-3xl px-6 pt-6 pb-5">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 bg-black/20 rounded-full text-white/80"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
              <Crown size={22} className="text-white" />
            </div>
            <div>
              <p className="text-white/70 text-xs font-bold tracking-wider uppercase">Holsi</p>
              <h2 className="text-white text-xl font-black leading-tight">프리미엄</h2>
            </div>
          </div>
          <p className="text-white/80 text-sm font-medium mt-2">14일 무료 체험 후 자동 결제</p>
        </div>

        <div className="px-6 pt-5 space-y-4">
          {/* 기능 리스트 */}
          <div className="space-y-2.5">
            {FEATURES.map(f => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[#ff2a7a]/15 border border-[#ff2a7a]/30 flex items-center justify-center shrink-0">
                  <Check size={12} className="text-[#ff2a7a]" strokeWidth={3} />
                </div>
                <span className="text-zinc-300 text-sm font-medium">{f}</span>
              </div>
            ))}
          </div>

          {/* 플랜 선택 */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* 연간 */}
            <button
              onClick={() => setSelected('annual')}
              className={`relative p-4 rounded-2xl border-2 text-left transition-all ${
                selected === 'annual'
                  ? 'border-[#ff2a7a] bg-[#ff2a7a]/10'
                  : 'border-zinc-700 bg-zinc-800'
              }`}
            >
              <span className="absolute -top-2.5 left-3 bg-[#ff2a7a] text-white text-[10px] font-black px-2 py-0.5 rounded-full tracking-wide">
                32% 절약
              </span>
              <p className="text-white font-black text-base mt-1">
                {annualPkg ? getAnnualPrice(annualPkg) : '₩39,900'}
              </p>
              <p className="text-zinc-400 text-xs font-medium mt-0.5">
                /년 · 월 {annualPkg ? getAnnualMonthly(annualPkg) : '₩3,325'}
              </p>
            </button>

            {/* 월간 */}
            <button
              onClick={() => setSelected('monthly')}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${
                selected === 'monthly'
                  ? 'border-[#ff2a7a] bg-[#ff2a7a]/10'
                  : 'border-zinc-700 bg-zinc-800'
              }`}
            >
              <p className="text-white font-black text-base mt-1">
                {monthlyPkg ? getMonthlyPrice(monthlyPkg) : '₩4,900'}
              </p>
              <p className="text-zinc-400 text-xs font-medium mt-0.5">/월</p>
            </button>
          </div>

          {/* CTA */}
          {successMsg ? (
            <div className="w-full py-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-center text-sm">
              {successMsg}
            </div>
          ) : (
            <button
              onClick={handlePurchase}
              disabled={isLoading || !isNative || (!monthlyPkg && !annualPkg)}
              className="w-full py-4 rounded-2xl bg-[#ff2a7a] disabled:opacity-50 text-white font-black text-base shadow-lg shadow-pink-600/30 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <Crown size={18} />
                  {!isNative ? '기기에서만 구독 가능' : '14일 무료 체험 시작'}
                </>
              )}
            </button>
          )}

          {/* 복원 + 안내 */}
          <div className="flex items-center justify-center gap-4 pb-1">
            <button
              onClick={handleRestore}
              disabled={restoring || isLoading}
              className="flex items-center gap-1.5 text-zinc-500 text-xs font-medium active:text-zinc-300"
            >
              <RotateCcw size={12} className={restoring ? 'animate-spin' : ''} />
              구매 복원
            </button>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-600 text-xs">언제든지 취소 가능</span>
          </div>
        </div>
      </div>
    </div>
  )
}
