import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import Anthropic from '@anthropic-ai/sdk'
import webpush from 'web-push'
import cron from 'node-cron'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import authRouter, { verifyToken } from './auth.js'
import { getHolsiContent } from './holsi-content.js'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
app.disable('x-powered-by') // 서버 기술 스택 노출 방지

// ─── CORS 화이트리스트 ─────────────────────────────────────────────────────
// 배포 시 ALLOWED_ORIGINS="https://hol-si.com,https://www.hol-si.com" 형태로 EC2 .env에 지정
// 미설정 시: 개발 환경에서만 전체 허용 (프로덕션에서 미설정이면 서버 시작 거부)
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',').map(s => s.trim()).filter(Boolean)

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  throw new Error('ALLOWED_ORIGINS environment variable is required in production')
}

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true) // curl, 서버간 요청, 동일 출처
    if (allowedOrigins.length === 0) return cb(null, true) // 개발 환경: 전체 허용
    if (allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: ${origin} not allowed`))
  },
}))

app.use(express.json({ limit: '2mb' })) // OCR 이미지 고려하여 2mb (클라에서 1024px 압축 후 ~300KB)

// ─── 보안 헤더 ────────────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  // HSTS: 1년간 HTTPS 강제, 서브도메인 포함 (프로덕션에서만 — nginx가 HTTPS 종단)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  // CSP: XSS 2차 방어 — inline style/script 허용은 React 빌드 요구사항
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://pagead2.googlesyndication.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
      "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
      "img-src 'self' data: https:",
      "connect-src 'self' https:",
      "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
      "frame-ancestors 'none'",
    ].join('; ')
  )
  next()
})

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

// ─── 유저별 일별 AI 사용량 추적 (in-memory, 자정마다 리셋) ───────────────────
// IP 레이트리밋만으론 앱 우회 직접 호출을 막기 어렵기 때문에 userId 기반 추가 검증
interface UserDailyUsage { holsi: number; pill: number; ocr: number; date: string }
const userDailyUsageMap = new Map<string, UserDailyUsage>()
setInterval(() => {
  const today = new Date().toISOString().slice(0, 10)
  for (const [k, v] of userDailyUsageMap) if (v.date !== today) userDailyUsageMap.delete(k)
}, 60 * 60_000).unref?.()

const USER_DAILY_LIMITS = { holsi: 30, pill: 15, ocr: 8 }

function getUserDailyUsage(userId: string): UserDailyUsage {
  const today = new Date().toISOString().slice(0, 10)
  const existing = userDailyUsageMap.get(userId)
  if (!existing || existing.date !== today) {
    const fresh: UserDailyUsage = { holsi: 0, pill: 0, ocr: 0, date: today }
    userDailyUsageMap.set(userId, fresh)
    return fresh
  }
  return existing
}

function getUserIdFromRequest(req: express.Request): string | null {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return null
  const payload = verifyToken(authHeader.slice(7))
  return payload?.userId ?? null
}

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

app.post('/api/holsi-advice', aiLimiter, (req, res) => {
  const { dDay, userName } = req.body ?? {}
  if (dDay !== null && dDay !== undefined && typeof dDay !== 'number') {
    return res.status(400).json({ error: 'dDay 형식 오류' })
  }
  if (userName != null && (typeof userName !== 'string' || userName.length > 50)) {
    return res.status(400).json({ error: 'userName 형식 오류' })
  }

  // 로그인 유저 일별 사용량 추적 (우회 호출 방어)
  const userId = getUserIdFromRequest(req)
  if (userId) {
    const usage = getUserDailyUsage(userId)
    if (usage.holsi >= USER_DAILY_LIMITS.holsi) {
      return res.status(429).json({ error: '오늘 홀시 참견을 너무 많이 봤어요.' })
    }
    usage.holsi++
  }

  const nickname = (userName && String(userName).trim()) || '언니'
  res.json(getHolsiContent(dDay, nickname))
})

// ─── 영양제 AI 상담 + 추천 ─────────────────────────────────────────────────
app.post('/api/pill-advisor', aiLimiter, async (req, res) => {
  const { question, pills, dDay, userName } = req.body ?? {}
  if (typeof question !== 'string' || question.length === 0 || question.length > 500) {
    return res.status(400).json({ error: '질문 형식 오류 (1~500자)' })
  }

  const userId = getUserIdFromRequest(req)
  if (userId) {
    const usage = getUserDailyUsage(userId)
    if (usage.pill >= USER_DAILY_LIMITS.pill) {
      return res.status(429).json({ error: '오늘 AI 상담 횟수를 초과했어요.' })
    }
    usage.pill++
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

  const userId = getUserIdFromRequest(req)
  if (userId) {
    const usage = getUserDailyUsage(userId)
    if (usage.ocr >= USER_DAILY_LIMITS.ocr) {
      return res.status(429).json({ error: '오늘 OCR 사용 횟수를 초과했어요.' })
    }
    usage.ocr++
  }

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
    res.status(500).json({ error: 'OCR 처리에 실패했어요.' })
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
  const allComments = loadComments()
  const commentCountMap = new Map<string, number>()
  for (const c of allComments) {
    commentCountMap.set(c.postId, (commentCountMap.get(c.postId) ?? 0) + 1)
  }
  const result = posts.map(p => ({
    id: p.id,
    author: p.author,
    category: p.category,
    content: p.content,
    likes: p.likedBy.length,
    liked: p.likedBy.includes(deviceId),
    commentCount: commentCountMap.get(p.id) ?? 0,
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

// ─── 커뮤니티 댓글 ────────────────────────────────────────────────────────────
interface CommunityComment {
  id: string
  postId: string
  author: string
  content: string
  likedBy: string[]
  createdAt: string
}

const COMMENTS_FILE = process.env.COMMENTS_FILE_PATH ?? path.join(__dirname, 'community_comments.json')
const MAX_COMMENTS_PER_POST = 200

function loadComments(): CommunityComment[] {
  try { return JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf8')) } catch { return [] }
}

function saveComments(comments: CommunityComment[]) {
  const tmp = `${COMMENTS_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(comments, null, 2), 'utf8')
  fs.renameSync(tmp, COMMENTS_FILE)
}

