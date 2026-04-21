import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLIENT_SECRET_PATH = path.join(__dirname, 'client_secret.json')
const TOKEN_PATH = path.join(__dirname, 'sessions', 'google-token.json')

// YouTube + Sheets 통합 스코프
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/spreadsheets',
]

export function getOAuth2Client(): OAuth2Client {
  const secret = JSON.parse(fs.readFileSync(CLIENT_SECRET_PATH, 'utf-8'))
  const { client_id, client_secret, redirect_uris } = secret.installed ?? secret.web
  return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
}

export async function loginGoogle(): Promise<void> {
  const auth = getOAuth2Client()
  const url = auth.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' })

  console.log('[Google] 아래 URL을 브라우저에서 열어 Google 계정으로 로그인해주세요:')
  console.log(url)
  console.log('\n로그인 후 리디렉션된 URL 전체를 복사해서 붙여넣어주세요:')

  const input = await new Promise<string>(resolve => {
    process.stdin.once('data', d => resolve(d.toString().trim()))
  })

  let code = input
  if (input.includes('code=')) {
    code = new URL(input).searchParams.get('code') ?? input
  }

  const { tokens } = await auth.getToken(code)
  fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true })
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens))
  console.log('[Google] 토큰 저장 완료 ✓ (YouTube + Sheets 권한 포함)')
}

export async function getAuthClient(): Promise<OAuth2Client> {
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error('[Google] 토큰이 없습니다. 먼저 "npm run automate login google"을 실행하세요.')
  }
  const auth = getOAuth2Client()
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'))
  auth.setCredentials(tokens)
  auth.on('tokens', t => {
    const updated = { ...tokens, ...t }
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(updated))
  })
  return auth
}
