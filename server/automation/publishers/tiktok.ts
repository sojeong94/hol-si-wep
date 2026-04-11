import { chromium } from 'playwright'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateContent, ContentOptions } from '../content-generator.js'
import { generateVideo } from '../video-generator.js'
import { startAdsPower, stopAdsPower } from '../adspower-client.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VIDEO_PATH = path.join(__dirname, '..', 'tiktok-output.mp4')

const PROFILE_ID = process.env.ADSPOWER_SNS_PROFILE_ID ?? 'k1bchih2'

export async function loginTiktok(): Promise<void> {
  console.log('[TikTok] AdsPower 프로필 방식으로 세션을 관리합니다.')
  console.log(`[TikTok] AdsPower에서 프로필 "${PROFILE_ID}"을 열고 TikTok에 직접 로그인 후`)
  console.log('[TikTok] AdsPower에서 브라우저를 닫으면 세션이 프로필에 자동 저장됩니다.')
}

async function dismissTiktokModal(page: any): Promise<void> {
  const gotItBtn = page.getByRole('button', { name: /got it|알겠|확인|닫기/i }).first()
  if (await gotItBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await gotItBtn.click()
    await page.waitForTimeout(1_000)
    console.log('[TikTok] 안내 팝업 닫음 (Got it)')
    return
  }

  const modal = page.locator('.TUXModal-overlay, [class*="modal-desc"], [class*="TUXModal"]').first()
  if (await modal.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(1_000)
    console.log('[TikTok] 팝업 닫음 (Escape)')
  }
}

// sharedVideoPath: post-all.ts에서 Instagram 카드 슬라이드쇼 영상 전달 시 재생성 생략
export async function postTiktok(
  options?: ContentOptions,
  sharedVideoPath?: string
): Promise<string> {
  // 1. 캡션용 콘텐츠 생성 (영상은 공유본 사용 가능)
  const content = await generateContent('tiktok', options)
  console.log('[TikTok] 생성된 콘텐츠:\n', content)

  if (sharedVideoPath) {
    console.log('[TikTok] 공유 슬라이드쇼 영상 사용 ✓', sharedVideoPath)
  } else {
    await generateVideo(content, VIDEO_PATH)
  }
  const videoFile = sharedVideoPath ?? VIDEO_PATH

  const caption = content
    .split('\n')
    .slice(0, 3)
    .join(' ')
    .replace(/\*\*/g, '')
    .trim()
    .slice(0, 150) + ' #홀시 #여성건강 #생리주기 https://hol-si.com'

  // 2. AdsPower 프로필로 브라우저 연결 (이미 TikTok 로그인 상태)
  const wsUrl = await startAdsPower(PROFILE_ID)
  const browser = await chromium.connectOverCDP(wsUrl)
  const context = browser.contexts()[0]
  const page = await context.newPage()

  try {
    await page.goto('https://www.tiktok.com/creator-center/upload', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForTimeout(6_000)
    await page.screenshot({ path: 'tiktok-debug.png', timeout: 10_000 }).catch(() => {})

    // 파일 업로드
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.waitFor({ state: 'attached', timeout: 15_000 })
    await fileInput.setInputFiles(videoFile)
    await page.waitForTimeout(10_000)
    console.log('[TikTok] 파일 업로드 완료')
    await page.screenshot({ path: 'tiktok-after-upload.png', timeout: 10_000 }).catch(() => {})

    // 팝업/모달 닫기
    await dismissTiktokModal(page)

    // 캡션 입력
    const captionInput = page.locator('.public-DraftEditor-content').first()
      .or(page.locator('[contenteditable="true"]').first())
    await captionInput.waitFor({ timeout: 15_000 })
    await captionInput.click({ force: true })
    await page.waitForTimeout(500)
    // DraftEditor는 execCommand가 가장 안정적
    await page.evaluate((text) => {
      document.execCommand('insertText', false, text)
    }, caption)
    await page.waitForTimeout(1_000)
    // 입력이 안 됐으면 keyboard.type으로 재시도
    const inserted = await captionInput.textContent().catch(() => '')
    if (!inserted || inserted.trim().length < 5) {
      await captionInput.click({ force: true })
      await page.waitForTimeout(300)
      await page.keyboard.type(caption, { delay: 20 })
      await page.waitForTimeout(1_000)
    }
    console.log('[TikTok] 캡션 입력 완료')

    // 자동 콘텐츠 검사 팝업
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
    await page.waitForTimeout(4_000)

    // "Continue to post?" (저작권 검사 진행 중 팝업) → Post now 클릭
    const continueModal = page.locator('[class*="modal"], [class*="Modal"], [role="dialog"]')
      .filter({ hasText: /continue to post|계속 게시/i }).first()
    if (await continueModal.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const postNowBtn = continueModal.getByRole('button', { name: /post now|지금 게시/i }).first()
        .or(continueModal.locator('button').last())
      await postNowBtn.click()
      await page.waitForTimeout(3_000)
      console.log('[TikTok] "Continue to post?" 팝업 → Post now 클릭 ✓')
    }

    await page.waitForTimeout(6_000)
    await page.screenshot({ path: 'tiktok-result.png', timeout: 10_000 }).catch(() => {})

    // Creator Studio 콘텐츠 목록에서 최신 영상 URL 캡처
    const username = process.env.TIKTOK_USERNAME ?? ''
    const profileUrl = username ? `https://www.tiktok.com/@${username}` : 'https://www.tiktok.com/foryou'
    await page.goto('https://www.tiktok.com/creator-center/content', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(5_000)
    const firstHref = await page.locator('a[href*="/video/"]').first()
      .getAttribute('href').catch(() => null)
    const tiktokUrl = firstHref
      ? (firstHref.startsWith('http') ? firstHref : `https://www.tiktok.com${firstHref}`)
      : profileUrl

    console.log('[TikTok] 업로드 완료 ✓')
    return tiktokUrl
  } catch (err) {
    console.error('[TikTok] 발행 실패:', err)
    await page.screenshot({ path: 'tiktok-error.png', timeout: 10_000 }).catch(() => {})
    throw err
  } finally {
    await page.close()
    await stopAdsPower(PROFILE_ID)
  }
}
