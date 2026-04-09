import Anthropic from '@anthropic-ai/sdk'
import dotenv from 'dotenv'

dotenv.config()

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type Platform = 'twitter' | 'threads'

// 홀시 콘텐츠 주제 풀 — 매번 다른 주제 순환
const TOPICS = [
  '생리 주기 예측이 왜 중요한지',
  '황체기 PMS 증상 완화 팁',
  '배란기에 몸이 보내는 신호',
  '생리 중 꼭 챙겨야 할 영양소',
  '주기별 맞춤 영양제 복용법',
  '호르몬 밸런스와 수면의 관계',
  '생리통을 줄이는 생활 습관',
  '마그네슘이 PMS에 효과적인 이유',
  '생리 불순 신호와 대처법',
  '철분 부족이 생리에 미치는 영향',
]

function pickTopic(): string {
  return TOPICS[Math.floor(Math.random() * TOPICS.length)]
}

const PLATFORM_GUIDE: Record<Platform, string> = {
  twitter: '트위터(X) 게시글: 200자 이내 (해시태그+링크 포함), 핵심만 임팩트 있게, 해시태그 최대 3개',
  threads: '스레드 게시글: 350자 이내, 친근하고 공감 가는 말투, 해시태그 5개 이하',
}

export async function generateContent(platform: Platform): Promise<string> {
  const topic = pickTopic()

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `너는 '홀시(hol-si.com)' 여성 건강 앱 SNS 담당자야.

주제: ${topic}
플랫폼 규칙: ${PLATFORM_GUIDE[platform]}

조건:
- 마지막 줄에 반드시 "👉 https://hol-si.com" 포함
- 해시태그는 #여성건강 #홀시 포함, 주제에 맞는 태그 추가
- 공감 가는 자연스러운 반말체
- 홀시 앱을 홍보하되 광고처럼 느껴지지 않게
- 텍스트만 출력 (설명, 따옴표 없이)`,
      },
    ],
  })

  return (msg.content[0] as Anthropic.TextBlock).text.trim()
}
