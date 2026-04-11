import { google } from 'googleapis'
import { GoogleAuth } from 'google-auth-library'

const SPREADSHEET_ID   = '1vGfptNlBeYYUCd46oOUJpROyjMT1vY8PHO4ssbI2ODg'
const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_FILE ?? 'credentials.json'

function getServiceAuth() {
  return new GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

// 컬럼 인덱스 (0-based)
const COL = {
  STATUS:    0,   // A: 작업 상태
  KEYWORD:   1,   // B: 메인키워드
  TITLE:     2,   // C: 제목
  SNS_STATUS: 17, // R: SNS 상태
  TWITTER:   18,  // S: Twitter
  THREADS:   19,  // T: Threads
  INSTAGRAM: 20,  // U: Instagram
  YOUTUBE:   21,  // V: YouTube
  TIKTOK:    22,  // W: TikTok
  SNS_DATE:  23,  // X: SNS 발행일
}

export interface SNSLinks {
  twitter?:   string
  threads?:   string
  instagram?: string
  youtube?:   string
  tiktok?:    string
}

export interface KeywordRow {
  row: number       // 1-based 행 번호
  keyword: string
  title: string
}

async function getSheetName(): Promise<string> {
  const auth   = getServiceAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const sheet = meta.data.sheets?.find(s => s.properties?.sheetId === 266017583)
  return sheet?.properties?.title ?? '시트1'
}

let _sheetName: string | null = null
async function sheetName(): Promise<string> {
  if (!_sheetName) _sheetName = await getSheetName()
  return _sheetName
}

// ── SNS 컬럼 초기 셋업 (헤더 + 서식) ──────────────────────────────────────
export async function setupSNSColumns(): Promise<void> {
  const auth = getServiceAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const name = await sheetName()

  // 헤더 텍스트 입력
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${name}!R1:X1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['SNS 상태', 'Twitter', 'Threads', 'Instagram', 'YouTube', 'TikTok', 'SNS 발행일']],
    },
  })

  // 헤더 서식: 파란 배경, 흰 텍스트, 굵게
  const sheetId = 266017583
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 17, endColumnIndex: 24 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
                textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
                horizontalAlignment: 'CENTER',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
          },
        },
        // SNS 상태 컬럼 너비
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: 17, endIndex: 24 },
            properties: { pixelSize: 160 },
            fields: 'pixelSize',
          },
        },
        // 행 고정 (헤더)
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
      ],
    },
  })

  console.log('[Sheets] SNS 컬럼 셋업 완료 ✓')
}

// ── 다음 발행할 키워드 가져오기 ────────────────────────────────────────────
export async function getNextKeyword(): Promise<KeywordRow | null> {
  const auth = getServiceAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const name = await sheetName()

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${name}!A2:X`,
  })

  const rows = res.data.values ?? []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const keyword = row[COL.KEYWORD]?.trim()
    const snsStatus = row[COL.SNS_STATUS]?.trim()
    if (keyword && !snsStatus) {
      return {
        row: i + 2,       // 1-based (헤더가 1행)
        keyword,
        title: row[COL.TITLE]?.trim() ?? keyword,
      }
    }
  }
  return null
}

// ── SNS 링크 기록 + 상태 완료 표시 ────────────────────────────────────────
export async function updateSNSLinks(rowNum: number, links: SNSLinks): Promise<void> {
  const auth = getServiceAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const name = await sheetName()
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${name}!R${rowNum}:X${rowNum}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        '완료',
        links.twitter   ?? '',
        links.threads   ?? '',
        links.instagram ?? '',
        links.youtube   ?? '',
        links.tiktok    ?? '',
        today,
      ]],
    },
  })

  console.log(`[Sheets] 행 ${rowNum} SNS 링크 기록 완료 ✓`)
}
