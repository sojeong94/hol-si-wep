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

async function dismissTiktokModal(page: any): Promise<void> {
  // "Got it" / "알겠어요" 류 버튼이 있는 안내 팝업 닫기
  const gotItBtn = page.getByRole('button', { name: /got it|알겠|확인|닫기/i }).first()
  if (await gotItBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await gotItBtn.click()
    await page.waitForTimeout(1_000)
    console.log('[TikTok] 안내 팝업 닫음 (Got it)')
    return
  }

  // TUXModal 계열 팝업 — Escape
  const modal = page.locator('.TUXModal-overlay, [class*="modal-desc"], [class*="TUXModal"]').first()
  if (await modal.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(1_000)
    console.log('[TikTok] 팝업 닫음 (Escape)')
  }
}

export async function postTiktok(): Promise<void> {
  if (!hasSession('tiktok')) {
    throw new Error('[TikTok] 세션이 없습니다. 먼저 "npm run automate login tiktok"을 실행하세요.')
  }

  // 1. 콘텐츠 + 영상 생성
  const content = await generateContent('tiktok')
  console.log('[TikTok] 생성된 콘텐츠:\n', content)
  await generateVideo(content, VIDEO_PATH)

  const caption = content
    .split('\n')
    .slice(0, 3)
    .join(' ')
    .replace(/\*\*/g, '')
    .trim()
    .slice(0, 150) + ' #홀시 #여성건강 #생리주기 https://hol-si.com'

  const browser = await chromium.launch({ headless: true, args: STEALTH_ARGS })
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
    // Creator Studio 업로드 페이지로 이동
    await page.goto('https://www.tiktok.com/creator-center/upload', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForTimeout(6_000)
    await page.screenshot({ path: 'tiktok-debug.png' })

    // 파일 업로드 — file input은 항상 hidden이므로 attached 상태만 확인
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.waitFor({ state: 'attached', timeout: 15_000 })
    await fileInput.setInputFiles(VIDEO_PATH)
    await page.waitForTimeout(10_000) // 업로드 처리 대기
    console.log('[TikTok] 파일 업로드 완료')
    await page.screenshot({ path: 'tiktok-after-upload.png' })

    // 팝업/모달 닫기 (업로드 후 뜨는 안내 팝업)
    await dismissTiktokModal(page)

    // 캡션 입력 — DraftEditor 직접 타입
    const captionInput = page.locator('.public-DraftEditor-content').first()
      .or(page.locator('[contenteditable="true"]').first())
    await captionInput.waitFor({ timeout: 15_000 })
    await captionInput.click({ force: true })
    await page.waitForTimeout(500)
    await captionInput.type(caption, { delay: 30 })
    await page.waitForTimeout(1_000)
    console.log('[TikTok] 캡션 입력 완료')

    // 자동 콘텐츠 검사 팝업이 뜰 수 있음 → 오른쪽 확인 버튼 클릭
    const contentCheckModal = page.locator('[class*="modal"], [class*="Modal"]').filter({ hasText: /content check|콘텐츠 검사/i }).first()
    if (await contentCheckModal.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const confirmBtn = contentCheckModal.getByRole('button').last()
      await confirmBtn.click()
      await page.waitForTimeout(2_000)
      console.log('[TikTok] 콘텐츠 검사 팝업 확인')
    }

    // 게시 버튼
    const postBtn = page.locator('button[data-e2e="post_video_button"]')
    await postBtn.waitFor({ timeout: 20_000 })
    await postBtn.click()
    await page.waitForTimeout(10_000)
    await page.screenshot({ path: 'tiktok-result.png' })

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
