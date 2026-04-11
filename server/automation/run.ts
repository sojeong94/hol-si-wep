/**
 * 수동 실행 CLI
 *
 * 사용법:
 *   npm run automate post   twitter   — 즉시 트윗 발행 테스트
 *   npm run automate post   instagram — Instagram 카드 발행 (AdsPower k1bchih2)
 *   npm run automate post   tiktok    — TikTok 영상 발행 (AdsPower k1bchih2)
 *   npm run automate post   all       — 5개 플랫폼 일괄 발행 (시트 기반)
 *   npm run automate report           — 일일 보고 출력
 */

import { startAutomationScheduler } from './scheduler.js'
import { loginTwitter, postTweet } from './publishers/twitter.js'
import { loginThreads, postThread } from './publishers/threads.js'
import { loginInstagram, postInstagram } from './publishers/instagram.js'
import { loginYoutube, postYoutube } from './publishers/youtube.js'
import { loginTiktok, postTiktok } from './publishers/tiktok.js'
import { clearSession, importFromCookieEditor } from './session-manager.js'
import { loginGoogle } from './google-auth.js'
import { postAllFromSheets } from './post-all.js'
import { setupSNSColumns } from './sheets-manager.js'
import { printDailyReport } from './reporter.js'
import { updateDashboard } from './dashboard.js'

const [, , command, platform, filePath] = process.argv

type Action = () => Promise<void>

const COMMANDS: Record<string, Action> = {
  'login google':    loginGoogle,
  'post all':        postAllFromSheets,
  'schedule ':       async () => {
    await postAllFromSheets()          // 오늘 즉시 발행
    startAutomationScheduler()         // 이후 스케줄러 유지
    await new Promise(() => {})        // 프로세스 종료 방지
  },
  'setup sheets':    setupSNSColumns,
  'report ':         printDailyReport,
  'dashboard ':      updateDashboard,
  'login twitter':   loginTwitter,
  'login threads':   loginThreads,
  'post twitter':    postTweet,
  'post threads':    postThread,
  'login instagram': loginInstagram,   // AdsPower 안내 출력
  'post instagram':  postInstagram,
  'clear twitter':   async () => clearSession('twitter'),
  'clear threads':   async () => clearSession('threads'),
  'login youtube':   loginYoutube,
  'post youtube':    postYoutube,
  'clear youtube':   async () => clearSession('youtube'),
  'login tiktok':    loginTiktok,      // AdsPower 안내 출력
  'post tiktok':     postTiktok,
  'import twitter': async () => {
    const p = filePath ?? 'twitter-cookies.json'
    importFromCookieEditor('twitter', p)
  },
  'import threads': async () => {
    const p = filePath ?? 'threads-cookies.json'
    importFromCookieEditor('threads', p)
  },
}

const key = `${command} ${platform ?? ''}`
const action = COMMANDS[key] ?? COMMANDS[`${command} `]

if (!action) {
  console.log(`
사용법: npm run automate <command> <platform> [파일경로]

명령어:
  login   twitter                      — X 로그인 (브라우저 창 열림, 최초 1회)
  login   threads                      — Threads 로그인 (브라우저 창 열림, 최초 1회)
  login   instagram                    — AdsPower 프로필 로그인 안내
  login   youtube                      — YouTube OAuth2 인증 (최초 1회)
  login   tiktok                       — AdsPower 프로필 로그인 안내
  import  twitter  [cookies.json]      — 쿠키 파일로 X 세션 생성
  import  threads  [cookies.json]      — 쿠키 파일로 Threads 세션 생성
  post    twitter                      — X 트윗 즉시 발행
  post    threads                      — Threads 즉시 발행
  post    instagram                    — Instagram 카드 발행 (AdsPower)
  post    youtube                      — YouTube Shorts 업로드
  post    tiktok                       — TikTok 영상 업로드 (AdsPower)
  post    all                          — 5개 플랫폼 일괄 발행 (시트 기반)
  clear   twitter|threads|youtube      — 세션 초기화
  report                               — 일일 Silo 보고 출력

※ 네이버 블로그: Python naver_bot 폴더에서 "python main.py" 로 별도 실행
  `)
  process.exit(1)
}

action()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
