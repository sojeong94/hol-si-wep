import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs'

const BASE_URL = 'https://hol-si.com'
const OUT_DIR = path.join(process.cwd(), 'appstore-screenshots', process.env.DEVICE || 'iphone')

// iPad Pro 13" — CSS픽셀 1032×1376, deviceScaleFactor 2 → 실제 2064×2752px
const VIEWPORT = { width: 1032, height: 1376 }
const DEVICE_SCALE = 2

const SHOTS = [
  {
    name: '01_home',
    url: `${BASE_URL}/`,
    desc: '홈 — 오늘의 조언 & D-day',
  },
  {
    name: '02_calendar',
    url: `${BASE_URL}/calendar`,
    desc: '캘린더 — 생리 주기 기록',
  },
  {
    name: '03_pills',
    url: `${BASE_URL}/pills`,
    desc: '알람 — 영양제·약 복용 알림',
  },
  {
    name: '04_mypage',
    url: `${BASE_URL}/mypage`,
    desc: '마이페이지 — 주기 설정 & 백업',
  },
  {
    name: '05_home_bottom',
    url: `${BASE_URL}/`,
    desc: '홈 — 비밀 박스 & 상담',
    scrollY: 700,
  },
]

async function run() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
    colorScheme: 'dark',
    locale: 'ko-KR',
  })

  // 닉네임 세팅 + 온보딩 팝업 우회
  await context.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'ko')
    // zustand persist — userName 설정해서 웰컴 모달 방지
    localStorage.setItem('holsi-settings-storage', JSON.stringify({
      state: {
        userName: '소정',
        defaultCycle: 28,
        defaultPeriod: 5,
        isManualCycle: false,
        manualCycleDays: 28,
        manualPeriodDays: 5,
      },
      version: 0
    }))
    localStorage.setItem('holsi-pwa-dismissed-v4', 'true')
    // 알람 샘플 데이터
    localStorage.setItem('holsi-pills-storage', JSON.stringify({
      state: {
        pills: [
          { id: '1', name: '종합 비타민', time: '08:00', days: [0,1,2,3,4,5,6], isActive: true },
          { id: '2', name: '오메가3', time: '08:00', days: [0,1,2,3,4,5,6], isActive: true },
          { id: '3', name: '유산균', time: '21:00', days: [0,1,2,3,4,5,6], isActive: true },
          { id: '4', name: '마그네슘', time: '21:00', days: [0,1,2,3,4,5,6], isActive: false },
          { id: '5', name: '피임약', time: '22:00', days: [0,1,2,3,4,5,6], isActive: true },
        ],
        triggerAlarm: null,
        intakeLogs: [],
      },
      version: 0
    }))
  })

  for (const shot of SHOTS) {
    console.log(`📸 ${shot.desc} ...`)
    const page = await context.newPage()

    await page.goto(shot.url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)

    if (shot.scrollY) {
      await page.evaluate((y) => window.scrollTo(0, y), shot.scrollY)
      await page.waitForTimeout(800)
    }

    const filePath = path.join(OUT_DIR, `${shot.name}.png`)
    await page.screenshot({
      path: filePath,
      type: 'png',
      scale: 'device',   // deviceScaleFactor 적용 → 1242×2688
    })

    // 사이즈 확인
    const stat = fs.statSync(filePath)
    console.log(`   저장: ${filePath} (${(stat.size / 1024).toFixed(0)}KB)`)
    await page.close()
  }

  await browser.close()
  console.log(`\n✅ 완료! appstore-screenshots/ 폴더에 5장 저장됨`)
  console.log(`   실제 사이즈: ${VIEWPORT.width * DEVICE_SCALE}×${VIEWPORT.height * DEVICE_SCALE}px`)
}

run().catch(console.error)
