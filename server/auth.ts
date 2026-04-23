import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { createPublicKey, randomBytes } from 'crypto'
import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { upsertUser, getUserById, syncUserData, getUserData, getAllUsers, deleteUser } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── 감사 로그 ─────────────────────────────────────────────────────────────────
const AUDIT_FILE = process.env.AUDIT_LOG_PATH ?? path.join(__dirname, 'audit.log')

export function auditLog(action: string, userId: string, ip?: string, meta?: Record<string, unknown>) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    action,
    userId,
    ip: ip ?? 'unknown',
    ...meta,
  })
  try {
    fs.appendFileSync(AUDIT_FILE, entry + '\n', 'utf8')
  } catch (e) {
    console.error('[AuditLog] write error:', e)
  }
}

const router = Router()

// 필수 환경변수 — 미설정 시 서버 시작 거부 (약한 폴백값 사용 방지)
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required')
if (!process.env.ADMIN_SECRET) throw new Error('ADMIN_SECRET environment variable is required')

const JWT_SECRET = process.env.JWT_SECRET
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const ADMIN_SECRET = process.env.ADMIN_SECRET

// ─── OAuth CSRF 방어용 state (파일 기반 — PM2 재시작에도 유지) ────────────────
const STATE_FILE = path.join(__dirname, 'oauth-states.json')

function loadStates(): Record<string, { platform: string; expiresAt: number }> {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) } catch { return {} }
}

function saveStates(states: Record<string, { platform: string; expiresAt: number }>) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(states), 'utf8') } catch {}
}

function generateOAuthState(platform: string): string {
  const state = randomBytes(16).toString('hex')
  const states = loadStates()
  const now = Date.now()
  // 만료된 state 정리
  for (const k in states) if (states[k].expiresAt < now) delete states[k]
  states[state] = { platform, expiresAt: now + 10 * 60_000 }
  saveStates(states)
  return state
}

function consumeOAuthState(state: string): string | null {
  if (!state) return null
  const states = loadStates()
  const entry = states[state]
  if (!entry || entry.expiresAt < Date.now()) return null
  delete states[state]
  saveStates(states)
  return entry.platform
}

// ─── Auth 엔드포인트 전용 Rate Limiter ────────────────────────────────────────
type RateEntry = { count: number; resetAt: number }
const authRateMap = new Map<string, RateEntry>()
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of authRateMap) if (v.resetAt < now) authRateMap.delete(k)
}, 60_000).unref?.()

function authRateLimit(req: Request, res: Response, next: () => void) {
  const key = req.ip ?? 'unknown'
  const now = Date.now()
  const entry = authRateMap.get(key)
  if (!entry || entry.resetAt < now) {
    authRateMap.set(key, { count: 1, resetAt: now + 15 * 60_000 })
    return next()
  }
  if (entry.count >= 10) {
    return res.status(429).json({ error: '너무 많은 로그인 시도입니다. 15분 후 다시 시도해주세요.' })
  }
  entry.count++
  next()
}

// ─── JWT helpers ──────────────────────────────────────────────────────────────

function signToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' })
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string }
  } catch {
    return null
  }
}

function getTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
  return null
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────

const googleClient = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || `${FRONTEND_URL.replace(':5173', ':3001')}/api/auth/google/callback`
)

router.get('/google', (_req: Request, res: Response) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.redirect(`${FRONTEND_URL}/mypage?auth_error=google_not_configured`)
  }
  const platform = _req.query.platform as string
  const state = generateOAuthState(platform === 'native' ? 'native' : 'web')
  const url = googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['profile', 'email'],
    prompt: 'select_account',
    state,
  })
  res.redirect(url)
})

