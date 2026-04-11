import { chromium } from 'playwright'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateContent, ContentOptions } from '../content-generator.js'
import { renderInstagramCards } from '../card-renderer.js'
import { startAdsPower, stopAdsPower } from '../adspower-client.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CARDS_DIR = path.join(__dirname, '..')

const PROFILE_ID = process.env.ADSPOWER_SNS_PROFILE_ID ?? 'k1bchih2'

// 4장 카드 내용으로 Instagram 캡션 생성
function buildCaption(content: string): string {
  const parts = content.split('---').map(p => p.trim()).filter(Boolean)
  const hook = parts[0] ?? ''
  const core = parts[2] ?? ''
  return `${hook}\n\n${core}\n\n👉 https://hol-si.com?utm_source=instagram&utm_medium=social&utm_campaign=silo\n\n#홀시 #여성건강 #생리주기 #생리통 #호르몬건강 #PMS #영양제 #자기관리 #건강정보 #웰니스`
}

export async function loginInstagram(): Promise<void> {
  console.log('[Instagram] AdsPower 프로필 방식으로 세션을 관리합니다.')
  console.log(`[Instagram] AdsPower에서 프로필 "${PROFILE_ID}"을 열고 Instagram에 직접 로그인 후`)
  console.log('[Instagram] AdsPower에서 브라우저를 닫으면 세션이 프로필에 자동 저장됩니다.')
}

// preGenerated: post-all.ts에서 사전 생성된 카드 전달 시 재생성 생략
export async function postInstagram(
  options?: ContentOptions,
  preGenerated?: { cardPaths: string[]; content: string }
): Promise<string> {
  // 1. 콘텐츠 + 카드 (사전 생성이 없을 때만 생성)
  const content   = preGenerated?.content   ?? await generateContent('instagram', options)
  const cardPaths = preGenerated?.cardPaths ?? await renderInstagramCards(content, CARDS_DIR)

  if (!preGenerated) {
    console.log('[Instagram] 생성된 콘텐츠:\n', content)
    console.log('[Instagram] 카드 이미지 생성 완료:', cardPaths)
  } else {
    console.log('[Instagram] 사전 생성 카드 사용 ✓')
  }

  const caption = buildCaption(content)

  // 3. AdsPower 프로필로 브라우저 연결 (이미 Instagram 로그인 상태)
  const wsUrl = await startAdsPower(PROFILE_ID)
  const browser = await chromium.connectOverCDP(wsUrl)
  const context = browser.contexts()[0]
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

    // 프로필에서 최신 게시물 URL 캡처
    const username = process.env.INSTAGRAM_USERNAME ?? ''
    const profileUrl = `https://www.instagram.com/${username}/`
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3_000)
    const firstHref = await page.locator('a[href*="/p/"], a[href*="/reel/"]').first()
      .getAttribute('href').catch(() => null)
    const postUrl = firstHref
      ? (firstHref.startsWith('http') ? firstHref : `https://www.instagram.com${firstHref}`)
      : profileUrl

    console.log('[Instagram] 게시 완료 ✓')
    return postUrl
  } catch (err) {
    console.error('[Instagram] 발행 실패:', err)
    await page.screenshot({ path: 'instagram-error.png' })
    throw err
  } finally {
    await page.close()
    await stopAdsPower(PROFILE_ID)
  }
}
