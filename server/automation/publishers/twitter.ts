import { chromium } from 'playwright'
import { hasSession, getStorageState, saveSession } from '../session-manager.js'
import { generateContent, ContentOptions } from '../content-generator.js'

const USER = (process.env.TWITTER_USERNAME ?? '').replace(/^@/, '') // @ 자동 제거
const PASS = process.env.TWITTER_PASSWORD!

// 봇 감지 우회용 공통 브라우저 옵션
const STEALTH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-infobars',
  '--window-size=1280,800',
]
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// 처음 한 번만 실행 — 브라우저 창을 열고 사용자가 직접 로그인하면 자동 저장
export async function loginTwitter(): Promise<void> {
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

  console.log('[Twitter] 브라우저가 열립니다. X에 직접 로그인해주세요.')
  console.log('[Twitter] 로그인 완료 후 홈 화면이 뜨면 자동으로 세션이 저장됩니다.')

  await page.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded' })

  // 로그인 후 사용자가 직접 Enter로 저장 확정
  console.log('\n로그인 완료 후 홈 화면이 뜨면 이 터미널에서 Enter를 눌러주세요...')
  await new Promise<void>(resolve => {
    process.stdin.once('data', () => resolve())
  })

  console.log('[Twitter] 세션 저장 중...')
  await saveSession(context, 'twitter')
  await browser.close()
  console.log('[Twitter] 세션 저장 완료 ✓')
}

// 자동 발행 — 저장된 세션 재사용
export async function postTweet(options?: ContentOptions): Promise<string> {
  if (!hasSession('twitter')) {
    throw new Error('[Twitter] 세션이 없습니다. 먼저 "npm run automate login twitter"를 실행하세요.')
  }

  const content = await generateContent('twitter', options)
  console.log('[Twitter] 생성된 콘텐츠:\n', content)

  const browser = await chromium.launch({ headless: true, args: STEALTH_ARGS })
  const context = await browser.newContext({
    storageState: getStorageState('twitter') as any,
    userAgent: USER_AGENT,
  })
  const page = await context.newPage()

  try {
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' })

    // 트윗 입력창
    await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 15_000 })
    await page.click('[data-testid="tweetTextarea_0"]')
    await page.waitForTimeout(500)

    // 자연스럽게 타이핑
    await page.type('[data-testid="tweetTextarea_0"]', content, { delay: 40 })
    await page.waitForTimeout(1_000)

    // 발행 버튼
    await page.click('[data-testid="tweetButtonInline"]')
    await page.waitForTimeout(3_000)

    // 프로필에서 최신 트윗 URL 캡처
    await page.goto(`https://x.com/${USER}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3_000)
    // Twitter는 /status/ 링크가 여러 형태로 존재 — time 태그 부모 a 태그에서 추출
    const firstHref = await page.locator('a[href*="/status/"]').first()
      .getAttribute('href').catch(() => null)
    const tweetUrl = firstHref
      ? (firstHref.startsWith('http') ? firstHref : `https://x.com${firstHref}`)
      : `https://x.com/${USER}`
    console.log('[Twitter] 트윗 발행 완료 ✓')
    await saveSession(context, 'twitter')
    return tweetUrl
  } catch (err) {
    console.error('[Twitter] 발행 실패:', err)
    throw err
  } finally {
    await browser.close()
  }
}
