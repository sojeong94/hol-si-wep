import Anthropic from '@anthropic-ai/sdk'
import dotenv from 'dotenv'

dotenv.config()

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type Platform = 'twitter' | 'threads' | 'instagram' | 'youtube' | 'tiktok' | 'naver'

const TOPICS = [
  // ── 생리/호르몬 ──────────────────────────────────────────────
  '생리통이 심한 이유와 완화법',
  '황체기 PMS — 왜 예민해지는지',
  '배란기에 몸이 보내는 신호',
  '생리 중 꼭 챙겨야 할 영양소',
  '마그네슘이 PMS에 효과적인 이유',
  '호르몬 밸런스와 수면의 관계',
  '생리 불순이 생기는 원인',
  '철분 부족과 생리의 관계',
  '생리 주기를 예측하면 뭐가 좋은지',
  '주기별 맞춤 영양제 복용법',

  // ── 영양제 조합/복용법 ────────────────────────────────────────
  '칼슘과 마그네슘 같이 먹으면 안 되는 이유',
  '철분 흡수율을 높이는 비타민C 조합법',
  '오메가3 언제 먹어야 가장 효과적인지',
  '유산균 공복 vs 식후 언제 먹어야 할까',
  '비타민D와 K2를 함께 먹어야 하는 이유',
  '영양제 먹는 순서가 효과를 바꾼다',
  '아연과 구리 — 함께 먹으면 독이 되는 조합',
  '콜라겐 흡수율 높이는 복용 타이밍',
  '여성이 꼭 챙겨야 할 영양제 TOP 5',
  '공복에 먹으면 안 되는 영양제 종류',

  // ── 다이어트/체형관리 ─────────────────────────────────────────
  '여성 다이어트에 효과적인 영양제 조합',
  '생리 주기별 다이어트 전략 — 언제 빠지는지',
  '식욕 폭발하는 황체기 다이어트 꿀팁',
  '카르니틴이 체지방 감소에 효과적인 이유',
  '다이어트 중 근손실 막는 단백질 섭취법',
  '체중 감량을 방해하는 호르몬 불균형',
  'CLA와 공액리놀레산 여성 다이어트 효과',
  '부종 빠지는 영양소 — 칼륨과 마그네슘',

  // ── 임신/임산부 ───────────────────────────────────────────────
  '임산부가 반드시 챙겨야 할 엽산 복용법',
  '임신 중 철분제 언제부터 얼마나 먹어야 할까',
  '임산부 오메가3 DHA — 태아 뇌 발달과의 관계',
  '임신 중 먹으면 안 되는 영양제와 허브',
  '임산부 변비에 좋은 영양소와 식이섬유',
  '입덧 심할 때 비타민B6가 도움이 되는 이유',
  '임신 중 칼슘 부족이 산모에게 미치는 영향',
  '출산 후 빠른 회복을 위한 영양제 루틴',

  // ── 육아/수유 ─────────────────────────────────────────────────
  '모유 수유 중 챙겨야 할 영양소 총정리',
  '수유 중 먹어도 안전한 영양제 vs 주의해야 할 것',
  '산후 탈모 막는 영양제 — 철분과 비오틴',
  '육아 피로를 줄여주는 마그네슘과 코엔자임Q10',
  '아이 면역력 높이는 엄마의 유산균 섭취법',
  '산후우울증과 오메가3의 연관성',

  // ── 폐경/갱년기 ───────────────────────────────────────────────
  '갱년기 증상을 완화하는 이소플라본 효과',
  '폐경 후 골다공증 예방하는 칼슘과 비타민D',
  '갱년기 열감(홍조)에 효과적인 영양소',
  '폐경 전후 호르몬 변화와 영양 전략',
  '갱년기 수면 장애 — 마그네슘과 멜라토닌',
  '갱년기 체중 증가 막는 영양제와 생활습관',
  '폐경 후 피부 탄력 유지하는 콜라겐 섭취법',

  // ── 피부/미용 ─────────────────────────────────────────────────
  '생리 전 피부 트러블 줄이는 영양소',
  '피부 속 보습을 채우는 히알루론산 효과',
  '비타민C 고용량 피부 미백 효과와 복용법',
  '탈모 막는 비오틴 — 얼마나 먹어야 할까',
  '여드름성 피부에 좋은 아연 복용법',

  // ── 피로/스트레스 ─────────────────────────────────────────────
  '만성 피로에 효과적인 코엔자임Q10',
  '직장인 여성의 번아웃과 부신 피로 영양 전략',
  '스트레스로 소모되는 영양소 — 마그네슘과 비타민C',
  '수면의 질을 높이는 마그네슘 글리시네이트',
  '집중력과 기억력을 높이는 오메가3 DHA',
]

function pickTopic(): string {
  return TOPICS[Math.floor(Math.random() * TOPICS.length)]
}

