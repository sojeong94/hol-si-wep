/**
 * 수동 실행 CLI
 *
 * 사용법:
 *   npm run automate login  twitter   — 처음 로그인 (브라우저 창 열림)
 *   npm run automate login  threads   — 처음 로그인
 *   npm run automate post   twitter   — 즉시 트윗 발행 테스트
 *   npm run automate post   threads   — 즉시 스레드 발행 테스트
 */

import { loginTwitter, postTweet } from './publishers/twitter.js'
import { loginThreads, postThread } from './publishers/threads.js'
import { loginInstagram, postInstagram } from './publishers/instagram.js'
import { loginYoutube, postYoutube } from './publishers/youtube.js'
import { loginTiktok, postTiktok } from './publishers/tiktok.js'
import { clearSession, importFromCookieEditor } from './session-manager.js'

const [, , command, platform, filePath] = process.argv

type Action = () => Promise<void>

const COMMANDS: Record<string, Action> = {
  'login twitter':  loginTwitter,
  'login threads':  loginThreads,
  'post twitter':   postTweet,
  'post threads':   postThread,
  'login instagram': loginInstagram,
  'post instagram':  postInstagram,
  'clear twitter':   async () => clearSession('twitter'),
  'clear threads':   async () => clearSession('threads'),
  'clear instagram': async () => clearSession('instagram'),
  'login youtube':   loginYoutube,
  'post youtube':    postYoutube,
  'clear youtube':   async () => clearSession('youtube'),
  'login tiktok':    loginTiktok,
  'post tiktok':     postTiktok,
  'clear tiktok':    async () => clearSession('tiktok'),
  'import twitter': async () => {
    const p = filePath ?? 'twitter-cookies.json'
    importFromCookieEditor('twitter', p)
  },
  'import threads': async () => {
    const p = filePath ?? 'threads-cookies.json'
    importFromCookieEditor('threads', p)
  },
}

const key = `${command} ${platform}`
const action = COMMANDS[key]

if (!action) {
  console.log(`
사용법: npm run automate <command> <platform> [파일경로]

명령어:
  login   twitter                      — X 로그인 (브라우저 창 열림, 최초 1회)
  login   threads                      — Threads 로그인 (브라우저 창 열림, 최초 1회)
  import  twitter  [cookies.json]      — 쿠키 파일로 X 세션 생성 (기본: twitter-cookies.json)
  import  threads  [cookies.json]      — 쿠키 파일로 Threads 세션 생성 (기본: threads-cookies.json)
  post    twitter                      — X 트윗 즉시 발행 (테스트)
  post    threads                      — Threads 즉시 발행 (테스트)
  post    instagram                    — Instagram 카드 이미지 발행 (테스트)
  clear   twitter                      — X 세션 초기화
  clear   threads                      — Threads 세션 초기화
  clear   instagram                    — Instagram 세션 초기화
  `)
  process.exit(1)
}

action()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