// 댓글 목록 조회
app.get('/api/community/posts/:id/comments', (req, res) => {
  const { id } = req.params
  const { deviceId } = req.query as { deviceId?: string }
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 100) {
    return res.status(400).json({ error: 'deviceId 누락' })
  }
  const comments = loadComments()
    .filter(c => c.postId === id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map(c => ({
      id: c.id,
      author: c.author,
      content: c.content,
      likes: c.likedBy.length,
      liked: c.likedBy.includes(deviceId),
      createdAt: c.createdAt,
    }))
  res.json({ comments })
})

// 댓글 작성
app.post('/api/community/posts/:id/comments', communityLimiter, (req, res) => {
  const { id } = req.params
  const { deviceId, content } = req.body ?? {}
  if (!isNonEmptyString(deviceId, 100)) return res.status(400).json({ error: 'deviceId 누락' })
  if (!isNonEmptyString(content, 200)) return res.status(400).json({ error: 'content 누락 또는 너무 김' })

  const posts = loadPosts()
  if (!posts.find(p => p.id === id)) return res.status(404).json({ error: '게시글 없음' })

  const allComments = loadComments()
  const postComments = allComments.filter(c => c.postId === id)
  if (postComments.length >= MAX_COMMENTS_PER_POST) {
    return res.status(400).json({ error: '댓글이 너무 많아요.' })
  }

  const newComment: CommunityComment = {
    id: Math.random().toString(36).substring(2) + Date.now().toString(36),
    postId: id,
    author: makeAuthor(deviceId),
    content: content.trim(),
    likedBy: [],
    createdAt: new Date().toISOString(),
  }
  allComments.push(newComment)
  saveComments(allComments)
  res.json({
    success: true,
    comment: {
      id: newComment.id,
      author: newComment.author,
      content: newComment.content,
      likes: 0,
      liked: false,
      createdAt: newComment.createdAt,
    },
  })
})

// 댓글 좋아요 토글
app.post('/api/community/comments/:commentId/like', (req, res) => {
  const { commentId } = req.params
  const { deviceId } = req.body ?? {}
  if (!isNonEmptyString(deviceId, 100)) return res.status(400).json({ error: 'deviceId 누락' })

  const comments = loadComments()
  const comment = comments.find(c => c.id === commentId)
  if (!comment) return res.status(404).json({ error: '댓글 없음' })

  const idx = comment.likedBy.indexOf(deviceId)
  if (idx >= 0) {
    comment.likedBy.splice(idx, 1)
  } else {
    if (comment.likedBy.length >= 10_000) return res.status(400).json({ error: '처리 불가' })
    comment.likedBy.push(deviceId)
  }
  saveComments(comments)
  res.json({ likes: comment.likedBy.length, liked: idx < 0 })
})

// ─── 커뮤니티 신고 ────────────────────────────────────────────────────────────
interface CommunityReport {
  id: string
  targetType: 'post' | 'comment'
  targetId: string
  reason: string
  reportedBy: string
  createdAt: string
}

const REPORTS_FILE = process.env.REPORTS_FILE_PATH ?? path.join(__dirname, 'community_reports.json')

