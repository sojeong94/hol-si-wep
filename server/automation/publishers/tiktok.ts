import { chromium } from 'playwright'
import path from 'path'
import { fileURLToPath } from 'url'
import { hasSession, getStorageState, saveSession } from '../session-manager.js'
import { generateContent } from '../content-generator.js'
import { generateVideo } from '../video-generator.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VIDEO_PATH = path.join(__dirname, '..', 'tiktok-output.mp4')

const STEALTH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-setuid-sandbox',
]
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export async function loginTiktok(): Promise<void> {
  const browser = await chromium.launch({ headless: false, args: STEALTH_ARGS })
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 800 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  })

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  const page = await context.newPage()

  console.log('[TikTok] 브라우저가 열립니다. TikTok에 직접 로그인해주세요.')
  console.log('[TikTok] 로그인 완료 후 홈이 뜨면 터미널에서 Enter를 눌러주세요...')

  await page.goto('https://www.tiktok.com/login', { waitUntil: 'domcontentloaded' })

  await new Promise<void>(resolve => {
    process.stdin.once('data', () => resolve())
  })

  await saveSession(context, 'tiktok')
  await browser.close()
  console.log('[TikTok] 세션 저장 완료 ✓')
}

export async function postTiktok(): Promise<void> {
  if (!hasSession('tiktok')) {
    throw new Error('[TikTok] 세션이 없습니다. 먼저 "npm run automate login tiktok"을 실행하세요.')
  }

  // 1. 콘텐츠 + 영상 생성
  const content = await generateContent('threads')
  console.log('[TikTok] 생성된 콘텐츠:\n', content)
  await generateVideo(content, VIDEO_PATH)

  const caption = content
    .split('\n')
    .slice(0, 3)
    .join(' ')
    .replace(/\*\*/g, '')
    .trim()
    .slice(0, 150) + ' #홀시 #여성건강 #생리주기 https://hol-si.com'

  const browser = await chromium.launch({ headless: false, args: STEALTH_ARGS })
  const context = await browser.newContext({
    storageState: getStorageState('tiktok') as any,
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 900 },
  })

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  const page = await context.newPage()

  try {
    await page.goto('https://www.tiktok.com/upload', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(4_000)
    await page.screenshot({ path: 'tiktok-debug.png' })

    // 파일 업로드
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.setInputFiles(VIDEO_PATH)
    await page.waitForTimeout(8_000) // 업로드 처리 대기
    console.log('[TikTok] 파일 업로드 완료')

    // 캡션 입력
    const captionInput = page.locator(
      '[contenteditable="true"], [data-placeholder*="설명"], [data-placeholder*="caption"]'
    ).first()
    await captionInput.waitFor({ timeout: 15_000 })
    await captionInput.click()
    await captionInput.type(caption, { delay: 25 })
    await page.waitForTimeout(1_000)
    console.log('[TikTok] 캡션 입력 완료')

    // 게시 버튼
    const postBtn = page.getByText('게시', { exact: true })
      .or(page.getByText('Post', { exact: true }))
      .last()
    await postBtn.waitFor({ timeout: 10_000 })
    await postBtn.click()
    await page.waitForTimeout(8_000)

    console.log('[TikTok] 업로드 완료 ✓')
    await saveSession(context, 'tiktok')
  } catch (err) {
    console.error('[TikTok] 발행 실패:', err)
    await page.screenshot({ path: 'tiktok-error.png' })
    throw err
  } finally {
    await browser.close()
  }
}
