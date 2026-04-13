import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { google } from 'googleapis'
import { upsertUser, getUserById, syncUserData, getUserData, getAllUsers } from './db.js'

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET || 'holsi-secret-change-in-production'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'holsi-admin'

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
  const url = googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })
  res.redirect(url)
})

router.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string
  if (!code) return res.redirect(`${FRONTEND_URL}/mypage?auth_error=no_code`)

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
    res.redirect(`${FRONTEND_URL}/mypage?token=${token}`)
  } catch (err) {
    console.error('[Google OAuth]', err)
    res.redirect(`${FRONTEND_URL}/mypage?auth_error=google_failed`)
  }
})

// ─── Kakao OAuth ──────────────────────────────────────────────────────────────

const KAKAO_REDIRECT_URI = process.env.KAKAO_REDIRECT_URI ||
  `${FRONTEND_URL.replace(':5173', ':3001')}/api/auth/kakao/callback`

router.get('/kakao', (_req: Request, res: Response) => {
  if (!process.env.KAKAO_REST_API_KEY) {
    return res.redirect(`${FRONTEND_URL}/mypage?auth_error=kakao_not_configured`)
  }
  const url = `https://kauth.kakao.com/oauth/authorize?client_id=${process.env.KAKAO_REST_API_KEY}&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}&response_type=code`
  res.redirect(url)
})

router.get('/kakao/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string
  if (!code) return res.redirect(`${FRONTEND_URL}/mypage?auth_error=no_code`)

  try {
    // 1. exchange code for token
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

    // 2. get user info
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
    res.redirect(`${FRONTEND_URL}/mypage?token=${token}`)
  } catch (err) {
    console.error('[Kakao OAuth]', err)
    res.redirect(`${FRONTEND_URL}/mypage?auth_error=kakao_failed`)
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

  await syncUserData(payload.userId, { pillsData, recordsData, settingsData })
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

// ─── Admin API ────────────────────────────────────────────────────────────────

router.get('/admin/users', async (req: Request, res: Response) => {
  const secret = req.headers['x-admin-secret']
  if (secret !== ADMIN_SECRET) return res.status(403).json({ error: 'forbidden' })

  const users = await getAllUsers()
  res.json(users)
})

export default router
