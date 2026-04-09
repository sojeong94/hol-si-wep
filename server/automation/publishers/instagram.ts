import { chromium } from 'playwright'
import path from 'path'
import { fileURLToPath } from 'url'
import { hasSession, getStorageState, saveSession } from '../session-manager.js'
import { generateContent } from '../content-generator.js'
import { renderInstagramCards } from '../card-renderer.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CARDS_DIR = path.join(__dirname, '..')

const STEALTH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-setuid-sandbox',
]
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

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

// 4장 카드 내용으로 Instagram 캡션 생성
function buildCaption(content: string): string {
  const parts = content.split('---').map(p => p.trim()).filter(Boolean)
  // HOOK + CORE 조합으로 캡션 구성
  const hook = parts[0] ?? ''
  const core = parts[2] ?? ''
  return `${hook}\n\n${core}\n\n👉 https://hol-si.com\n\n#홀시 #여성건강 #생리주기 #생리통 #호르몬건강 #PMS #영양제 #자기관리 #건강정보 #웰니스`
}

export async function postInstagram(): Promise<void> {
  if (!hasSession('instagram')) {
    throw new Error('[Instagram] 세션이 없습니다. 먼저 "npm run automate login instagram"을 실행하세요.')
  }

  // 1. 콘텐츠 생성 (4장 구조)
  const content = await generateContent('instagram')
  console.log('[Instagram] 생성된 콘텐츠:\n', content)

  // 2. 4장 카드 이미지 생성
  const cardPaths = await renderInstagramCards(content, CARDS_DIR)
  console.log('[Instagram] 카드 이미지 생성 완료:', cardPaths)

  const caption = buildCaption(content)

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

    // 새 게시물 버튼
    const createBtn = page.locator([
      '[aria-label="새로운 게시물"]',
      '[aria-label="New post"]',
      '[aria-label="Create"]',
    ].join(', ')).first()

    const found = await createBtn.isVisible({ timeout: 8_000 }).catch(() => false)
    if (found) {
      await createBtn.click()
    } else {
      await page.goto('https://www.instagram.com/create/select/', { waitUntil: 'domcontentloaded' })
    }
    await page.waitForTimeout(2_500)

    // 4장 파일 업로드 (캐러셀)
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.setInputFiles(cardPaths)
    await page.waitForTimeout(6_000)
    await page.screenshot({ path: 'instagram-upload.png' })
    console.log('[Instagram] 4장 업로드 완료')

    // 다음 버튼 2번
    for (let step = 1; step <= 2; step++) {
      const nextBtn = page.locator('div[role="dialog"] >> text=다음').last()
        .or(page.locator('div[role="dialog"] >> text=Next').last())
        .or(page.getByRole('button', { name: '다음' }).last())
        .or(page.getByRole('button', { name: 'Next' }).last())
      await nextBtn.waitFor({ timeout: 15_000 })
      await nextBtn.click()
      console.log(`[Instagram] 다음 ${step}단계 클릭`)
      await page.waitForTimeout(3_000)
    }

    // 캡션 입력
    const captionBox = page.locator(
      '[aria-label*="문구"], [aria-label*="caption"], [aria-label*="Caption"], [contenteditable="true"]'
    ).first()
    await captionBox.waitFor({ timeout: 8_000 })
    await captionBox.click()
    await page.waitForTimeout(500)
    await captionBox.type(caption, { delay: 20 })
    await page.waitForTimeout(1_000)
    await page.screenshot({ path: 'instagram-before-share.png' })

    // 공유하기
    const shareBtn = page.getByRole('button', { name: 'Share', exact: true }).first()
      .or(page.getByRole('button', { name: '공유하기', exact: true }).first())
    await shareBtn.first().waitFor({ timeout: 12_000 })
    await shareBtn.first().click()
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
