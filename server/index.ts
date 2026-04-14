import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import Anthropic from '@anthropic-ai/sdk'
import webpush from 'web-push'
import cron from 'node-cron'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import authRouter from './auth.js'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()

// ─── CORS 화이트리스트 ─────────────────────────────────────────────────────
// ALLOWED_ORIGINS 미설정 시: 개발용으로 전체 허용 (localhost 테스트 편의)
// 배포 시 ALLOWED_ORIGINS="https://holsi.app,https://www.holsi.app" 형태로 지정할 것
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',').map(s => s.trim()).filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true) // curl, 서버간 요청, 동일 출처
    if (allowedOrigins.length === 0) return cb(null, true) // 화이트리스트 미설정 = 전체 허용 (dev)
    if (allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: ${origin} not allowed`))
  },
}))

app.use(express.json({ limit: '2mb' })) // OCR 이미지 고려하여 2mb (클라에서 1024px 압축 후 ~300KB)

// ─── Auth 라우터 ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter)

// ─── 간단한 in-memory rate limiter (Claude 비용 보호용) ────────────────────
type RateEntry = { count: number; resetAt: number }
const rateLimitMap = new Map<string, RateEntry>()
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of rateLimitMap) if (v.resetAt < now) rateLimitMap.delete(k)
}, 60_000).unref?.()

function rateLimit(max: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = `${req.ip}:${req.path}`
    const now = Date.now()
    const entry = rateLimitMap.get(key)
    if (!entry || entry.resetAt < now) {
      rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }
    if (entry.count >= max) {
      return res.status(429).json({ error: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.' })
    }
    entry.count++
    next()
  }
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Web Push 설정 ────────────────────────────────────────────────────────────
webpush.setVapidDetails(
  'mailto:holsi@holsi.app',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

interface PillInfo {
  id: string
  name: string
  time: string
  days: number[]
  isActive: boolean
}

interface Subscription {
  endpoint: string
  p256dh: string
  auth: string
  pills: PillInfo[]
}

// SUBS_FILE 은 환경변수로 override 가능 (배포시 영속 볼륨 경로 지정)
const SUBS_FILE = process.env.SUBS_FILE_PATH ?? path.join(__dirname, 'subscriptions.json')

function loadSubscriptions(): Subscription[] {
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')) } catch { return [] }
}

// crash-atomic write: 임시 파일에 쓰고 rename (POSIX 에서 atomic)
function saveSubscriptions(subs: Subscription[]) {
  const tmp = `${SUBS_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(subs, null, 2), 'utf8')
  fs.renameSync(tmp, SUBS_FILE)
}

// ─── Push payload validators ─────────────────────────────────────────────
function isNonEmptyString(v: unknown, max = 1000): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= max
}
function sanitizePills(raw: unknown): PillInfo[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((p: any) =>
      p &&
      typeof p.id === 'string' && p.id.length <= 50 &&
      typeof p.name === 'string' && p.name.length <= 100 &&
      typeof p.time === 'string' && /^\d{2}:\d{2}$/.test(p.time) &&
      Array.isArray(p.days) && p.days.every((d: any) => Number.isInteger(d) && d >= 0 && d <= 6)
    )
    .slice(0, 100)
    .map((p: any) => ({
      id: String(p.id),
      name: String(p.name),
      time: String(p.time),
      days: p.days.map(Number),
      isActive: p.isActive !== false,
    }))
}

