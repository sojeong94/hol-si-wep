import { google } from 'googleapis'
import { GoogleAuth } from 'google-auth-library'
import { fetchGA4Data } from './analytics.js'

const SPREADSHEET_ID   = '1vGfptNlBeYYUCd46oOUJpROyjMT1vY8PHO4ssbI2ODg'
const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_FILE ?? 'credentials.json'

function getServiceAuth() {
  return new GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

// 가장 최근 발행 완료된 행 읽기
async function getLastPublishedRow(): Promise<{
  keyword: string
  title: string
  twitter: string
  threads: string
  instagram: string
  youtube: string
  tiktok: string
  date: string
} | null> {
  try {
    const auth   = getServiceAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
    const firstSheet = meta.data.sheets?.[0]?.properties?.title ?? 'Sheet1'
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${firstSheet}!A2:X500`,
    })

    const rows = res.data.values ?? []
    // 마지막 SNS 발행 완료 행 찾기 (R열=완료)
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i]
      if (row[17] === '완료') {
        return {
          keyword:   row[1]  ?? '',
          title:     row[2]  ?? '',
          twitter:   row[18] ?? '',
          threads:   row[19] ?? '',
          instagram: row[20] ?? '',
          youtube:   row[21] ?? '',
          tiktok:    row[22] ?? '',
          date:      row[23] ?? '',
        }
      }
    }
    return null
  } catch {
    return null
  }
}

function checkmark(url: string): string {
  return url ? `✓ ${url.slice(0, 50)}${url.length > 50 ? '…' : ''}` : '✗ 발행 실패'
}

export async function printDailyReport(): Promise<void> {
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })

  console.log('\n' + '='.repeat(60))
  console.log(`[Daily Hol-si Silo Report] ${today}`)
  console.log('='.repeat(60))

  const [last, ga4] = await Promise.all([
    getLastPublishedRow(),
    fetchGA4Data(7),
  ])

  if (!last) {
    console.log('\n📊 SNS 발행 현황')
    console.log('  → 아직 발행된 콘텐츠가 없습니다.')
  } else {
    console.log('\n📊 SNS 발행 현황 (최근 발행)')
    console.log(`  키워드: "${last.keyword}"`)
    console.log(`  제목:   "${last.title}"`)
    console.log(`  발행일: ${last.date || '미기록'}`)
    console.log(`  Twitter:   ${checkmark(last.twitter)}`)
    console.log(`  Threads:   ${checkmark(last.threads)}`)
    console.log(`  Instagram: ${checkmark(last.instagram)}`)
    console.log(`  YouTube:   ${checkmark(last.youtube)}`)
    console.log(`  TikTok:    ${checkmark(last.tiktok)}`)
  }

  // GA4 웹 애널리틱스
  console.log('\n📈 웹 애널리틱스 (최근 7일)')
  if (!ga4) {
    console.log('  → GA4 데이터 조회 실패 (권한 또는 연동 확인 필요)')
  } else {
    console.log(`  기간:         ${ga4.dateRange}`)
    console.log(`  활성 사용자:  ${ga4.activeUsers.toLocaleString()}명`)
    console.log(`  세션:         ${ga4.sessions.toLocaleString()}`)
    console.log(`  페이지뷰:     ${ga4.pageViews.toLocaleString()}`)
    console.log(`  이탈률:       ${ga4.bounceRate}`)
    console.log('  --- 트래픽 소스 ---')
    ga4.topSources.forEach(s => {
      console.log(`  ${s.source.padEnd(20)} ${s.sessions}세션`)
    })
  }

  console.log('\n💰 Monetization')
  console.log('  쿠팡 파트너스: Naver 포스트 + YouTube/TikTok description 삽입')
  console.log('  AdSense 고단가 키워드: 생리주기·여성건강·영양제')

  console.log('='.repeat(60) + '\n')
}
