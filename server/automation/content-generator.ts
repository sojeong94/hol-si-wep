import Anthropic from '@anthropic-ai/sdk'
import dotenv from 'dotenv'

dotenv.config()

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type Platform = 'twitter' | 'threads' | 'instagram' | 'youtube' | 'tiktok' | 'naver'

const TOPICS = [
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
- 마지막 줄: https://hol-si.com`,

  threads: `스레드 게시글. 규칙:
- 300자 내외
- 이모지 사용 금지
- 형식:
  첫 줄: 주제 관련 해시태그 1개
  본문: 공감형 경험 나눔 또는 질문형, 친근한 반말체, 줄바꿈 활용해 읽기 쉽게
  끝에서 2-3줄: 해시태그 2-3개 + https://hol-si.com
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
  마무리: 홀시 앱 언급 + https://hol-si.com (100자 내외)
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

  return (msg.content[0] as Anthropic.TextBlock).text.trim()
}
