import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { createPublicKey } from 'crypto'
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
  const platform = _req.query.platform as string
  const url = googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['profile', 'email'],
    prompt: 'select_account',
    state: platform === 'native' ? 'native' : 'web',
  })
  res.redirect(url)
})

router.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string
  const isNative = req.query.state === 'native'
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
  const state = platform === 'native' ? 'native' : 'web'
  const url = `https://kauth.kakao.com/oauth/authorize?client_id=${process.env.KAKAO_REST_API_KEY}&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}&response_type=code&state=${state}`
  res.redirect(url)
})

router.get('/kakao/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string
  const isNative = req.query.state === 'native'
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

router.post('/apple', async (req: Request, res: Response) => {
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
