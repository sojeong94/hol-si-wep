import path from 'path'
import { fileURLToPath } from 'url'
import { postTweet }     from './publishers/twitter.js'
import { postThread }    from './publishers/threads.js'
import { postInstagram } from './publishers/instagram.js'
import { postYoutube }   from './publishers/youtube.js'
import { postTiktok }    from './publishers/tiktok.js'
import { getNextKeyword, updateSNSLinks } from './sheets-manager.js'
import { generateContent } from './content-generator.js'
import { renderInstagramCards } from './card-renderer.js'
import { generateVideoFromCards } from './video-generator.js'
import type { ContentOptions } from './content-generator.js'

// ※ 네이버 블로그는 Python naver_bot이 별도 독립 실행으로 처리합니다.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CARDS_DIR       = __dirname
const SHARED_VIDEO    = path.join(__dirname, 'shared-slideshow.mp4')

async function safePost(name: string, fn: () => Promise<string>): Promise<string> {
  try {
    return await fn()
  } catch (err) {
    console.error(`[${name}] 발행 실패:`, err)
    return ''
  }
}

/**
 * 발행 파이프라인
 *
 * Step 1 : Instagram 4장 카드 생성  ──┐
 * Step 2 : 카드 4장 → 슬라이드쇼 MP4 ┘ (TikTok + YouTube 공용)
 * Step 3 : Twitter / Threads          병렬 발행 (독립 콘텐츠)
 * Step 4 : YouTube                    API 업로드 (공유 영상)
 * Step 5 : Instagram → TikTok         순차 발행 (AdsPower k1bchih2 공유)
 */
export async function postAllFromSheets(): Promise<void> {
  const row = await getNextKeyword()
  if (!row) {
    console.log('[PostAll] 발행할 키워드가 없습니다. 시트를 확인해주세요.')
    return
  }

  const options: ContentOptions = { keyword: row.keyword, title: row.title }
  console.log(`\n[PostAll] ▶ 키워드: "${row.keyword}" / 제목: "${row.title}"`)

  // ── Step 1+2: Instagram 카드 4장 생성 → 슬라이드쇼 영상 ─────────────────────
  console.log('[PostAll] Step 1/5 — Instagram 카드 4장 생성 중...')
  const igContent  = await generateContent('instagram', options)
  const cardPaths  = await renderInstagramCards(igContent, CARDS_DIR)

  console.log('[PostAll] Step 2/5 — 카드 → 슬라이드쇼 영상 생성 중... (TikTok·YouTube 공용)')
  await generateVideoFromCards(cardPaths, igContent, SHARED_VIDEO)
  console.log('[PostAll] 공유 영상 준비 완료 ✓', SHARED_VIDEO)

  // ── Step 3: Twitter + Threads 병렬 (독립 콘텐츠) ────────────────────────────
  console.log('[PostAll] Step 3/5 — Twitter / Threads 병렬 발행...')
  const [twitter, threads] = await Promise.allSettled([
    safePost('Twitter', () => postTweet(options)),
    safePost('Threads', () => postThread(options)),
  ])

  // ── Step 4+5: YouTube → Instagram → TikTok (AdsPower k1bchih2 공유, 순차) ────
  console.log('[PostAll] Step 4/5 — YouTube Shorts 업로드 (AdsPower)...')
  const youtube = await safePost('YouTube', () => postYoutube(options, SHARED_VIDEO))

  console.log('[PostAll] Step 5/5 — Instagram → TikTok (AdsPower 순차)...')
  const instagram = await safePost('Instagram', () => postInstagram(undefined, { cardPaths, content: igContent }))
  const tiktok    = await safePost('TikTok',    () => postTiktok(options, SHARED_VIDEO))

  // ── 시트 결과 기록 ───────────────────────────────────────────────────────────
  const links = {
    twitter:   twitter.status   === 'fulfilled' ? twitter.value   : '',
    threads:   threads.status   === 'fulfilled' ? threads.value   : '',
    instagram,
    youtube,
    tiktok,
  }

  await updateSNSLinks(row.row, links)

  console.log('\n[PostAll] ✓ 전체 발행 완료')
  console.log('  Twitter:  ', links.twitter   || '(실패)')
  console.log('  Threads:  ', links.threads   || '(실패)')
  console.log('  YouTube:  ', links.youtube   || '(실패)')
  console.log('  Instagram:', links.instagram || '(실패)')
  console.log('  TikTok:   ', links.tiktok    || '(실패)')
  console.log('  Naver:     Python naver_bot 독립 실행')
}
