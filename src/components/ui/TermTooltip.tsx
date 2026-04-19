import { useState, useEffect, useRef } from 'react'

const DEFINITIONS: Record<string, string> = {
  'PMS': '생리 7~14일 전, 감정 기복·붓기·우울이 오는 시기',
  '황체기': '배란 후~생리 전, 프로게스테론이 높아지는 시기',
  '난포기': '생리 후~배란 전, 에스트로겐이 올라 컨디션 최고',
  '배란': '난자가 나오는 날, 주기 중간으로 에너지가 가장 높아요',
  '에스트로겐': '기분·피부·에너지를 조절하는 여성 호르몬',
  '황체호르몬': '배란 후 분비, 이 호르몬이 PMS를 유발해요',
  '생리불순': '주기가 21일 이하 or 35일 이상으로 불규칙한 상태',
}

function getSeenTerms(): Set<string> {
  try {
    const raw = localStorage.getItem('holsi-seen-terms')
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}

function markTermSeen(term: string) {
  try {
    const seen = getSeenTerms()
    seen.add(term)
    localStorage.setItem('holsi-seen-terms', JSON.stringify([...seen]))
  } catch {}
}

interface TermTooltipProps {
  term: string
}

export function TermTooltip({ term }: TermTooltipProps) {
  const def = DEFINITIONS[term]
  if (!def) return <span>{term}</span>

  const [visible, setVisible] = useState(false)
  const [seen, setSeen] = useState(() => getSeenTerms().has(term))
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTap = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!visible) {
      setVisible(true)
      if (!seen) { markTermSeen(term); setSeen(true) }
      timerRef.current = setTimeout(() => setVisible(false), 2500)
    } else {
      setVisible(false)
    }
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <span className="relative inline-block">
      <button
        onClick={handleTap}
        className={`transition-all leading-none active:scale-95 active:opacity-70 ${!seen ? 'border-b border-dashed border-pink-400/50' : ''}`}
      >
        {term}
      </button>
      {visible && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 whitespace-nowrap bg-zinc-800/95 border border-zinc-700 text-zinc-300 text-[11px] px-3 py-1.5 rounded-lg shadow-xl pointer-events-none animate-in fade-in duration-150">
          {def}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-700" />
        </span>
      )}
    </span>
  )
}