// 구독 등록 / 갱신
app.post('/api/push/subscribe', (req, res) => {
  const { endpoint, p256dh, auth, pills } = req.body ?? {}
  if (!isNonEmptyString(endpoint, 1000) || !isNonEmptyString(p256dh, 200) || !isNonEmptyString(auth, 100)) {
    return res.status(400).json({ error: '필수 값 누락 또는 형식 오류' })
  }
  const safePills = sanitizePills(pills)

  const subs = loadSubscriptions()
  const idx = subs.findIndex(s => s.endpoint === endpoint)
  if (idx >= 0) {
    subs[idx] = { endpoint, p256dh, auth, pills: safePills }
  } else {
    // DoS 보호: 전체 구독 수 상한 (배포 후 필요 시 조정)
    if (subs.length >= 10_000) {
      return res.status(503).json({ error: '일시적으로 등록이 불가능해요.' })
    }
    subs.push({ endpoint, p256dh, auth, pills: safePills })
  }
  saveSubscriptions(subs)
  res.json({ success: true })
})

// 영양제 목록만 갱신
app.post('/api/push/update-pills', (req, res) => {
  const { endpoint, pills } = req.body ?? {}
  if (!isNonEmptyString(endpoint, 1000)) {
    return res.status(400).json({ error: 'endpoint 누락' })
  }
  const safePills = sanitizePills(pills)
  const subs = loadSubscriptions()
  const idx = subs.findIndex(s => s.endpoint === endpoint)
  if (idx >= 0) {
    subs[idx].pills = safePills
    saveSubscriptions(subs)
  }
  res.json({ success: true })
})

// 구독 해제
app.post('/api/push/unsubscribe', (req, res) => {
  const { endpoint } = req.body ?? {}
  if (!isNonEmptyString(endpoint, 1000)) {
    return res.status(400).json({ error: 'endpoint 누락' })
  }
  const subs = loadSubscriptions().filter(s => s.endpoint !== endpoint)
  saveSubscriptions(subs)
  res.json({ success: true })
})

// VAPID 공개키 전달
app.get('/api/push/vapid-key', (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY })
})

// ─── Cron: 매 분마다 영양제 알람 체크 ────────────────────────────────────────
// 한국 사용자 기준으로 동작해야 하므로 서버 TZ 와 무관하게 Asia/Seoul 기준으로 계산한다.
const ALARM_TZ = process.env.ALARM_TIMEZONE ?? 'Asia/Seoul'

function getSeoulTimeParts(now: Date): { time: string; day: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: ALARM_TZ,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  })
  const parts = fmt.formatToParts(now)
  const hour = parts.find(p => p.type === 'hour')?.value ?? '00'
  const minute = parts.find(p => p.type === 'minute')?.value ?? '00'
  const weekdayShort = parts.find(p => p.type === 'weekday')?.value ?? 'Sun'
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { time: `${hour}:${minute}`, day: dayMap[weekdayShort] ?? 0 }
}

cron.schedule('* * * * *', async () => {
  const subs = loadSubscriptions()
  if (subs.length === 0) return

  const { time: currentTime, day: currentDay } = getSeoulTimeParts(new Date())

  const toRemove: string[] = []

  for (const sub of subs) {
    const due = (sub.pills ?? []).filter(p =>
      p.isActive !== false &&
      p.time === currentTime &&
      (p.days?.includes(currentDay) ?? true)
    )

    for (const pill of due) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: '홀시 - 지금 챙겨요',
            body: `${pill.name} 복용 시간이에요!`,
            tag: `pill-${pill.id}`,
          })
        )
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          toRemove.push(sub.endpoint) // 만료된 구독 제거
        }
      }
    }
  }

  if (toRemove.length > 0) {
    const cleaned = loadSubscriptions().filter(s => !toRemove.includes(s.endpoint))
    saveSubscriptions(cleaned)
  }
})

console.log('알림 자동화 cron 시작 (매 분 체크)')

// ─── SNS 자동 발행 스케줄러 ────────────────────────────────────────────────────
import { startAutomationScheduler } from './automation/scheduler.js'
startAutomationScheduler()

// ─── 홀시 맞춤 조언 + 영양제 추천 ─────────────────────────────────────────
// Claude 호출 엔드포인트는 비용 보호를 위해 IP 당 분당 6회로 제한
const aiLimiter = rateLimit(6, 60_000)

