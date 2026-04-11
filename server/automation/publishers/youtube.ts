import { chromium } from 'playwright'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateContent, ContentOptions } from '../content-generator.js'
import { generateVideo } from '../video-generator.js'
import { startAdsPower, stopAdsPower } from '../adspower-client.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VIDEO_PATH = path.join(__dirname, '..', 'youtube-output.mp4')

const PROFILE_ID = process.env.ADSPOWER_SNS_PROFILE_ID ?? 'k1bchih2'

export async function loginYoutube(): Promise<void> {
  console.log('[YouTube] AdsPower 프로필 방식으로 세션을 관리합니다.')
  console.log(`[YouTube] AdsPower에서 프로필 "${PROFILE_ID}"을 열고 YouTube에 직접 로그인 후`)
  console.log('[YouTube] AdsPower에서 브라우저를 닫으면 세션이 프로필에 자동 저장됩니다.')
}

// sharedVideoPath: post-all.ts에서 Instagram 카드 슬라이드쇼 영상 전달 시 재생성 생략
export async function postYoutube(
  options?: ContentOptions,
  sharedVideoPath?: string
): Promise<string> {
  const content = await generateContent('youtube', options)
  console.log('[YouTube] 생성된 콘텐츠:\n', content)

  const videoFile = sharedVideoPath ?? VIDEO_PATH
  if (sharedVideoPath) {
    console.log('[YouTube] 공유 슬라이드쇼 영상 사용 ✓', sharedVideoPath)
  } else {
    await generateVideo(content, VIDEO_PATH)
  }

  // 제목: 첫 줄, 특수문자 제거, 100자 이내
  const lines = content.split('\n').filter(l => l.trim())
  const title = lines[0].replace(/[*#>]/g, '').trim().slice(0, 100)
  const body  = lines.slice(1).join('\n').trim()
  const description = `${body}\n\n홀시 앱 → https://hol-si.com\n\n#홀시 #여성건강 #생리주기 #생리통 #PMS #호르몬 #Shorts`

  const wsUrl  = await startAdsPower(PROFILE_ID)
  const browser = await chromium.connectOverCDP(wsUrl)
  const context = browser.contexts()[0]
  const page    = await context.newPage()

  try {
    // ── 1. YouTube Studio 접속 ─────────────────────────────────────────────
    await page.goto('https://studio.youtube.com', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForTimeout(4_000)

    // ── 2. 만들기 버튼 ────────────────────────────────────────────────────
    const createBtn = page.locator('#create-icon, [aria-label="만들기"], [aria-label="Create"]').first()
    await createBtn.waitFor({ timeout: 15_000 })
    await createBtn.click()
    await page.waitForTimeout(1_500)

    // ── 3. 동영상 업로드 메뉴 ─────────────────────────────────────────────
    const uploadMenu = page.locator('tp-yt-paper-item').filter({ hasText: /동영상 업로드|Upload video/i }).first()
    await uploadMenu.waitFor({ timeout: 10_000 })
    await uploadMenu.click()
    await page.waitForTimeout(2_000)

    // ── 4. 파일 선택 ──────────────────────────────────────────────────────
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.waitFor({ state: 'attached', timeout: 15_000 })
    await fileInput.setInputFiles(videoFile)
    console.log('[YouTube] 파일 업로드 중...')

    // 업로드 처리 대기 (진행바 사라질 때까지)
    await page.waitForTimeout(8_000)

    // ── 5. 제목 입력 ──────────────────────────────────────────────────────
    const titleBox = page.locator('#title-textarea [contenteditable="true"], #textbox').first()
    await titleBox.waitFor({ timeout: 30_000 })
    await titleBox.click({ clickCount: 3 })
    await titleBox.fill(title)
    console.log('[YouTube] 제목 입력:', title)
    await page.waitForTimeout(800)

    // ── 6. 설명 입력 ──────────────────────────────────────────────────────
    const descBox = page.locator('#description-textarea [contenteditable="true"]').first()
    if (await descBox.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await descBox.click()
      await descBox.fill(description)
      console.log('[YouTube] 설명 입력 완료')
      await page.waitForTimeout(800)
    }

    // ── 7. 아동용 아님 선택 ───────────────────────────────────────────────
    const notForKids = page.locator('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]')
      .or(page.locator('ytcp-radio-group').getByText(/아니요|No, it/i).first())
    if (await notForKids.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await notForKids.click()
      await page.waitForTimeout(500)
    }

    // ── 8. 다음 버튼 3회 (세부정보 → 동영상 요소 → 검사 → 공개 설정) ──────
    for (let i = 0; i < 3; i++) {
      const nextBtn = page.locator('ytcp-button#next-button').first()
      await nextBtn.waitFor({ timeout: 20_000 })
      await nextBtn.click()
      console.log(`[YouTube] 다음 ${i + 1}/3`)
      await page.waitForTimeout(3_000)
    }

    // ── 9. 공개 선택 ──────────────────────────────────────────────────────
    const publicRadio = page.locator('tp-yt-paper-radio-button[name="PUBLIC"]')
      .or(page.locator('ytcp-radio-group').getByText(/^공개$|^Public$/i).first())
    await publicRadio.waitFor({ timeout: 15_000 })
    await publicRadio.click()
    await page.waitForTimeout(1_000)

    // ── 10. 게시 버튼 ─────────────────────────────────────────────────────
    const publishBtn = page.locator('ytcp-button#done-button').first()
    await publishBtn.waitFor({ timeout: 15_000 })
    await publishBtn.click()
    await page.waitForTimeout(6_000)
    console.log('[YouTube] Shorts 업로드 완료 ✓')

    // ── 11. 업로드된 영상 URL 캡처 ────────────────────────────────────────
    await page.goto('https://studio.youtube.com/videos/upload', { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.goto('https://studio.youtube.com', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(4_000)
    const videoHref = await page.locator('a[href*="youtu.be"], a[href*="youtube.com/shorts"]').first()
      .getAttribute('href').catch(() => null)
    const channelHandle = process.env.YOUTUBE_HANDLE ?? '@Hormone_sister'
    const videoUrl = videoHref
      ? (videoHref.startsWith('http') ? videoHref : `https://www.youtube.com${videoHref}`)
      : `https://www.youtube.com/${channelHandle}`

    return videoUrl
  } catch (err) {
    console.error('[YouTube] 업로드 실패:', err)
    throw err
  } finally {
    await page.close()
    await stopAdsPower(PROFILE_ID)
  }
}