router.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string
  const stateParam = req.query.state as string
  const platform = consumeOAuthState(stateParam)
  if (!platform) return res.redirect(`${FRONTEND_URL}/mypage?auth_error=invalid_state`)
  const isNative = platform === 'native'
  const errorBase = isNative ? 'holsi://auth' : `${FRONTEND_URL}/mypage`

  if (!code) return res.redirect(`${errorBase}?auth_error=no_code`)

  try {
    const { tokens } = await googleClient.getToken(code)
    googleClient.setCredentials(tokens)

    const oauth2 = google.oauth2({ version: 'v2', auth: googleClient })
    const { data } = await oauth2.userinfo.get()

    const user = await upsertUser({
      provider: 'google',
      providerId: data.id!,
      email: data.email,
      name: data.name,
      avatar: data.picture,
    })

    const token = signToken(user.id)
    auditLog('login', user.id, req.ip, { provider: 'google' })
    const successBase = isNative ? 'holsi://auth' : `${FRONTEND_URL}/mypage`
    res.redirect(`${successBase}?token=${token}`)
  } catch (err) {
    console.error('[Google OAuth]', err)
    res.redirect(`${errorBase}?auth_error=google_failed`)
  }
})

// ─── Kakao OAuth ──────────────────────────────────────────────────────────────

const KAKAO_REDIRECT_URI = process.env.KAKAO_REDIRECT_URI ||
  `${FRONTEND_URL.replace(':5173', ':3001')}/api/auth/kakao/callback`

router.get('/kakao', (_req: Request, res: Response) => {
  if (!process.env.KAKAO_REST_API_KEY) {
    return res.redirect(`${FRONTEND_URL}/mypage?auth_error=kakao_not_configured`)
  }
  const platform = _req.query.platform as string
  const state = generateOAuthState(platform === 'native' ? 'native' : 'web')
  const url = `https://kauth.kakao.com/oauth/authorize?client_id=${process.env.KAKAO_REST_API_KEY}&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}&response_type=code&state=${encodeURIComponent(state)}`
  res.redirect(url)
})

router.get('/kakao/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string
  const stateParam = req.query.state as string
  const platform = consumeOAuthState(stateParam)
  if (!platform) return res.redirect(`${FRONTEND_URL}/mypage?auth_error=invalid_state`)
  const isNative = platform === 'native'
  const errorBase = isNative ? 'holsi://auth' : `${FRONTEND_URL}/mypage`

  if (!code) return res.redirect(`${errorBase}?auth_error=no_code`)

  try {
    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_REST_API_KEY!,
        redirect_uri: KAKAO_REDIRECT_URI,
        code,
      }),
    })
    const tokenData = await tokenRes.json() as { access_token: string }

    const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const userData = await userRes.json() as {
      id: number
      kakao_account?: { email?: string; profile?: { nickname?: string; profile_image_url?: string } }
    }

    const user = await upsertUser({
      provider: 'kakao',
      providerId: String(userData.id),
      email: userData.kakao_account?.email,
      name: userData.kakao_account?.profile?.nickname,
      avatar: userData.kakao_account?.profile?.profile_image_url,
    })

    const token = signToken(user.id)
    auditLog('login', user.id, req.ip, { provider: 'kakao' })
    const successBase = isNative ? 'holsi://auth' : `${FRONTEND_URL}/mypage`
    res.redirect(`${successBase}?token=${token}`)
  } catch (err) {
    console.error('[Kakao OAuth]', err)
    res.redirect(`${errorBase}?auth_error=kakao_failed`)
  }
})

// ─── Apple Sign In ────────────────────────────────────────────────────────────

async function verifyAppleToken(identityToken: string) {
  const decoded = jwt.decode(identityToken, { complete: true })
  if (!decoded || typeof decoded.header === 'string') throw new Error('Invalid token')

  const kid = (decoded.header as any).kid
  const res = await fetch('https://appleid.apple.com/auth/keys')
  const { keys } = await res.json() as { keys: any[] }
  const jwk = keys.find((k: any) => k.kid === kid)
  if (!jwk) throw new Error('Signing key not found')

  const publicKey = createPublicKey({ key: jwk, format: 'jwk' })
  const pem = publicKey.export({ type: 'spki', format: 'pem' }) as string

  return jwt.verify(identityToken, pem, {
    algorithms: ['RS256'],
    issuer: 'https://appleid.apple.com',
    audience: 'com.holsi.app',
  }) as { sub: string; email?: string }
}

