import { chromium } from 'playwright'
import path from 'path'
import { fileURLToPath } from 'url'
import { hasSession, getStorageState, saveSession } from '../session-manager.js'
import { generateContent } from '../content-generator.js'
import { generateVideo } from '../video-generator.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VIDEO_PATH = path.join(__dirname, '..', 'youtube-output.mp4')

const STEALTH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-setuid-sandbox',
]
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export async function loginYoutube(): Promise<void> {
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

  console.log('[YouTube] 브라우저가 열립니다. Google 계정으로 YouTube에 로그인해주세요.')
  console.log('[YouTube] 로그인 완료 후 유튜브 홈이 뜨면 터미널에서 Enter를 눌러주세요...')

  await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded' })

  await new Promise<void>(resolve => {
    process.stdin.once('data', () => resolve())
  })

  await saveSession(context, 'youtube')
  await browser.close()
  console.log('[YouTube] 세션 저장 완료 ✓')
}

export async function postYoutube(): Promise<void> {
  if (!hasSession('youtube')) {
    throw new Error('[YouTube] 세션이 없습니다. 먼저 "npm run automate login youtube"를 실행하세요.')
  }

  // 1. 콘텐츠 + 영상 생성
  const content = await generateContent('threads')
  console.log('[YouTube] 생성된 콘텐츠:\n', content)
  await generateVideo(content, VIDEO_PATH)

  // 제목: 첫 줄 사용
  const title = content.split('\n')[0].replace(/[*#👉✨😭😔]/g, '').trim().slice(0, 90)
  const description = `${content}\n\n홀시 앱 → https://hol-si.com`

  const browser = await chromium.launch({ headless: true, args: STEALTH_ARGS })
  const context = await browser.newContext({
    storageState: getStorageState('youtube') as any,
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 900 },
  })

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  const page = await context.newPage()

  try {
    await page.goto('https://www.youtube.com/upload', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3_000)

    // 파일 업로드
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.setInputFiles(VIDEO_PATH)
    await page.waitForTimeout(3_000)
    console.log('[YouTube] 파일 업로드 완료')

    // 제목 입력 (오버레이 무시하고 JS로 포커스)
    const titleInput = page.locator('#title-textarea [contenteditable], #title [contenteditable], [aria-label*="제목"]').first()
    await titleInput.waitFor({ timeout: 15_000 })
    await page.screenshot({ path: 'youtube-debug.png' })
    await titleInput.evaluate((el: HTMLElement) => el.click())
    await page.waitForTimeout(500)
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Delete')
    await titleInput.type(title, { delay: 30 })
    console.log('[YouTube] 제목 입력 완료')

    // 설명 입력
    const descInput = page.locator('#description-textarea [contenteditable], [aria-label*="설명"]').first()
    if (await descInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await descInput.click()
      await descInput.type(description, { delay: 20 })
    }

    // "다음" 3번 클릭 (세부정보 → 동영상 요소 → 공개 설정)
    for (let i = 0; i < 3; i++) {
      const nextBtn = page.locator('button:has-text("다음"), [aria-label*="다음"]').last()
      await nextBtn.waitFor({ timeout: 10_000 })
      await nextBtn.click()
      await page.waitForTimeout(2_000)
      console.log(`[YouTube] 다음 ${i + 1}단계`)
    }

    // 공개 설정 → "공개"
    const publicBtn = page.locator('[name="PUBLIC"], label:has-text("공개")').first()
    if (await publicBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await publicBtn.click()
      await page.waitForTimeout(1_000)
    }

    // 저장 / 게시
    const saveBtn = page.getByText('저장', { exact: true }).last()
    await saveBtn.waitFor({ timeout: 10_000 })
    await saveBtn.click()
    await page.waitForTimeout(8_000)

    console.log('[YouTube] Shorts 업로드 완료 ✓')
    await saveSession(context, 'youtube')
  } catch (err) {
    console.error('[YouTube] 발행 실패:', err)
    await page.screenshot({ path: 'youtube-error.png' })
    throw err
  } finally {
    await browser.close()
  }
}
