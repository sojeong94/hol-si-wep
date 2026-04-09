import { chromium } from 'playwright'
import { hasSession, getStorageState, saveSession } from '../session-manager.js'
import { generateContent } from '../content-generator.js'

// Threads는 Instagram 계정으로 로그인
const USER = process.env.THREADS_USERNAME!
const PASS = process.env.THREADS_PASSWORD!

const STEALTH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-setuid-sandbox',
]
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// 처음 한 번만 실행 — 브라우저 창을 열고 사용자가 직접 로그인하면 자동 저장
export async function loginThreads(): Promise<void> {
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

  console.log('[Threads] 브라우저가 열립니다. Threads에 직접 로그인해주세요.')
  console.log('[Threads] 로그인 완료 후 홈 화면이 뜨면 자동으로 세션이 저장됩니다.')

  await page.goto('https://www.threads.net', { waitUntil: 'domcontentloaded' })

  // 로그인 후 사용자가 직접 Enter로 저장 확정
  console.log('\n로그인 완료 후 홈 화면이 뜨면 이 터미널에서 Enter를 눌러주세요...')
  await new Promise<void>(resolve => {
    process.stdin.once('data', () => resolve())
  })

  console.log('[Threads] 세션 저장 중...')
  await saveSession(context, 'threads')
  await browser.close()
  console.log('[Threads] 세션 저장 완료 ✓')
}

// 자동 발행 — 저장된 세션 재사용
export async function postThread(): Promise<void> {
  if (!hasSession('threads')) {
    throw new Error('[Threads] 세션이 없습니다. 먼저 "npm run automate login threads"를 실행하세요.')
  }

  const content = await generateContent('threads')
  console.log('[Threads] 생성된 콘텐츠:\n', content)

  const browser = await chromium.launch({ headless: true, args: STEALTH_ARGS })
  const context = await browser.newContext({
    storageState: getStorageState('threads') as any,
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 800 },
  })
  const page = await context.newPage()

  try {
    await page.goto('https://www.threads.net/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(4_000)

    // 페이지 구조 파악용 스크린샷
    await page.screenshot({ path: 'threads-debug.png', fullPage: false })
    console.log('[Threads] 스크린샷 저장 → threads-debug.png')

    // 1. 오른쪽 하단 + 버튼 클릭 (작성 모달 열기)
    const composeBtn = page.locator('div[role="button"] svg, a[role="link"] svg').filter({ hasText: '+' }).first()
    const composeBtnAlt = page.locator('[aria-label*="작성"], [aria-label*="Create"], [aria-label*="New"], [aria-label*="thread"]').first()

    if (await composeBtnAlt.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await composeBtnAlt.click()
    } else {
      // + 버튼을 위치로 직접 클릭 (우하단)
      const viewport = page.viewportSize()!
      await page.mouse.click(viewport.width - 30, viewport.height - 60)
    }

    await page.waitForTimeout(2_000)
    await page.screenshot({ path: 'threads-debug2.png' })
    console.log('[Threads] 모달 오픈 후 스크린샷 → threads-debug2.png')

    // 2. 모달 내 텍스트 입력창
    const editor = page.locator('[contenteditable="true"], [data-lexical-editor="true"], [aria-placeholder]').first()
    await editor.waitFor({ timeout: 5_000 })
    await editor.click()
    await page.waitForTimeout(500)
    await editor.type(content, { delay: 35 })
    await page.waitForTimeout(1_500)

    // 3. 게시 버튼
    const postBtn = page.locator('button:has-text("게시"), button:has-text("Post"), [role="button"]:has-text("게시"), [role="button"]:has-text("Post")').last()
    await postBtn.waitFor({ timeout: 5_000 })
    await postBtn.click()
    console.log('[Threads] 게시 버튼 클릭')

    await page.waitForTimeout(3_000)
    console.log('[Threads] 스레드 발행 완료 ✓')
    await saveSession(context, 'threads')
  } catch (err) {
    console.error('[Threads] 발행 실패:', err)
    throw err
  } finally {
    await browser.close()
  }
}