app.post('/api/holsi-advice', aiLimiter, async (req, res) => {
  const { dDay, userName, pills } = req.body ?? {}
  // 페이로드 가볍게 검증
  if (dDay !== null && dDay !== undefined && typeof dDay !== 'number') {
    return res.status(400).json({ error: 'dDay 형식 오류' })
  }
  if (userName != null && (typeof userName !== 'string' || userName.length > 50)) {
    return res.status(400).json({ error: 'userName 형식 오류' })
  }

  let phase = ''
  if (dDay === null || dDay === undefined) {
    phase = '아직 주기 데이터가 없는 상태'
  } else if (dDay > 14) {
    phase = `다음 생리까지 ${dDay}일 남음 (배란 전후, 활력 최고)`
  } else if (dDay > 7) {
    phase = `다음 생리까지 ${dDay}일 남음 (황체기 초반, 에너지 충만)`
  } else if (dDay > 3) {
    phase = `다음 생리까지 ${dDay}일 남음 (황체기 후반, PMS 주의)`
  } else if (dDay > 0) {
    phase = `다음 생리까지 ${dDay}일 남음 (생리 임박, 예민함 MAX)`
  } else if (dDay === 0) {
    phase = '생리 당일 (D-DAY)'
  } else {
    phase = `생리 시작 후 ${Math.abs(dDay)}일째 (회복 중)`
  }

  const pillList =
    pills && pills.length > 0
      ? `현재 복용 중인 영양제: ${pills.map((p: { name: string }) => p.name).join(', ')}`
      : '등록된 영양제 없음'

  const nickname = (userName && String(userName).trim()) || '언니'

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: `너는 '홀시'라는 여성 건강 앱이야. 사용자 상태를 짧고 바이럴되는 카피로 표현하고, 아래 상품을 자연스럽게 원하게 만들어줘.

사용자 정보:
- 닉네임: ${nickname}
- 현재 주기 단계: ${phase}
- ${pillList}

[advice 작성 규칙 - 절대 준수]
- 이모지 절대 금지
- 반드시 두 줄, 줄바꿈은 \\n
- **첫 줄은 무조건 "${nickname}" 이라는 닉네임 토큰으로 시작해야 한다.** 첫 글자가 "${nickname}" 이 아니면 규칙 위반이다.
  · 허용 예시: "${nickname}아, 지금 예민함 MAX", "${nickname}, 오늘 당 떨어질 각", "${nickname}야 배 아프지?", "${nickname}님 컨디션 체크!"
  · 금지 예시: "생리 2일 전 ~", "지금 몸이 ~", "오늘은 ~" (닉네임 없이 시작하면 안 됨)
- 첫 줄은 닉네임 포함 22자 이내
- 둘째 줄: 아래 recommendations 상품이 자연스럽게 땡기도록 욕구를 건드려줘. 설명 말고 감각적으로. 20자 이내.
- 반말. 친구 카톡에 공유하고 싶어지는 문체.

[recommendations 작성 규칙]
- 영양제뿐 아니라 음식, 간식, 음료, 핫팩 등 지금 이 주기에 실제로 땡기는 것 추천 가능
- name: "[짧은 특징] [상품 종류/이름]" 형태의 굵게 표시될 라벨. 6~12자. 형용사/특징 + 상품명 결합. (예: "배따뜻 핫팩", "속편한 캐모마일티", "당충전 마카롱", "PMS 진정 마그네슘", "수분폭탄 코코넛워터")
  · 절대 긴 문장 금지. 광고 헤드라인 금지. 오직 "특징어 + 상품명" 형태.
- reason: 얇은 글씨로 들어갈 짧은 설명 + 후킹 멘트. 18자 이내. 한 문장. (예: "지금 배 위에 얹으면 즉각 진정", "당 떨어진 니 몸을 위한 구원템")
- cta: 버튼에 들어갈 짧은 텍스트. 아래 중 가장 어울리는 것 하나 선택. ["핫딜 보기", "최저가 확인", "끝딜 잡기", "바로 가기", "지금 주문", "오늘만 이가격"]
- keyword: 쿠팡 실제 검색 키워드 (잘 팔리는 키워드로)

JSON 형식으로만 응답 (설명 없이):
{
  "advice": "{첫 줄}\\n{둘째 줄}",
  "recommendations": [
    {"name": "특징+상품명", "reason": "짧은 설명+후킹", "cta": "버튼텍스트", "keyword": "쿠팡 검색어"}
  ]
}

recommendations 1~2개. 이미 복용 중인 영양제는 제외. 한국어로만.`,
        },
        // assistant 메시지 prefill: JSON 을 강제로 "${nickname}" 으로 시작하게 유도
        {
          role: 'assistant',
          content: `{\n  "advice": "${nickname}`,
        },
      ],
    })

    const continuation = (msg.content[0] as Anthropic.TextBlock).text
    // prefill 한 조각을 다시 붙여서 온전한 JSON 으로 복원
    const raw = `{\n  "advice": "${nickname}${continuation}`

    const cleanText = raw.replace(/```(?:json)?\n?|\n?```/g, '').trim()
    let parsed: { advice?: string; recommendations?: unknown } | null = null
    try {
      parsed = JSON.parse(cleanText)
    } catch {
      // 모델이 JSON 을 완성하지 못한 경우 일부만 파싱 시도
      const match = cleanText.match(/\{[\s\S]*\}/)
      if (match) {
        try { parsed = JSON.parse(match[0]) } catch { /* ignore */ }
      }
    }

    if (parsed && typeof parsed.advice === 'string') {
      // 2차 안전망: 혹시 닉네임으로 시작하지 않으면 강제로 붙인다
      if (!parsed.advice.startsWith(nickname)) {
        parsed.advice = `${nickname}아, ${parsed.advice}`
      }
      res.json(parsed)
    } else {
      res.json({ advice: `${nickname}아, 오늘도 나를 챙겨보자\n지금 필요한 건 바로 이거야`, recommendations: [] })
    }
  } catch (err: any) {
    console.error('holsi-advice error:', err?.message ?? err)
    res.status(500).json({ error: '조언 생성에 실패했어요.', detail: err?.message })
  }
})