router.post('/apple', authRateLimit, async (req: Request, res: Response) => {
  const { identityToken, givenName, familyName, email } = req.body as {
    identityToken: string
    givenName?: string
    familyName?: string
    email?: string
  }

  if (!identityToken) return res.status(400).json({ error: 'no token' })

  try {
    const payload = await verifyAppleToken(identityToken)
    const name = [givenName, familyName].filter(Boolean).join(' ') || undefined

    const user = await upsertUser({
      provider: 'apple',
      providerId: payload.sub,
      email: email ?? payload.email,
      name,
      avatar: undefined,
    })

    const token = signToken(user.id)
    auditLog('login', user.id, req.ip, { provider: 'apple' })
    res.json({ token })
  } catch (err) {
    console.error('[Apple Auth]', err)
    res.status(401).json({ error: 'apple_auth_failed' })
  }
})

// ─── Auth API ─────────────────────────────────────────────────────────────────

router.get('/me', async (req: Request, res: Response) => {
  const token = getTokenFromRequest(req)
  if (!token) return res.status(401).json({ error: 'no token' })

  const payload = verifyToken(token)
  if (!payload) return res.status(401).json({ error: 'invalid token' })

  const user = await getUserById(payload.userId)
  if (!user) return res.status(404).json({ error: 'user not found' })

  res.json({ id: user.id, email: user.email, name: user.name, avatar: user.avatar, provider: user.provider })
})

const SYNC_FIELD_MAX = 200_000 // 필드당 200KB 상한

router.post('/sync', async (req: Request, res: Response) => {
  const token = getTokenFromRequest(req)
  if (!token) return res.status(401).json({ error: 'no token' })

  const payload = verifyToken(token)
  if (!payload) return res.status(401).json({ error: 'invalid token' })

  const { pillsData, recordsData, settingsData } = req.body as {
    pillsData?: string
    recordsData?: string
    settingsData?: string
  }

  // 각 필드 크기 제한 — 대용량 문자열로 DB 스토리지 남용 방지
  if (pillsData !== undefined && (typeof pillsData !== 'string' || pillsData.length > SYNC_FIELD_MAX))
    return res.status(400).json({ error: 'pillsData 크기 초과' })
  if (recordsData !== undefined && (typeof recordsData !== 'string' || recordsData.length > SYNC_FIELD_MAX))
    return res.status(400).json({ error: 'recordsData 크기 초과' })
  if (settingsData !== undefined && (typeof settingsData !== 'string' || settingsData.length > SYNC_FIELD_MAX))
    return res.status(400).json({ error: 'settingsData 크기 초과' })

  await syncUserData(payload.userId, { pillsData, recordsData, settingsData })
  auditLog('sync', payload.userId, req.ip)
  res.json({ ok: true })
})

router.get('/restore', async (req: Request, res: Response) => {
  const token = getTokenFromRequest(req)
  if (!token) return res.status(401).json({ error: 'no token' })

  const payload = verifyToken(token)
  if (!payload) return res.status(401).json({ error: 'invalid token' })

  const data = await getUserData(payload.userId)
  res.json(data ?? {})
})

router.delete('/user', async (req: Request, res: Response) => {
  const token = getTokenFromRequest(req)
  if (!token) return res.status(401).json({ error: 'no token' })

  const payload = verifyToken(token)
  if (!payload) return res.status(401).json({ error: 'invalid token' })

  try {
    await deleteUser(payload.userId)
    auditLog('delete_account', payload.userId, req.ip)
    res.json({ ok: true })
  } catch (err) {
    console.error('[Delete User]', err)
    res.status(500).json({ error: 'delete_failed' })
  }
})

// ─── Admin API ────────────────────────────────────────────────────────────────

router.get('/admin/users', authRateLimit, async (req: Request, res: Response) => {
  const secret = req.headers['x-admin-secret']
  if (secret !== ADMIN_SECRET) {
    auditLog('admin_access_denied', 'unknown', req.ip)
    return res.status(403).json({ error: 'forbidden' })
  }
  auditLog('admin_access', 'admin', req.ip)
  const users = await getAllUsers()
  res.json(users)
})

export default router
