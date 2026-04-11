import { google } from 'googleapis'
import { GoogleAuth } from 'google-auth-library'
import { fetchGA4Data } from './analytics.js'

const SPREADSHEET_ID   = '1vGfptNlBeYYUCd46oOUJpROyjMT1vY8PHO4ssbI2ODg'
const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_FILE ?? 'credentials.json'
const DASHBOARD_TITLE  = 'SNS 대시보드'

function getServiceAuth() {
  return new GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

// 대시보드 탭 ID 가져오기 (없으면 생성)
async function getOrCreateDashboardSheet(sheets: any): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const existing = meta.data.sheets?.find(
    (s: any) => s.properties?.title === DASHBOARD_TITLE
  )
  if (existing) return existing.properties.sheetId

  const res = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title: DASHBOARD_TITLE, index: 1 } } }],
    },
  })
  return res.data.replies[0].addSheet.properties.sheetId
}

// 메인 시트에서 발행 완료 데이터 수집
async function getPublishedData(sheets: any) {
  // 첫 번째 시트 이름 동적으로 가져오기
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const firstSheet = meta.data.sheets?.[0]?.properties?.title ?? 'Sheet1'
  console.log(`[Dashboard] 메인 시트 이름: "${firstSheet}"`)

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${firstSheet}!A2:X500`,
  })
  const rows: any[][] = res.data.values ?? []
  return rows.filter(row => row[17] === '완료').map(row => ({
    date:      row[23] ?? '',
    keyword:   row[1]  ?? '',
    title:     row[2]  ?? '',
    naver:     row[14] ?? '',   // O열: 네이버 포스팅 URL
    twitter:   row[18] ?? '',
    threads:   row[19] ?? '',
    instagram: row[20] ?? '',
    youtube:   row[21] ?? '',
    tiktok:    row[22] ?? '',
  }))
}

export async function updateDashboard(): Promise<void> {
  try {
    const auth   = getServiceAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    const sheetId = await getOrCreateDashboardSheet(sheets)
    const data    = await getPublishedData(sheets)

    // GA4 데이터 (최근 7일)
    const ga4 = await fetchGA4Data(7)

    const today   = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    const total   = data.length

    // ── 플랫폼별 발행 수 ─────────────────────────────────────────────────────
    const counts = {
      naver:     data.filter(d => d.naver).length,
      twitter:   data.filter(d => d.twitter).length,
      threads:   data.filter(d => d.threads).length,
      instagram: data.filter(d => d.instagram).length,
      youtube:   data.filter(d => d.youtube).length,
      tiktok:    data.filter(d => d.tiktok).length,
    }

    // ── GA4 트래픽 소스 행 ───────────────────────────────────────────────────
    const ga4SourceRows = ga4
      ? ga4.topSources.map(s => ['', s.source, s.sessions, '', '', '', '', '', '', ''])
      : [['', '데이터 없음', '', '', '', '', '', '', '', '']]

    // ── 시트 내용 구성 ───────────────────────────────────────────────────────
    const headerValues = [
      // 타이틀
      ['홀시 SNS 대시보드', '', '', '', '', '', '', '', '', ''],
      [`마지막 업데이트: ${today}`, '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', ''],
      // SNS 발행 요약
      ['[SNS 발행 현황]', '', '', '', '총 발행 완료', total, '', '', '', ''],
      ['플랫폼', '발행 수', '', '', '', '', '', '', '', ''],
      ['네이버 블로그',  counts.naver,     '', '', '', '', '', '', '', ''],
      ['Twitter',        counts.twitter,   '', '', '', '', '', '', '', ''],
      ['Threads',        counts.threads,   '', '', '', '', '', '', '', ''],
      ['Instagram',      counts.instagram, '', '', '', '', '', '', '', ''],
      ['YouTube Shorts', counts.youtube,   '', '', '', '', '', '', '', ''],
      ['TikTok',         counts.tiktok,    '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', ''],
      // GA4 웹 애널리틱스
      ['[웹 애널리틱스 - 최근 7일]', '', '', '', '', '', '', '', '', ''],
      ['기간', ga4?.dateRange ?? '-', '', '', '', '', '', '', '', ''],
      ['활성 사용자', ga4?.activeUsers ?? '-', '', '세션', ga4?.sessions ?? '-', '', '', '', '', ''],
      ['페이지뷰', ga4?.pageViews ?? '-', '', '이탈률', ga4?.bounceRate ?? '-', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', ''],
      ['[트래픽 소스]', '세션 수', '', '', '', '', '', '', '', ''],
      ...ga4SourceRows,
      ['', '', '', '', '', '', '', '', '', ''],
      // 발행 이력 헤더
      ['발행일', '키워드', '네이버', 'Twitter', 'Threads', 'Instagram', 'YouTube', 'TikTok', '', ''],
    ]

    // 최근 50개 발행 이력 (최신순)
    const historyRows = [...data].reverse().slice(0, 50).map(d => [
      d.date,
      d.keyword,
      d.naver     ? '✓' : '',
      d.twitter   ? '✓' : '',
      d.threads   ? '✓' : '',
      d.instagram ? '✓' : '',
      d.youtube   ? '✓' : '',
      d.tiktok    ? '✓' : '',
    ])

    const allValues = [...headerValues, ...historyRows]

    // ── 시트 초기화 후 데이터 기입 ──────────────────────────────────────────
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${DASHBOARD_TITLE}!A1:Z200`,
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${DASHBOARD_TITLE}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: allValues },
    })

    // 동적 행 인덱스 계산
    const SNS_HEADER_ROW   = 3   // [SNS 발행 현황]
    const PLATFORM_ROW     = 4   // 플랫폼/발행 수 헤더
    const ANALYTICS_ROW    = 12  // [웹 애널리틱스]
    const SOURCE_HDR_ROW   = 17  // [트래픽 소스]
    const SOURCE_DATA_START = 18
    const SOURCE_DATA_END  = SOURCE_DATA_START + ga4SourceRows.length
    const HISTORY_HDR_ROW  = SOURCE_DATA_END + 2  // 빈 행 + 발행이력 헤더

    // ── 서식 적용 ────────────────────────────────────────────────────────────
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          // 타이틀 (A1): 핑크
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 10 },
              cell: { userEnteredFormat: {
                textFormat: { bold: true, fontSize: 16 },
                backgroundColor: { red: 0.95, green: 0.76, blue: 0.8 },
              }},
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          },
          // SNS 발행 현황 헤더: 파란색
          {
            repeatCell: {
              range: { sheetId, startRowIndex: SNS_HEADER_ROW, endRowIndex: SNS_HEADER_ROW + 1, startColumnIndex: 0, endColumnIndex: 10 },
              cell: { userEnteredFormat: {
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
              }},
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          },
          // 플랫폼 헤더행: 연파란색
          {
            repeatCell: {
              range: { sheetId, startRowIndex: PLATFORM_ROW, endRowIndex: PLATFORM_ROW + 1, startColumnIndex: 0, endColumnIndex: 2 },
              cell: { userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.78, green: 0.87, blue: 0.97 },
              }},
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          },
          // 웹 애널리틱스 헤더: 보라색
          {
            repeatCell: {
              range: { sheetId, startRowIndex: ANALYTICS_ROW, endRowIndex: ANALYTICS_ROW + 1, startColumnIndex: 0, endColumnIndex: 10 },
              cell: { userEnteredFormat: {
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                backgroundColor: { red: 0.4, green: 0.2, blue: 0.7 },
              }},
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          },
          // 트래픽 소스 헤더: 주황색
          {
            repeatCell: {
              range: { sheetId, startRowIndex: SOURCE_HDR_ROW, endRowIndex: SOURCE_HDR_ROW + 1, startColumnIndex: 0, endColumnIndex: 3 },
              cell: { userEnteredFormat: {
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                backgroundColor: { red: 0.9, green: 0.5, blue: 0.1 },
              }},
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          },
          // 발행 이력 헤더: 초록색
          {
            repeatCell: {
              range: { sheetId, startRowIndex: HISTORY_HDR_ROW, endRowIndex: HISTORY_HDR_ROW + 1, startColumnIndex: 0, endColumnIndex: 8 },
              cell: { userEnteredFormat: {
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                backgroundColor: { red: 0.2, green: 0.6, blue: 0.3 },
              }},
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          },
          // 열 너비 자동 조정
          { autoResizeDimensions: { dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 10 } } },
        ],
      },
    })

    // ── 차트 2개 (SNS 발행 수 + 트래픽 소스) ─────────────────────────────────
    const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
    const dashSheet = sheetMeta.data.sheets?.find((s: any) => s.properties?.sheetId === sheetId)
    const existingCharts = dashSheet?.charts ?? []
    const deleteRequests = existingCharts.map((c: any) => ({
      deleteEmbeddedObject: { objectId: c.chartId },
    }))

    const chartRequests: any[] = [
      ...deleteRequests,
      // 차트1: SNS 플랫폼별 발행 수
      {
        addChart: {
          chart: {
            spec: {
              title: '플랫폼별 발행 수',
              basicChart: {
                chartType: 'BAR',
                legendPosition: 'NO_LEGEND',
                axis: [
                  { position: 'BOTTOM_AXIS', title: '발행 수' },
                  { position: 'LEFT_AXIS',   title: '플랫폼' },
                ],
                domains: [{
                  domain: { sourceRange: { sources: [{ sheetId, startRowIndex: PLATFORM_ROW + 1, endRowIndex: PLATFORM_ROW + 7, startColumnIndex: 0, endColumnIndex: 1 }] } },
                }],
                series: [{
                  series: { sourceRange: { sources: [{ sheetId, startRowIndex: PLATFORM_ROW + 1, endRowIndex: PLATFORM_ROW + 7, startColumnIndex: 1, endColumnIndex: 2 }] } },
                  targetAxis: 'BOTTOM_AXIS',
                  color: { red: 0.97, green: 0.46, blue: 0.62 },
                }],
              },
            },
            position: {
              overlayPosition: {
                anchorCell: { sheetId, rowIndex: SNS_HEADER_ROW, columnIndex: 3 },
                widthPixels: 380, heightPixels: 230,
              },
            },
          },
        },
      },
    ]

    // 차트2: 트래픽 소스 (GA4 데이터 있을 때만)
    if (ga4 && ga4SourceRows.length > 0) {
      chartRequests.push({
        addChart: {
          chart: {
            spec: {
              title: '트래픽 소스별 세션 수',
              basicChart: {
                chartType: 'BAR',
                legendPosition: 'NO_LEGEND',
                axis: [
                  { position: 'BOTTOM_AXIS', title: '세션 수' },
                  { position: 'LEFT_AXIS',   title: '소스' },
                ],
                domains: [{
                  domain: { sourceRange: { sources: [{ sheetId, startRowIndex: SOURCE_DATA_START, endRowIndex: SOURCE_DATA_END, startColumnIndex: 1, endColumnIndex: 2 }] } },
                }],
                series: [{
                  series: { sourceRange: { sources: [{ sheetId, startRowIndex: SOURCE_DATA_START, endRowIndex: SOURCE_DATA_END, startColumnIndex: 2, endColumnIndex: 3 }] } },
                  targetAxis: 'BOTTOM_AXIS',
                  color: { red: 0.4, green: 0.6, blue: 0.97 },
                }],
              },
            },
            position: {
              overlayPosition: {
                anchorCell: { sheetId, rowIndex: ANALYTICS_ROW, columnIndex: 3 },
                widthPixels: 380, heightPixels: 230,
              },
            },
          },
        },
      })
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: chartRequests },
    })

    console.log(`[Dashboard] 대시보드 업데이트 완료 ✓ (총 ${total}건 발행)`)
  } catch (err) {
    console.error('[Dashboard] 업데이트 실패:', err)
  }
}