function loadReports(): CommunityReport[] {
  try { return JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8')) } catch { return [] }
}

function saveReports(reports: CommunityReport[]) {
  const tmp = `${REPORTS_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(reports, null, 2), 'utf8')
  fs.renameSync(tmp, REPORTS_FILE)
}

const VALID_REPORT_REASONS = new Set(['음란물·성적 콘텐츠', '욕설·비방·혐오', '스팸·광고', '개인정보 노출', '기타 부적절한 내용'])

app.post('/api/community/posts/:id/report', communityLimiter, (req, res) => {
  const { id } = req.params
  const { deviceId, reason } = req.body ?? {}
  if (!isNonEmptyString(deviceId, 100)) return res.status(400).json({ error: 'deviceId 누락' })
  if (!isNonEmptyString(reason, 100) || !VALID_REPORT_REASONS.has(reason)) return res.status(400).json({ error: 'reason 오류' })

  const reports = loadReports()
  reports.push({
    id: Math.random().toString(36).substring(2) + Date.now().toString(36),
    targetType: 'post',
    targetId: id,
    reason,
    reportedBy: deviceId,
    createdAt: new Date().toISOString(),
  })
  saveReports(reports)
  res.json({ success: true })
})

app.post('/api/community/comments/:commentId/report', communityLimiter, (req, res) => {
  const { commentId } = req.params
  const { deviceId, reason } = req.body ?? {}
  if (!isNonEmptyString(deviceId, 100)) return res.status(400).json({ error: 'deviceId 누락' })
  if (!isNonEmptyString(reason, 100) || !VALID_REPORT_REASONS.has(reason)) return res.status(400).json({ error: 'reason 오류' })

  const reports = loadReports()
  reports.push({
    id: Math.random().toString(36).substring(2) + Date.now().toString(36),
    targetType: 'comment',
    targetId: commentId,
    reason,
    reportedBy: deviceId,
    createdAt: new Date().toISOString(),
  })
  saveReports(reports)
  res.json({ success: true })
})

// ─── 커뮤니티 큐레이션 시드 ───────────────────────────────────────────────────
function seedCuratedPosts() {
  if (loadPosts().length > 0) return

  const CURATED: Array<{ category: string; content: string; authorName: string }> = [
    {
      authorName: '달빛언니#HOLSI',
      category: 'PMS',
      content: 'PMS가 뭔지 몰라서 그냥 원래 예민한 사람인 줄 알았어요 😢\n\nPMS(월경전증후군)는 생리 7~14일 전부터 감정 기복, 붓기, 두통, 우울감이 나타나는 거예요. 당신 탓이 아니에요, 호르몬 때문이에요!',
    },
    {
      authorName: '봄향기#HOLSI',
      category: '생리통',
      content: '생리통에 진짜 도움됐던 것들 공유해요 🩷\n\n1. 마그네슘 - 근육 이완 효과\n2. 생강차 - 혈액순환 도움\n3. 핫팩 - 복부에 붙이면 즉각 완화\n4. 오메가3 - 염증 억제\n\n진통제 먹기 싫을 때 이것들 먼저 시도해봐요!',
    },
    {
      authorName: '라벤더#HOLSI',
      category: '영양제',
      content: '이노시톨 먹는 분 계세요? 효과 있었나요?\n\n생리불순이랑 PCOS에 좋다고 해서 3개월째 먹고 있는데, 주기가 확실히 규칙적해진 것 같아요. 같이 챙겨먹으면 좋은 영양제 있으면 알려주세요!',
    },
    {
      authorName: '초코언니#HOLSI',
      category: 'PMS',
      content: '황체기에 이렇게 달달한 게 당기는 이유가 있었어요\n\n생리 전 황체호르몬이 올라가면 세로토닌이 떨어져요. 뇌가 세로토닌을 빨리 올리려고 단 음식을 찾게 되는 거예요. 참는 것보다 다크초콜릿처럼 건강한 걸로 대체하는 게 낫대요!',
    },
    {
      authorName: '하늘이#HOLSI',
      category: '일상',
      content: '주기마다 나타나는 나만의 패턴이 있나요?\n\n저는 배란기에는 엄청 활발해지고 황체기 후반에는 집에만 있고 싶어져요. 이게 호르몬 때문이라는 걸 알고 나서부터 나 자신을 덜 자책하게 됐어요. 여러분 패턴은 어때요?',
    },
  ]

  const now = new Date()
  const seededPosts: CommunityPost[] = CURATED.map((c, i) => ({
    id: `curated_${i}_${Date.now()}`,
    author: c.authorName,
    category: c.category,
    content: c.content,
    likedBy: [],
    createdAt: new Date(now.getTime() - (CURATED.length - i) * 3 * 60 * 60 * 1000).toISOString(),
  }))

  savePosts(seededPosts)
  console.log(`큐레이션 게시글 ${seededPosts.length}개 시드 완료`)
}

seedCuratedPosts()

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

// ─── 전역 에러 핸들러 (스택 트레이스 유출 차단) ─────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[UnhandledError]', err.message, err.stack)
  res.status(500).json({ error: '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.' })
})

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => {
  console.log(`🌸 홀시 서버 실행 중: http://localhost:${PORT}`)
})
