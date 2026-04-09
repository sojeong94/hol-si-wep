import { chromium } from 'playwright'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config()

function extractBodyText(content: string): string {
  return content
    .split('\n')
    .filter(line => !line.trim().startsWith('#'))
    .join('\n')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/👉/g, '')
    .trim()
}

// 콘텐츠 키워드 → Pexels 영문 검색어
function getPhotoKeywords(allContent: string): string {
  if (allContent.includes('생리통') || allContent.includes('통증') || allContent.includes('복부'))
    return 'woman health pain wellness'
  if (allContent.includes('수면') || allContent.includes('잠') || allContent.includes('피로'))
    return 'woman sleep rest morning'
  if (allContent.includes('PMS') || allContent.includes('황체') || allContent.includes('예민'))
    return 'woman emotional stress relax'
  if (allContent.includes('영양') || allContent.includes('마그네슘') || allContent.includes('철분') || allContent.includes('영양제'))
    return 'woman healthy nutrition food'
  if (allContent.includes('운동'))
    return 'woman yoga exercise stretch'
  if (allContent.includes('스트레스'))
    return 'woman mindful calm wellness'
  if (allContent.includes('호르몬'))
    return 'woman balance wellness lifestyle'
  if (allContent.includes('주기') || allContent.includes('예측'))
    return 'woman journal planning self care'
  return 'woman health wellness lifestyle'
}

// 카드 타입별 감정 보조 키워드 (woman 강조, 제품/광고 제외)
const CARD_EMOTION: Record<CardType, string> = {
  hook:  'asian woman thinking lifestyle',
  intro: 'asian woman relax home',
  core:  'asian woman reading journal self care',
  cta:   'asian woman smiling happy outdoor',
}

// Pexels API로 여성 사진 URL 가져오기
async function fetchPexelsPhoto(query: string): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=square`,
      { headers: { Authorization: apiKey } }
    )
    const data = await res.json() as any
    const photos: any[] = data.photos ?? []
    if (photos.length === 0) return null
    const photo = photos[Math.floor(Math.random() * photos.length)]
    return photo.src.large2x ?? photo.src.large ?? null
  } catch {
    return null
  }
}

// ── 영상용 세로 카드 (YouTube Shorts / TikTok) ──────────────────────────────
function buildVideoCardHtml(bodyText: string, width: number, height: number): string {
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
      width: ${width}px; height: ${height}px;
      background: #0a0a0a;
      display: flex; flex-direction: column; align-items: center; justify-content: space-between;
      font-family: 'Noto Sans KR', sans-serif; color: #fff;
      padding: ${paddingV}px 80px;
    }
    .top { display: flex; flex-direction: column; align-items: center; gap: 20px; width: 100%; }
    .logo { font-size: 26px; font-weight: 900; color: #ff2a7a; letter-spacing: 8px; text-transform: uppercase; }
    .divider { width: 48px; height: 3px; background: linear-gradient(90deg, #ff2a7a, #ff6fa8); border-radius: 2px; }
    .content {
      font-size: ${fontSize}px; line-height: 1.75; text-align: center;
      white-space: pre-wrap; word-break: keep-all; color: #f0f0f0;
      flex: 1; display: flex; align-items: center; padding: 40px 0;
    }
    .bottom { display: flex; flex-direction: column; align-items: center; gap: 16px; }
    .url { font-size: 22px; font-weight: 700; color: #ff2a7a; letter-spacing: 2px; }
    .tagline { font-size: 16px; color: #555; letter-spacing: 1px; }
  </style>
</head>
<body>
  <div class="top"><div class="logo">HOLSI</div><div class="divider"></div></div>
  <div class="content">${bodyText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  <div class="bottom">
    <div class="divider"></div>
    <div class="url">hol-si.com</div>
    <div class="tagline">나를 돌보는 가장 다정한 선택</div>
  </div>
</body>
</html>`
}

// ── Instagram 카드뉴스 4장 (웜톤 + 여성 사진 배경) ───────────────────────────
type CardType = 'hook' | 'intro' | 'core' | 'cta'