// ─── 영양제 AI 상담 + 추천 ─────────────────────────────────────────────────
app.post('/api/pill-advisor', aiLimiter, async (req, res) => {
  const { question, pills, dDay, userName } = req.body ?? {}
  if (typeof question !== 'string' || question.length === 0 || question.length > 500) {
    return res.status(400).json({ error: '질문 형식 오류 (1~500자)' })
  }

  const pillContext =
    pills && pills.length > 0
      ? `사용자가 현재 복용 중인 영양제: ${pills.map((p: { name: string; time: string }) => `${p.name}(${p.time}`).join('), ')})`
      : '등록된 영양제 없음'

  const cycleContext = dDay !== null && dDay !== undefined
    ? `현재 생리 주기: D${dDay >= 0 ? '-' + dDay : '+' + Math.abs(dDay)} (${
        dDay > 7 ? '난포기 — 에너지 높음' :
        dDay > 3 ? '황체기 후반 — PMS 주의' :
        dDay > 0 ? '생리 직전 — 민감 시기' :
        dDay === 0 ? '생리 첫날' : '생리 중'
      })`
    : '주기 데이터 없음'

  const nameContext = userName ? `사용자 이름: ${userName}` : ''

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: `너는 여성 건강 전문 영양제 상담사야. 친근하고 전문적으로 답해줘.

${pillContext}
${cycleContext}
${nameContext}

질문: ${question}

다음 JSON 형식으로만 응답해줘 (설명 없이):
{
  "answer": "3~4문장 답변. 의학적으로 중요하면 마지막에 '전문의 상담을 권장해요' 추가.",
  "recommendations": [
    {"name": "영양제명", "reason": "추천 이유 한 줄", "keyword": "쿠팡 검색 키워드"}
  ]
}

recommendations는 질문과 관련해서 실제로 도움이 될 영양제 1~2개만 넣어줘.
이미 복용 중인 영양제는 제외.
한국어로만 답해.`,
        },
      ],
    })

    const raw = (msg.content[0] as Anthropic.TextBlock).text
    try {
      const parsed = JSON.parse(raw.replace(/```(?:json)?\n?|\n?```/g, '').trim())
      res.json(parsed)
    } catch {
      res.json({ answer: raw, recommendations: [] })
    }
  } catch (err: any) {
    console.error('pill-advisor error:', err?.message ?? err)
    res.status(500).json({ error: '상담에 실패했어요.' })
  }
})

