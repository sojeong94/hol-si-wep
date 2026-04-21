import { chromium } from 'playwright'
import { hasSession, getStorageState, saveSession } from '../session-manager.js'
import { generateContent, ContentOptions } from '../content-generator.js'
import { naverMonetizationBlock } from '../monetization.js'

const NAVER_ID  = process.env.NAVER_ID  ?? ''
const NAVER_PW  = process.env.NAVER_PW  ?? ''
const BLOG_ID   = process.env.NAVER_BLOG_ID ?? NAVER_ID

const STEALTH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
]
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export async function loginNaver(): Promise<void> {
  if (!NAVER_ID || !NAVER_PW) {
    console.log('[Naver] .env에 NAVER_ID / NAVER_PW 값을 설정해주세요.')
    return
  }

  const browser = await chromium.launch({ headless: false, args: STEALTH_ARGS })
  const context = await browser.newContext({ userAgent: USER_AGENT, viewport: { width: 1280, height: 800 } })
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  const page = await context.newPage()
  await page.goto('https://nid.naver.com/nidlogin.login', { waitUntil: 'domcontentloaded' })

  // 자동 로그인 (captcha가 없으면 성공)
  await page.fill('#id', NAVER_ID)
  await page.fill('#pw', NAVER_PW)
  await page.click('.btn_login')
  await page.waitForTimeout(3_000)

  const url = page.url()
  if (url.includes('nid.naver.com/login/ext')) {
    console.log('[Naver] 추가 인증 필요 — 브라우저에서 직접 완료 후 Enter를 눌러주세요...')
    await new Promise<void>(resolve => process.stdin.once('data', () => resolve()))
  } else {
    console.log('[Naver] 로그인 완료 ✓')
  }

  await saveSession(context, 'naver')
  await browser.close()
  console.log('[Naver] 세션 저장 완료 ✓')
}

export async function postNaver(options?: ContentOptions): Promise<string> {
  if (!hasSession('naver')) {
    throw new Error('[Naver] 세션이 없습니다. 먼저 "npm run automate login naver"을 실행하세요.')
  }

  const rawContent = await generateContent('naver', options)
  const lines = rawContent.split('\n')
  const title = lines[0].replace(/^#+\s*/, '').trim()
  const keyword = options?.keyword ?? title

  // 수익화 블록(쿠팡 + 구글폼 CTA) 삽입
  const body = lines.slice(1).join('\n').trim() + naverMonetizationBlock(keyword)

  console.log('[Naver] 생성된 제목:', title)

  const browser = await chromium.launch({ headless: true, args: STEALTH_ARGS })
  const context = await browser.newContext({
    storageState: getStorageState('naver') as any,
    userAgent: USER_AGENT,
    viewport: { width: 1440, height: 900 },
  })
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  const page = await context.newPage()

  try {
    const writeUrl = `https://blog.naver.com/${BLOG_ID}/postwrite`
    await page.goto(writeUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForTimeout(5_000)

    // ── 세션 만료 감지 ──────────────────────────────────────────────────────
    if (page.url().includes('nid.naver.com')) {
      throw new Error('[Naver] 세션 만료 — "npm run automate login naver" 재실행 필요')
    }

    // ── Smart Editor 3.0: 제목 입력 ──────────────────────────────────────────
    const titleInput = page.locator('.se-title-input, #SE-title-input, [placeholder*="제목"]').first()
    await titleInput.waitFor({ timeout: 20_000 })
    await titleInput.click()
    await page.keyboard.type(title, { delay: 20 })
    await page.waitForTimeout(500)
    console.log('[Naver] 제목 입력 완료')

    // ── 본문 입력 (Smart Editor contenteditable) ──────────────────────────────
    const bodyArea = page.locator('.se-main-container [contenteditable="true"], .se-component-content [contenteditable="true"]').first()
    await bodyArea.waitFor({ timeout: 15_000 })
    await bodyArea.click()
    await page.waitForTimeout(500)

    // 본문은 줄별로 타이핑 (Enter 키로 줄바꿈)
    for (const line of body.split('\n')) {
      if (line.trim()) {
        await page.keyboard.type(line, { delay: 15 })
      }
      await page.keyboard.press('Enter')
    }
    await page.waitForTimeout(1_000)
    console.log('[Naver] 본문 입력 완료')

    // ── 발행 버튼 클릭 ──────────────────────────────────────────────────────
    const publishBtn = page.locator('.publish_btn, button:has-text("발행"), [class*="btn_publish"]').first()
    await publishBtn.waitFor({ timeout: 15_000 })
    await publishBtn.click()
    await page.waitForTimeout(3_000)

    // 발행 확인 팝업이 뜨면 확인 클릭
    const confirmBtn = page.locator('[class*="layer"] button:has-text("확인"), button:has-text("발행하기")').first()
    if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmBtn.click()
      await page.waitForTimeout(3_000)
    }

    // ── 발행된 포스트 URL 추출 ────────────────────────────────────────────────
    await page.waitForTimeout(3_000)
    const postUrl = page.url().includes('blog.naver.com')
      ? page.url()
      : `https://blog.naver.com/${BLOG_ID}`

    console.log('[Naver] 발행 완료 ✓', postUrl)
    await saveSession(context, 'naver')
    return postUrl
  } catch (err) {
    console.error('[Naver] 발행 실패:', err)
    await page.screenshot({ path: 'naver-error.png' })
    throw err
  } finally {
    await browser.close()
  }
}