const CARD_STYLES: Record<CardType, { overlay: string; textColor: string; accentColor: string }> = {
  hook:  { overlay: 'rgba(245,237,224,0.62)', textColor: '#3D2B1F', accentColor: '#C17F50' },
  intro: { overlay: 'rgba(237,224,206,0.65)', textColor: '#3D2B1F', accentColor: '#9B6B3A' },
  core:  { overlay: 'rgba(249,243,235,0.68)', textColor: '#3D2B1F', accentColor: '#C17F50' },
  cta:   { overlay: 'rgba(45,28,18,0.72)',    textColor: '#F5EDE0', accentColor: '#E8A87C' },
}

function buildInstagramCardHtml(text: string, type: CardType, photoUrl: string): string {
  const s = CARD_STYLES[type]
  const lines = text.split('\n').filter(l => l.trim())

  const baseStyle = `
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      width:1080px; height:1080px;
      background-image: linear-gradient(${s.overlay}, ${s.overlay}), url('${photoUrl}');
      background-size: cover; background-position: center;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      font-family:'Noto Sans KR',sans-serif; position:relative; overflow:hidden;
    }
    .logo { position:absolute; top:60px; left:70px; font-size:22px; font-weight:900; color:${s.accentColor}; letter-spacing:6px; }
    .bottom { position:absolute; bottom:60px; left:70px; right:70px; display:flex; justify-content:space-between; }
    .bottom-url { font-size:16px; color:${s.accentColor}; letter-spacing:1px; opacity:0.9; font-weight:700; }
    .bottom-num { font-size:16px; color:${s.textColor}; opacity:0.5; }
  `

  if (type === 'hook') {
    return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;700;900&display=swap" rel="stylesheet">
  <style>
    ${baseStyle}
    .tag { position:absolute; top:60px; right:70px; font-size:15px; color:${s.accentColor}; letter-spacing:2px; opacity:0.8; }
    .main {
      font-size:62px; font-weight:900; color:${s.textColor};
      text-align:center; line-height:1.4; word-break:keep-all;
      padding:0 80px; position:relative; z-index:1;
      text-shadow: 0 2px 12px rgba(255,255,255,0.3);
    }
    .accent-line { width:60px; height:4px; background:${s.accentColor}; border-radius:2px; margin-top:36px; }
  </style></head>
  <body>
    <div class="logo">HOLSI</div>
    <div class="tag">여성 건강</div>
    <div class="main">${lines.join('<br>')}</div>
    <div class="accent-line"></div>
    <div class="bottom">
      <div class="bottom-url">hol-si.com</div>
      <div class="bottom-num">01 / 04</div>
    </div>
  </body></html>`
  }

  if (type === 'intro') {
    return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;700;900&display=swap" rel="stylesheet">
  <style>
    ${baseStyle}
    .content-wrap { display:flex; flex-direction:column; align-items:flex-start; padding:0 100px; gap:28px; width:100%; }
    .label { font-size:14px; font-weight:700; color:${s.accentColor}; letter-spacing:4px; text-transform:uppercase; }
    .main {
      font-size:clamp(32px,4.5vw,52px); font-weight:700; color:${s.textColor};
      line-height:1.55; word-break:keep-all;
      text-shadow: 0 2px 8px rgba(255,255,255,0.25);
    }
    .side-line { position:absolute; left:60px; top:0; bottom:0; width:3px; background:${s.accentColor}; opacity:0.2; }
  </style></head>
  <body>
    <div class="side-line"></div>
    <div class="logo">HOLSI</div>
    <div class="content-wrap">
      <div class="label">여성 건강 이야기</div>
      <div class="main">${lines.join('<br>')}</div>
    </div>
    <div class="bottom">
      <div class="bottom-url">hol-si.com</div>
      <div class="bottom-num">02 / 04</div>
    </div>
  </body></html>`
  }

  if (type === 'core') {
    const itemsHtml = lines.map(l =>
      `<div class="item"><span class="dot"></span><span>${l.replace(/^[-•]\s*/, '')}</span></div>`
    ).join('')
    return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;700;900&display=swap" rel="stylesheet">
  <style>
    ${baseStyle}
    .content-wrap { display:flex; flex-direction:column; align-items:flex-start; padding:0 100px; gap:32px; width:100%; }
    .label { font-size:14px; font-weight:700; color:${s.accentColor}; letter-spacing:4px; }
    .items { display:flex; flex-direction:column; gap:24px; }
    .item { display:flex; align-items:center; gap:22px; }
    .dot { width:10px; height:10px; border-radius:50%; background:${s.accentColor}; flex-shrink:0; }
    .item span:last-child {
      font-size:38px; font-weight:700; color:${s.textColor}; line-height:1.3;
      text-shadow: 0 1px 6px rgba(255,255,255,0.2);
    }
    .deco-rect { position:absolute; bottom:0; right:0; width:360px; height:360px; background:${s.accentColor}; opacity:0.06; border-radius:80px 0 0 0; }
  </style></head>
  <body>
    <div class="deco-rect"></div>
    <div class="logo">HOLSI</div>
    <div class="content-wrap">
      <div class="label">핵심 정보</div>
      <div class="items">${itemsHtml}</div>
    </div>
    <div class="bottom">
      <div class="bottom-url">hol-si.com</div>
      <div class="bottom-num">03 / 04</div>
    </div>
  </body></html>`
  }

  // CTA
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;700;900&display=swap" rel="stylesheet">
  <style>
    ${baseStyle}
    .content-wrap { display:flex; flex-direction:column; align-items:center; gap:36px; padding:0 80px; text-align:center; }
    .main {
      font-size:clamp(36px,5vw,52px); font-weight:900; color:${s.textColor};
      line-height:1.5; word-break:keep-all;
      text-shadow: 0 2px 16px rgba(0,0,0,0.3);
    }
    .url-box {
      background:${s.accentColor}; color:#3D2B1F;
      padding:18px 56px; border-radius:60px;
      font-size:26px; font-weight:700; letter-spacing:2px;
    }
    .tagline { font-size:18px; color:${s.textColor}; opacity:0.6; letter-spacing:1px; }
    .bottom-num { font-size:16px; color:${s.textColor}; opacity:0.4; }
  </style></head>
  <body>
    <div class="logo">HOLSI</div>
    <div class="content-wrap">
      <div class="main">${lines.join('<br>')}</div>
      <div class="url-box">hol-si.com</div>
      <div class="tagline">나를 돌보는 가장 다정한 선택</div>
    </div>
    <div class="bottom">
      <div></div>
      <div class="bottom-num">04 / 04</div>
    </div>
  </body></html>`
}

async function renderHtml(html: string, outputPath: string): Promise<void> {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1080, height: 1080 } })
  const page = await context.newPage()
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.screenshot({ path: outputPath, type: 'png' })
  await browser.close()
  console.log(`[CardRenderer] 카드 생성 완료 → ${outputPath}`)
}