const PLATFORM_GUIDE: Record<Platform, string> = {
  twitter: `트위터(X) 게시글. 규칙:
- 150자 이내 (링크 포함)
- 이모지 사용 금지
- 형식: 많은 사람들이 공감하는 생리/호르몬 경험을 짧고 강하게. 질문형 또는 공감형으로 바이럴 유도. 경험 나눔을 유도하는 문장.
- 해시태그 2-3개를 본문 끝에 (주제와 직접 관련된 것 + 트래픽 높은 것 혼합)
- 마지막 줄: https://hol-si.com?utm_source=twitter&utm_medium=social&utm_campaign=silo`,

  threads: `스레드 게시글. 규칙:
- 300자 내외
- 이모지 사용 금지
- 형식:
  첫 줄: 주제 관련 해시태그 1개
  본문: 공감형 경험 나눔 또는 질문형, 친근한 반말체, 줄바꿈 활용해 읽기 쉽게
  끝에서 2-3줄: 해시태그 2-3개 + https://hol-si.com?utm_source=threads&utm_medium=social&utm_campaign=silo
- 해시태그는 주제 관련 + 트래픽 높은 태그 혼합`,

  instagram: `인스타그램 카드뉴스 4장. 규칙:
- 이모지 사용 금지
- 반드시 "---"로만 장을 구분 (레이블, 번호, "1장" 같은 표기 절대 금지)
- 장당 핵심 문구만, 20자 이내
- 구성 순서:
  첫 번째: 시선을 끄는 질문 또는 충격적 사실 한 줄 (HOOK)
  두 번째: 공감 또는 문제 제시 한 줄 (INTRO)
  세 번째: 핵심 정보 3-4개, 줄바꿈으로 구분, 각 줄 15자 이내 (CORE)
  네 번째: 행동 유도 + 홀시 앱 언급 한 줄 (CTA)
출력 예시 (이 형식 그대로):
생리통, 왜 이렇게 심할까?
---
매달 찾아오는 고통이 당연한 건 아니야
---
마그네슘 부족이 원인
철분도 같이 챙겨야 해
오메가3 함께 먹으면 효과 두 배
---
홀시로 내 주기 맞춤 관리 시작해봐`,

  youtube: `YouTube Shorts 영상 대본. 규칙:
- 이모지 사용 금지
- 해시태그 없음 (description에 별도 추가)
- 첫 줄: 영상 제목. 검색 키워드 포함, 20자 이내, 호기심 자극
- 본문: 40-60초 분량(350자 내외), 자연스러운 구어체, 핵심 정보 전달, TTS로 읽히는 문장
- 문장은 짧고 명확하게`,

  naver: `네이버 블로그 포스트. 규칙:
- 이모지 사용 금지
- 첫 줄: SEO 최적화 제목 (키워드 포함, 30자 이내)
- 빈 줄 1개 후 본문 시작
- 본문 700-1000자, 자연스러운 구어체
- 소제목은 [소제목] 형식으로 구분
- 구성:
  도입부: 공감형 도입 (100자 내외)
  [소제목1]: 원인/배경 설명 (200자 내외)
  [소제목2]: 핵심 정보/해결법 (200자 내외)
  [소제목3]: 실천 방법 (200자 내외)
  마무리: 홀시 앱 언급 + https://hol-si.com?utm_source=naver_blog&utm_medium=blog&utm_campaign=silo (100자 내외)
- 마지막: 해시태그 5-7개 (#생리주기 #여성건강 등)`,

  tiktok: `TikTok 영상 대본. 규칙:
- 이모지 사용 금지
- 해시태그 없음
- 첫 줄: 영상 제목. 20자 이내, 강한 임팩트
- 본문: 30-40초 분량(250자 내외), 강렬한 첫 문장으로 시작, 20대 공감 구어체
- 문장은 짧고 리듬감 있게`,
}

export interface ContentOptions {
  keyword?: string   // 구글 시트에서 가져온 메인 키워드
  title?: string     // 구글 시트에서 가져온 제목
}

const COUPANG_PARTNER_ID = process.env.COUPANG_PARTNER_ID ?? 'AF6147593'

// 키워드 기반 쿠팡 파트너스 검색 링크 생성
export function coupangLink(keyword: string): string {
  const encoded = encodeURIComponent(keyword)
  return `https://www.coupang.com/np/search?q=${encoded}&channel=user&subId1=${COUPANG_PARTNER_ID}`
}

// 플랫폼별 쿠팡 링크 삽입 지원 여부
// youtube는 publisher에서 description에 직접 추가
const SUPPORTS_COUPANG: Partial<Record<Platform, boolean>> = {
  threads: true,
  naver: true,
  // twitter: 150자 제한으로 제외
  // instagram/tiktok: 캡션 링크 클릭 안 됨
}

export async function generateContent(platform: Platform, options?: ContentOptions): Promise<string> {
  const topic = options?.keyword
    ? options.title
      ? `${options.keyword} — ${options.title}`
      : options.keyword
    : pickTopic()

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `너는 '홀시(hol-si.com)' 여성 건강 앱 SNS 담당자야.

주제/키워드: ${topic}
플랫폼 규칙: ${PLATFORM_GUIDE[platform]}

추가 조건:
- 홀시 앱을 홍보하되 광고처럼 느껴지지 않게
- 해시태그는 주제와 직접 관련된 것 + 현재 트래픽이 높은 태그 혼합
- 텍스트만 출력 (설명, 따옴표, 플랫폼명 없이)`,
      },
    ],
  })

  let text = (msg.content[0] as Anthropic.TextBlock).text.trim()

  // 쿠팡 파트너스 링크 자동 삽입 (지원 플랫폼만)
  if (SUPPORTS_COUPANG[platform] && options?.keyword) {
    const link = coupangLink(options.keyword)
    const label = `\n\n이 글의 추천 제품 → ${link}\n※ 파트너스 활동으로 수수료를 받을 수 있습니다`
    text += label
  }

  return text
}
