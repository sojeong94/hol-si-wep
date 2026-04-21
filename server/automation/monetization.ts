import dotenv from 'dotenv'
dotenv.config()

const PARTNER_ID = process.env.VITE_COUPANG_PARTNER_ID ?? 'AF6147593'
const GOOGLE_FORM_URL = process.env.GOOGLE_FORM_URL ?? 'https://forms.gle/holsi'

// 키워드 → 쿠팡 검색어 매핑
const KEYWORD_PRODUCT_MAP: [string, string][] = [
  ['생리통',    '생리통 진통제 이부프로펜'],
  ['마그네슘',  '여성 마그네슘 영양제'],
  ['철분',      '여성 철분제 헤모큐'],
  ['오메가3',   '오메가3 여성'],
  ['비타민',    '여성 멀티비타민'],
  ['PMS',       'PMS 영양제'],
  ['호르몬',    '여성 호르몬 영양제'],
  ['배란',      '배란테스트기'],
  ['생리 불순', '생리 불순 영양제'],
  ['수면',      '수면 멜라토닌 영양제'],
  ['다이어트',  '여성 다이어트 보조제'],
  ['영양소',    '여성 종합비타민'],
]

function findProduct(keyword: string): string {
  const kw = keyword.toLowerCase()
  for (const [key, product] of KEYWORD_PRODUCT_MAP) {
    if (kw.includes(key.toLowerCase())) return product
  }
  return '여성 건강 영양제'
}

export function buildCoupangLink(keyword: string): string {
  const product = findProduct(keyword)
  const searchUrl = `https://www.coupang.com/np/search?q=${encodeURIComponent(product)}&channel=user`
  return `https://link.coupang.com/a/${PARTNER_ID}?url=${encodeURIComponent(searchUrl)}`
}

// 네이버 블로그용 수익화 블록 (풀 버전)
export function naverMonetizationBlock(keyword: string): string {
  const product = findProduct(keyword)
  const coupangLink = buildCoupangLink(keyword)
  return [
    '',
    '---',
    '',
    `[이 글과 함께 챙기면 좋은 제품]`,
    `${product} 바로가기 → ${coupangLink}`,
    '',
    `※ 이 링크는 쿠팡 파트너스 활동의 일환으로, 일정액의 수수료를 제공받습니다.`,
    '',
    '---',
    '',
    `주기 관련 더 궁금한 점이 있다면 아래 링크로 문의해주세요.`,
    `홀몬언니와 홀몬 시스터즈가 직접 답변드립니다 → ${GOOGLE_FORM_URL}`,
    '',
  ].join('\n')
}

// SNS (YouTube, TikTok) description 하단 CTA
export function snsCTABlock(keyword: string): string {
  const coupangLink = buildCoupangLink(keyword)
  return [
    '',
    `🛒 관련 제품 추천: ${coupangLink}`,
    `💬 홀몬언니에게 문의: ${GOOGLE_FORM_URL}`,
    `※ 쿠팡 파트너스 활동으로 수수료를 제공받습니다.`,
  ].join('\n')
}
