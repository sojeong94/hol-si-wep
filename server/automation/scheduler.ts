import cron from 'node-cron'
import { postAllFromSheets } from './post-all.js'
import { postTweet }     from './publishers/twitter.js'
import { printDailyReport } from './reporter.js'
import { updateDashboard }  from './dashboard.js'

async function safeRun(name: string, fn: () => Promise<any>) {
  try {
    await fn()
  } catch (err) {
    console.error(`[Automation] ${name} 오류:`, err)
  }
}

export function startAutomationScheduler() {
  let isPosting = false

  // ── 24분마다 키워드 1개 발행 (하루 60개) ──────────────────────────────────
  cron.schedule('*/24 * * * *', async () => {
    if (isPosting) {
      console.log('[Automation] 이전 발행 진행 중 — 이번 회차 건너뜀')
      return
    }
    isPosting = true
    try {
      await safeRun('시트 기반 전체 발행', postAllFromSheets)
    } finally {
      isPosting = false
    }
  }, { timezone: 'Asia/Seoul' })

  // ── 오후 8시: 일일 리포트 + 대시보드 업데이트 ─────────────────────────────
  cron.schedule('0 20 * * *', async () => {
    await safeRun('Daily Report', printDailyReport)
    await safeRun('Dashboard 업데이트', updateDashboard)
  }, { timezone: 'Asia/Seoul' })

  console.log('[Automation] 스케줄러 시작')
  console.log('  매 24분 — 키워드 1개 발행 (하루 최대 60개)')
  console.log('  20:00  — 일일 리포트 + 구글시트 대시보드 업데이트')
}
