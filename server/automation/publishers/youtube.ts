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

    // 본인 인증 팝업 닫기
    const verifyPopup = page.getByRole('button', { name: '다음' }).first()
    const hasPopup = await verifyPopup.isVisible({ timeout: 3_000 }).catch(() => false)
    if (hasPopup) {
      await verifyPopup.evaluate((el: HTMLElement) => el.click())
      await page.waitForTimeout(1_000)
      console.log('[YouTube] 본인 인증 팝업 닫음')
    }

    // 제목 입력 (기존 텍스트 전체 선택 후 교체)
    const titleInput = page.locator('#title-textarea [contenteditable]').first()
    await titleInput.waitFor({ timeout: 15_000 })
    await titleInput.evaluate((el: HTMLElement) => {
      el.focus()
      ;(document as any).execCommand('selectAll')
      ;(document as any).execCommand('delete')
    })
    await page.waitForTimeout(300)
    await titleInput.type(title, { delay: 30 })
    console.log('[YouTube] 제목 입력 완료')

    // 설명 입력 (JS 클릭으로 오버레이 우회, 실패 시 건너뜀)
    const descInput = page.locator('#description-textarea [contenteditable]').first()
    const descVisible = await descInput.isVisible({ timeout: 3_000 }).catch(() => false)
    if (descVisible) {
      await descInput.evaluate((el: HTMLElement) => el.click())
      await page.waitForTimeout(500)
      await descInput.type(description, { delay: 20 })
    }

    // 아동용 동영상 여부 선택 (필수)
    const notForKids = page.getByText('아니요, 아동용이 아닙니다').first()
      .or(page.getByText("No, it's not made for kids").first())
    const hasKidsQ = await notForKids.isVisible({ timeout: 3_000 }).catch(() => false)
    if (hasKidsQ) {
      await notForKids.evaluate((el: HTMLElement) => el.click())
      console.log('[YouTube] 아동용 아님 선택')
    }

    // "다음" 3번 클릭 (세부정보 → 동영상 요소 → 공개 설정)
    for (let i = 0; i < 3; i++) {
      // 본인 인증 팝업 있으면 닫기
      const popup = page.locator('yt-confirm-dialog-renderer button, tp-yt-paper-dialog button').getByText('다음').first()
        .or(page.locator('yt-confirm-dialog-renderer button, tp-yt-paper-dialog button').getByText('Next').first())
      const hasPopup2 = await popup.isVisible({ timeout: 1_000 }).catch(() => false)
      if (hasPopup2) {
        await popup.evaluate((el: HTMLElement) => el.click())
        await page.waitForTimeout(500)
      }

      const nextBtn = page.locator('#next-button button').first()
      await nextBtn.waitFor({ state: 'attached', timeout: 10_000 })
      await nextBtn.evaluate((el: HTMLElement) => el.click())
      await page.waitForTimeout(2_000)
      console.log(`[YouTube] 다음 ${i + 1}단계`)
    }

    // 공개 설정 화면 스크린샷
    await page.screenshot({ path: 'youtube-public.png' })

    // 본인 인증 팝업 닫기 (공개 상태 진입 시)
    const dismissPopup = async () => {
      const popupBtn = page.getByRole('button', { name: '다음' }).or(page.getByRole('button', { name: 'Next' }))
      const visible = await popupBtn.first().isVisible({ timeout: 2_000 }).catch(() => false)
      if (visible) {
        await popupBtn.first().evaluate((el: HTMLElement) => el.click())
        await page.waitForTimeout(500)
        console.log('[YouTube] 팝업 닫음')
      }
    }
    await dismissPopup()

    // 공개 선택 — 라디오 버튼 직접 JS 클릭
    await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label, tp-yt-paper-radio-button'))
      const pub = labels.find(el => el.textContent?.trim().startsWith('공개') || el.textContent?.trim().startsWith('Public'))
      if (pub) (pub as HTMLElement).click()
    })
    await page.waitForTimeout(1_000)
    console.log('[YouTube] 공개 설정 완료')

    await dismissPopup()
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'youtube-before-save.png' })

    // 저장 버튼 — 내부 button 직접 클릭
    const clicked = await page.evaluate(() => {
      // 1) #save-button 내부 button
      const btn1 = document.querySelector('#save-button button') as HTMLElement | null
      if (btn1) { btn1.click(); return '#save-button button' }
      // 2) ytcpButtonShapeImpl__button-text-content 중 저장/Save 텍스트
      const spans = Array.from(document.querySelectorAll('.ytcpButtonShapeImpl__button-text-content'))
      const span = spans.find(el => el.textContent?.trim() === '저장' || el.textContent?.trim() === 'Save')
      const btn2 = span?.closest('button') as HTMLElement | null
      if (btn2) { btn2.click(); return 'span closest button' }
      return null
    })
    console.log('[YouTube] 저장 버튼 클릭:', clicked)
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
