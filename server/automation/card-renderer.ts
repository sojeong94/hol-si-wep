import { chromium } from 'playwright'

// 카드에서 URL·해시태그 제거하고 본문만 추출
function extractBodyText(content: string): string {
  return content
    .split('\n')
    .filter(line => !line.trim().startsWith('#'))   // 해시태그 줄 제거
    .join('\n')
    .replace(/https?:\/\/\S+/g, '')                 // URL 제거
    .replace(/👉/g, '')                              // 화살표 제거
    .trim()
}

function buildHtml(bodyText: string, width: number, height: number): string {
  const fontSize = bodyText.length > 200 ? 28 : bodyText.length > 100 ? 34 : 40
  const paddingV = height > 1080 ? 160 : 90

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${width}px;
      height: ${height}px;
      background: #0a0a0a;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      font-family: 'Noto Sans KR', -apple-system, sans-serif;
      color: #fff;
      padding: ${paddingV}px 80px;
    }
    .top {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      width: 100%;
    }
    .logo {
      font-size: 26px;
      font-weight: 900;
      color: #ff2a7a;
      letter-spacing: 8px;
      text-transform: uppercase;
    }
    .divider {
      width: 48px;
      height: 3px;
      background: linear-gradient(90deg, #ff2a7a, #ff6fa8);
      border-radius: 2px;
    }
    .content {
      font-size: ${fontSize}px;
      line-height: 1.75;
      text-align: center;
      white-space: pre-wrap;
      word-break: keep-all;
      color: #f0f0f0;
      flex: 1;
      display: flex;
      align-items: center;
      padding: 40px 0;
    }
    .bottom {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .url {
      font-size: 22px;
      font-weight: 700;
      color: #ff2a7a;
      letter-spacing: 2px;
    }
    .tagline {
      font-size: 16px;
      color: #555;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="top">
    <div class="logo">HOLSI</div>
    <div class="divider"></div>
  </div>
  <div class="content">${bodyText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  <div class="bottom">
    <div class="divider"></div>
    <div class="url">hol-si.com</div>
    <div class="tagline">나를 돌보는 가장 다정한 선택</div>
  </div>
</body>
</html>`
}

export async function renderCard(
  content: string,
  outputPath: string,
  mode: 'square' | 'portrait' = 'square'  // square: 1080×1080(인스타), portrait: 1080×1920(쇼츠/틱톡)
): Promise<void> {
  const width = 1080
  const height = mode === 'portrait' ? 1920 : 1080
  const bodyText = extractBodyText(content)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()

  await page.setContent(buildHtml(bodyText, width, height), { waitUntil: 'networkidle' })
  await page.waitForTimeout(500) // 폰트 렌더 대기

  await page.screenshot({ path: outputPath, type: 'png' })
  await browser.close()

  console.log(`[CardRenderer] 카드 이미지 생성 완료 → ${outputPath}`)
}
