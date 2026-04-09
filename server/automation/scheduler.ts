import cron from 'node-cron'
import { postTweet } from './publishers/twitter.js'
import { postThread } from './publishers/threads.js'
import { postInstagram } from './publishers/instagram.js'
import { postYoutube } from './publishers/youtube.js'
import { postTiktok } from './publishers/tiktok.js'

async function safeRun(name: string, fn: () => Promise<void>) {
  try {
    await fn()
  } catch (err) {
    console.error(`[Automation] ${name} 오류:`, err)
  }
}

export function startAutomationScheduler() {
  // ── X (Twitter) ────────────────────────────────────
  // 매일 오전 9시
  cron.schedule('0 9 * * *', () => safeRun('Twitter 오전', postTweet), {
    timezone: 'Asia/Seoul',
  })
  // 매일 오후 7시
  cron.schedule('0 19 * * *', () => safeRun('Twitter 오후', postTweet), {
    timezone: 'Asia/Seoul',
  })

  // ── Threads ─────────────────────────────────────────
  // 매일 오전 10시
  cron.schedule('0 10 * * *', () => safeRun('Threads 오전', postThread), {
    timezone: 'Asia/Seoul',
  })
  // 매일 오후 8시
  cron.schedule('0 20 * * *', () => safeRun('Threads 오후', postThread), {
    timezone: 'Asia/Seoul',
  })

  // ── Instagram ────────────────────────────────────────
  // 매일 오전 11시
  cron.schedule('0 11 * * *', () => safeRun('Instagram 오전', postInstagram), {
    timezone: 'Asia/Seoul',
  })
  // 매일 오후 6시
  cron.schedule('0 18 * * *', () => safeRun('Instagram 오후', postInstagram), {
    timezone: 'Asia/Seoul',
  })

  // ── YouTube Shorts ───────────────────────────────────
  // 매일 오후 2시
  cron.schedule('0 14 * * *', () => safeRun('YouTube', postYoutube), {
    timezone: 'Asia/Seoul',
  })

  // ── TikTok ───────────────────────────────────────────
  // 매일 오후 3시
  cron.schedule('0 15 * * *', () => safeRun('TikTok', postTiktok), {
    timezone: 'Asia/Seoul',
  })

  console.log('[Automation] 스케줄러 시작 — X(9·19시), Threads(10·20시), Instagram(11·18시), YouTube(14시), TikTok(15시)')
}
