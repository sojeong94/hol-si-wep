import { ExternalLink } from 'lucide-react'

export interface Recommendation {
  name: string
  reason: string
  keyword: string
  cta?: string
}

function coupangUrl(keyword: string): string {
  const partnerId = import.meta.env.VITE_COUPANG_PARTNER_ID ?? ''
  const encoded = encodeURIComponent(keyword)
  if (partnerId) {
    return `https://www.coupang.com/np/search?q=${encoded}&channel=user&subId1=${partnerId}`
  }
  return `https://www.coupang.com/np/search?q=${encoded}&channel=user`
}

const DEFAULT_CTAS = ['핫딜 보기', '최저가 확인', '끝딜 잡기', '바로 가기', '지금 주문']

interface RecommendCardsProps {
  recommendations: Recommendation[]
  label?: string
}

export function RecommendCards({ recommendations }: RecommendCardsProps) {
  if (!recommendations || recommendations.length === 0) return null

  return (
    <div className="mt-4 space-y-2" style={{ fontFamily: '"Gowun Dodum", sans-serif' }}>
      {recommendations.map((item, i) => {
        const ctaText = item.cta || DEFAULT_CTAS[i % DEFAULT_CTAS.length]
        return (
          <a
            key={i}
            href={coupangUrl(item.keyword)}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="flex items-center justify-between gap-2 bg-zinc-900/40 backdrop-blur-md border border-zinc-800/80 hover:border-zinc-600 rounded-2xl px-4 py-4 transition-all group active:scale-[0.98]"
          >
            <div className="min-w-0 flex-1 pr-2">
              <p className="font-bold text-[16px] text-zinc-50 leading-snug group-hover:text-white transition-colors line-clamp-1 break-keep tracking-tight">
                {item.name}
              </p>
              <p className="text-[13px] font-medium text-zinc-400 mt-1.5 leading-relaxed line-clamp-2 break-keep">
                {item.reason}
              </p>
            </div>
            <div className="shrink-0 flex items-center justify-center gap-1.5 bg-pink-500/10 text-pink-400 border border-pink-500/30 text-[12px] font-semibold w-[90px] h-[36px] rounded-[10px] whitespace-nowrap group-hover:bg-[var(--color-primary)] group-hover:text-white group-hover:border-transparent group-hover:shadow-[0_0_15px_rgba(255,42,122,0.4)] transition-all">
              {ctaText} <ExternalLink size={11} strokeWidth={2.5} />
            </div>
          </a>
        )
      })}
      <p className="text-right text-[9px] text-zinc-700 pr-1">파트너스 활동으로 수수료를 받을 수 있습니다</p>
    </div>
  )
}