// ─── Claude Vision OCR ─────────────────────────────────────────────────────
// OCR 도 Claude 호출이라 rate limit 필수
const ocrLimiter = rateLimit(10, 60_000)

app.post('/api/ocr', ocrLimiter, async (req, res) => {
  const { imageBase64, mimeType = 'image/jpeg', mode = 'pill' } = req.body ?? {}
  // base64 크기 상한 1.5MB (압축 후 대략 300KB 이므로 충분한 여유)
  if (!isNonEmptyString(imageBase64, 1_500_000)) {
    return res.status(413).json({ error: '이미지가 너무 크거나 비어있어요.' })
  }
  const allowedMime = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
  if (typeof mimeType !== 'string' || !allowedMime.has(mimeType)) {
    return res.status(400).json({ error: '지원하지 않는 이미지 형식이에요.' })
  }
  if (mode !== 'pill' && mode !== 'period') {
    return res.status(400).json({ error: 'mode 값 오류' })
  }

  const promptMap: Record<string, string> = {
    pill: `이 영양제/약 이미지를 분석해서 다음 JSON 형식으로만 응답해줘 (설명 없이):
{"name": "영양제 이름", "timing": "복용 시기 또는 방법", "description": "한 줄 설명"}
정보가 불명확하면 해당 필드에 null을 넣어줘.`,
    period: `이 이미지에서 생리 기록 날짜를 모두 찾아서 YYYY-MM-DD 형식의 JSON 배열로만 응답해줘.
예: ["2024-01-15", "2024-02-12"]
날짜가 없으면 빈 배열 []로 답해.`,
  }

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: imageBase64,
              },
            },
            { type: 'text', text: promptMap[mode] ?? promptMap.pill },
          ],
        },
      ],
    })

    const raw = (msg.content[0] as Anthropic.TextBlock).text
    try {
      const parsed = JSON.parse(raw.replace(/```(?:json)?\n?|\n?```/g, '').trim())
      res.json({ result: parsed, raw })
    } catch {
      res.json({ result: null, raw })
    }
  } catch (err: any) {
    console.error('ocr error:', err?.message ?? err)
    res.status(500).json({ error: 'OCR 처리에 실패했어요.', detail: err?.message })
  }
})

// ─── 커뮤니티 게시판 ─────────────────────────────────────────────────────────
interface CommunityPost {
  id: string
  author: string
  category: string
  content: string
  likedBy: string[]
  createdAt: string
}

const POSTS_FILE = process.env.POSTS_FILE_PATH ?? path.join(__dirname, 'community_posts.json')
const MAX_POSTS = 1000