// ── 영상용 단일 카드 ────────────────────────────────────────────────────────
export async function renderCard(
  content: string,
  outputPath: string,
  mode: 'square' | 'portrait' = 'square'
): Promise<void> {
  const width = 1080
  const height = mode === 'portrait' ? 1920 : 1080
  const bodyText = extractBodyText(content)
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width, height } })
  const page = await ctx.newPage()
  await page.setContent(buildVideoCardHtml(bodyText, width, height), { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: outputPath, type: 'png' })
  await browser.close()
  console.log(`[CardRenderer] 카드 이미지 생성 완료 → ${outputPath}`)
}

// ── Instagram 4장 카드뉴스 ──────────────────────────────────────────────────
function cleanCardText(text: string): string {
  return text
    .split('\n')
    .filter(line => !line.trim().startsWith('#'))          // 해시태그 제거
    .filter(line => !/^\d+장$/.test(line.trim()))          // "1장", "2장" 레이블 제거
    .filter(line => !/^\[.*\]$/.test(line.trim()))         // "[HOOK]" 레이블 제거
    .join('\n')
    .trim()
}

export async function renderInstagramCards(
  content: string,
  outputDir: string
): Promise<string[]> {
  const parts = content.split('---').map(p => cleanCardText(p)).filter(Boolean)
  const types: CardType[] = ['hook', 'intro', 'core', 'cta']
  const paths: string[] = []

  const topicKw = getPhotoKeywords(content)

  for (let i = 0; i < 4; i++) {
    const text = parts[i] ?? ''
    // 여성 인물 사진만 나오도록 감정 키워드 우선, 주제 보조
    const query = CARD_EMOTION[types[i]]
    const photoUrl = await fetchPexelsPhoto(query) ?? ''
    const outputPath = path.join(outputDir, `instagram-card-${i + 1}.png`)
    await renderHtml(buildInstagramCardHtml(text, types[i], photoUrl), outputPath)
    paths.push(outputPath)
  }

  return paths
}
