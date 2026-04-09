import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateContent } from '../content-generator.js'
import { generateVideo } from '../video-generator.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VIDEO_PATH = path.join(__dirname, '..', 'youtube-output.mp4')
const CLIENT_SECRET_PATH = path.join(__dirname, '..', 'client_secret.json')
const TOKEN_PATH = path.join(__dirname, '..', 'sessions', 'youtube-token.json')

function getOAuth2Client(): OAuth2Client {
  const secret = JSON.parse(fs.readFileSync(CLIENT_SECRET_PATH, 'utf-8'))
  const { client_id, client_secret, redirect_uris } = secret.installed ?? secret.web
  return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
}

export async function loginYoutube(): Promise<void> {
  const auth = getOAuth2Client()
  const url = auth.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/youtube.upload'],
  })

  console.log('[YouTube] 아래 URL을 브라우저에서 열어 Google 계정으로 로그인해주세요:')
  console.log(url)
  console.log('\n로그인 후 리디렉션된 URL 전체를 복사해서 붙여넣어주세요:')

  const input = await new Promise<string>(resolve => {
    process.stdin.once('data', d => resolve(d.toString().trim()))
  })

  // URL 전체 또는 code 값만 입력해도 처리
  let code = input
  if (input.includes('code=')) {
    code = new URL(input).searchParams.get('code') ?? input
  }

  const { tokens } = await auth.getToken(code)
  fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true })
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens))
  console.log('[YouTube] 토큰 저장 완료 ✓')
}

async function getAuthClient(): Promise<OAuth2Client> {
  const auth = getOAuth2Client()
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'))
  auth.setCredentials(tokens)
  // 토큰 갱신 시 자동 저장
  auth.on('tokens', t => {
    const updated = { ...tokens, ...t }
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(updated))
  })
  return auth
}

export async function postYoutube(): Promise<void> {
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error('[YouTube] 토큰이 없습니다. 먼저 "npm run automate login youtube"를 실행하세요.')
  }

  const content = await generateContent('youtube')
  console.log('[YouTube] 생성된 콘텐츠:\n', content)
  await generateVideo(content, VIDEO_PATH)

  const lines = content.split('\n').filter(l => l.trim())
  // 첫 줄을 제목으로, 특수문자/이모지 제거 후 50자 이내
  const title = lines[0]
    .replace(/[^\uAC00-\uD7A3\u0020-\u007E]/g, '')
    .replace(/[*#>]/g, '')
    .trim()
    .slice(0, 50)
  const body = lines.slice(1).join('\n').trim()
  const description = `${body}\n\n홀시 앱 → https://hol-si.com\n\n#홀시 #여성건강 #생리주기 #생리통 #PMS #호르몬 #Shorts`

  const auth = await getAuthClient()
  const youtube = google.youtube({ version: 'v3', auth })

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description,
        tags: ['홀시', '여성건강', '생리주기', '생리통', 'PMS', '호르몬', 'Shorts'],
        categoryId: '22',
      },
      status: {
        privacyStatus: 'public',
      },
    },
    media: {
      body: fs.createReadStream(VIDEO_PATH),
    },
  })

  console.log('[YouTube] Shorts 업로드 완료 ✓ ID:', res.data.id)
}