function loadPosts(): CommunityPost[] {
  try { return JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8')) } catch { return [] }
}

function savePosts(posts: CommunityPost[]) {
  const tmp = `${POSTS_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(posts, null, 2), 'utf8')
  fs.renameSync(tmp, POSTS_FILE)
}

const ANONYMOUS_NAMES = ['달빛언니', '봄향기', '새벽별', '구름언니', '민들레', '초코언니', '라벤더', '수선화', '하늘이', '복숭아']

function makeAuthor(deviceId: string): string {
  const idx = parseInt(deviceId.slice(-2), 36) % ANONYMOUS_NAMES.length
  const suffix = deviceId.slice(-4).toUpperCase()
  return `${ANONYMOUS_NAMES[idx]}#${suffix}`
}

const communityLimiter = rateLimit(10, 60_000)

// 게시글 목록 조회
app.get('/api/community/posts', (req, res) => {
  const { deviceId, category } = req.query as { deviceId?: string; category?: string }
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 100) {
    return res.status(400).json({ error: 'deviceId 누락' })
  }
  let posts = loadPosts()
  if (category && category !== '전체') {
    posts = posts.filter(p => p.category === category)
  }
  // 최신순
  posts = posts.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const result = posts.map(p => ({
    id: p.id,
    author: p.author,
    category: p.category,
    content: p.content,
    likes: p.likedBy.length,
    liked: p.likedBy.includes(deviceId),
    createdAt: p.createdAt,
  }))
  res.json({ posts: result })
})

// 게시글 작성
app.post('/api/community/posts', communityLimiter, (req, res) => {
  const { deviceId, category, content } = req.body ?? {}
  if (!isNonEmptyString(deviceId, 100)) return res.status(400).json({ error: 'deviceId 누락' })
  if (!isNonEmptyString(category, 20)) return res.status(400).json({ error: 'category 누락' })
  if (!isNonEmptyString(content, 200)) return res.status(400).json({ error: 'content 누락 또는 너무 김' })

  const validCategories = ['생리통', 'PMS', '임신준비', '영양제', '일상']
  if (!validCategories.includes(category)) return res.status(400).json({ error: 'category 오류' })

  const posts = loadPosts()
  if (posts.length >= MAX_POSTS) {
    // 오래된 게시글 삭제 (FIFO)
    posts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    posts.splice(0, posts.length - MAX_POSTS + 1)
  }

  const newPost: CommunityPost = {
    id: Math.random().toString(36).substring(2) + Date.now().toString(36),
    author: makeAuthor(deviceId),
    category,
    content: content.trim(),
    likedBy: [],
    createdAt: new Date().toISOString(),
  }
  posts.push(newPost)
  savePosts(posts)
  res.json({ success: true, id: newPost.id })
})

// 좋아요 토글
app.post('/api/community/posts/:id/like', (req, res) => {
  const { id } = req.params
  const { deviceId } = req.body ?? {}
  if (!isNonEmptyString(deviceId, 100)) return res.status(400).json({ error: 'deviceId 누락' })

  const posts = loadPosts()
  const post = posts.find(p => p.id === id)
  if (!post) return res.status(404).json({ error: '게시글 없음' })

  const idx = post.likedBy.indexOf(deviceId)
  if (idx >= 0) {
    post.likedBy.splice(idx, 1)
  } else {
    if (post.likedBy.length >= 10_000) return res.status(400).json({ error: '처리 불가' })
    post.likedBy.push(deviceId)
  }
  savePosts(posts)
  res.json({ likes: post.likedBy.length, liked: idx < 0 })
})

// ─── 프로덕션: 빌드된 프론트엔드 서빙 ────────────────────────────────────────
const distPath = path.join(__dirname, '../dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, { dotfiles: 'allow' }))
  // Express 5: '*' 는 더 이상 유효한 path 가 아님. SPA fallback 은 모든 메소드/경로를 잡는 미들웨어로 처리
  app.use((req, res, next) => {
    // API 경로 및 .well-known 경로는 fallback 하지 않음 (404 유지)
    if (req.path.startsWith('/api/')) return next()
    if (req.path.startsWith('/.well-known/')) return next()
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => {
  console.log(`🌸 홀시 서버 실행 중: http://localhost:${PORT}`)
})
