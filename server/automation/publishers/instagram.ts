import { chromium } from 'playwright'
import path from 'path'
import { fileURLToPath } from 'url'
import { hasSession, getStorageState, saveSession } from '../session-manager.js'
import { generateContent } from '../content-generator.js'
import { renderCard } from '../card-renderer.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CARD_PATH = path.join(__dirname, '..', 'card-output.png')

const STEALTH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-setuid-sandbox',
]
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// 처음 한 번만 실행 — 직접 로그인 후 Enter로 세션 저장
export async function loginInstagram(): Promise<void> {
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

  console.log('[Instagram] 브라우저가 열립니다. Instagram에 직접 로그인해주세요.')
  console.log('[Instagram] 홈 화면이 뜨면 터미널에서 Enter를 눌러주세요...')

  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded' })

  await new Promise<void>(resolve => {
    process.stdin.once('data', () => resolve())
  })

  await saveSession(context, 'instagram')
  await browser.close()
  console.log('[Instagram] 세션 저장 완료 ✓')
}

// 자동 발행
export async function postInstagram(): Promise<void> {
  if (!hasSession('instagram')) {
    throw new Error('[Instagram] 세션이 없습니다. 먼저 "npm run automate login instagram"을 실행하세요.')
  }

  // 1. 콘텐츠 생성
  const content = await generateContent('threads')
  console.log('[Instagram] 생성된 콘텐츠:\n', content)

  // 2. 카드 이미지 생성
  await renderCard(content, CARD_PATH)

  // 3. Instagram 발행
  const browser = await chromium.launch({ headless: true, args: STEALTH_ARGS })
  const context = await browser.newContext({
    storageState: getStorageState('instagram') as any,
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 900 },
  })

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  const page = await context.newPage()

  try {
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(4_000)
    await page.screenshot({ path: 'instagram-debug.png' })

    // 새로운 게시물 버튼 클릭 (여러 선택자 시도)
    const createBtn = page.locator([
      '[aria-label="새로운 게시물"]',
      '[aria-label="New post"]',
      '[aria-label="Create"]',
      'svg[aria-label="새로운 게시물"]',
    ].join(', ')).first()

    const found = await createBtn.isVisible({ timeout: 8_000 }).catch(() => false)
    if (found) {
      await createBtn.click()
    } else {
      // 직접 create 페이지로 이동
      await page.goto('https://www.instagram.com/create/select/', { waitUntil: 'domcontentloaded' })
    }
    await page.waitForTimeout(2_500)

    // 파일 업로드 input (숨겨진 요소)
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.setInputFiles(CARD_PATH)
    await page.waitForTimeout(4_000)
    await page.screenshot({ path: 'instagram-upload.png' })
    console.log('[Instagram] 업로드 후 스크린샷 → instagram-upload.png')

    // 다음 버튼 (모달 헤더 우측 텍스트 버튼) — 2단계 반복
    for (let step = 1; step <= 2; step++) {
      // 텍스트로 직접 찾기 (가장 신뢰성 높음)
      const nextBtn = page.getByText('다음', { exact: true }).last()
      await nextBtn.waitFor({ timeout: 10_000 })
      await nextBtn.click()
      console.log(`[Instagram] 다음 ${step}단계 클릭`)
      await page.waitForTimeout(2_500)
      await page.screenshot({ path: `instagram-step${step}.png` })
    }

    // 캡션 입력
    const captionBox = page.locator(
      '[aria-label*="문구"], [aria-label*="caption"], [aria-label*="Caption"], [aria-multiline="true"], [contenteditable="true"]'
    ).first()
    await captionBox.waitFor({ timeout: 8_000 })
    await captionBox.click()
    await page.waitForTimeout(500)
    await captionBox.type(content, { delay: 25 })
    await page.waitForTimeout(1_000)

    // 공유하기 버튼
    const shareBtn = page.getByText('공유하기', { exact: true }).last()
    await shareBtn.waitFor({ timeout: 8_000 })
    await shareBtn.click()
    await page.waitForTimeout(5_000)

    console.log('[Instagram] 게시 완료 ✓')
    await saveSession(context, 'instagram')
  } catch (err) {
    console.error('[Instagram] 발행 실패:', err)
    await page.screenshot({ path: 'instagram-error.png' })
    throw err
  } finally {
    await browser.close()
  }
}
