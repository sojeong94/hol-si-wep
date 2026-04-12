/**
 * 구글 시트에 새 키워드 일괄 추가
 * 실행: npx tsx server/automation/populate-keywords.ts
 */
import { google } from 'googleapis'
import { GoogleAuth } from 'google-auth-library'
import dotenv from 'dotenv'

dotenv.config()

const SPREADSHEET_ID   = '1vGfptNlBeYYUCd46oOUJpROyjMT1vY8PHO4ssbI2ODg'
const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_FILE ?? 'credentials.json'

const NEW_KEYWORDS: { keyword: string; title: string }[] = [
  // ── 영양제 조합/복용법 ────────────────────────────────────────
  { keyword: '칼슘 마그네슘 같이 먹으면 안되는 이유',   title: '칼슘과 마그네슘 같이 먹으면 안 되는 이유' },
  { keyword: '철분 비타민C 같이 먹기',                  title: '철분 흡수율을 높이는 비타민C 조합법' },
  { keyword: '오메가3 먹는 시간',                       title: '오메가3 언제 먹어야 가장 효과적인지' },
  { keyword: '유산균 공복 식후',                        title: '유산균 공복 vs 식후 언제 먹어야 할까' },
  { keyword: '비타민D K2 같이 먹기',                    title: '비타민D와 K2를 함께 먹어야 하는 이유' },
  { keyword: '영양제 먹는 순서',                        title: '영양제 먹는 순서가 효과를 바꾼다' },
  { keyword: '아연 구리 영양제 조합',                   title: '아연과 구리 함께 먹으면 독이 되는 조합' },
  { keyword: '콜라겐 흡수율 높이기',                    title: '콜라겐 흡수율 높이는 복용 타이밍' },
  { keyword: '여성 필수 영양제',                        title: '여성이 꼭 챙겨야 할 영양제 TOP 5' },
  { keyword: '공복에 먹으면 안되는 영양제',              title: '공복에 먹으면 안 되는 영양제 종류' },

  // ── 다이어트/체형관리 ─────────────────────────────────────────
  { keyword: '여성 다이어트 영양제',                    title: '여성 다이어트에 효과적인 영양제 조합' },
  { keyword: '생리 주기 다이어트',                      title: '생리 주기별 다이어트 전략 언제 빠지는지' },
  { keyword: '황체기 식욕 폭발 다이어트',               title: '식욕 폭발하는 황체기 다이어트 꿀팁' },
  { keyword: '카르니틴 체지방 감소',                    title: '카르니틴이 체지방 감소에 효과적인 이유' },
  { keyword: '다이어트 근손실 단백질',                  title: '다이어트 중 근손실 막는 단백질 섭취법' },
  { keyword: '호르몬 불균형 체중 증가',                 title: '체중 감량을 방해하는 호르몬 불균형' },
  { keyword: 'CLA 여성 다이어트',                       title: 'CLA 공액리놀레산 여성 다이어트 효과' },
  { keyword: '부종 빠지는 영양소',                      title: '부종 빠지는 영양소 칼륨과 마그네슘' },

  // ── 임신/임산부 ───────────────────────────────────────────────
  { keyword: '임산부 엽산 복용법',                      title: '임산부가 반드시 챙겨야 할 엽산 복용법' },
  { keyword: '임신 중 철분제',                          title: '임신 중 철분제 언제부터 얼마나 먹어야 할까' },
  { keyword: '임산부 오메가3 DHA',                      title: '임산부 오메가3 DHA 태아 뇌 발달과의 관계' },
  { keyword: '임신 중 먹으면 안되는 영양제',            title: '임신 중 먹으면 안 되는 영양제와 허브' },
  { keyword: '임산부 변비 영양소',                      title: '임산부 변비에 좋은 영양소와 식이섬유' },
  { keyword: '입덧 비타민B6',                           title: '입덧 심할 때 비타민B6가 도움이 되는 이유' },
  { keyword: '임신 중 칼슘 부족',                       title: '임신 중 칼슘 부족이 산모에게 미치는 영향' },
  { keyword: '출산 후 회복 영양제',                     title: '출산 후 빠른 회복을 위한 영양제 루틴' },

  // ── 육아/수유 ─────────────────────────────────────────────────
  { keyword: '모유 수유 영양소',                        title: '모유 수유 중 챙겨야 할 영양소 총정리' },
  { keyword: '수유 중 영양제',                          title: '수유 중 먹어도 안전한 영양제 vs 주의해야 할 것' },
  { keyword: '산후 탈모 영양제',                        title: '산후 탈모 막는 영양제 철분과 비오틴' },
  { keyword: '육아 피로 마그네슘',                      title: '육아 피로를 줄여주는 마그네슘과 코엔자임Q10' },
  { keyword: '아이 면역력 엄마 유산균',                 title: '아이 면역력 높이는 엄마의 유산균 섭취법' },
  { keyword: '산후우울증 오메가3',                      title: '산후우울증과 오메가3의 연관성' },

  // ── 폐경/갱년기 ───────────────────────────────────────────────
  { keyword: '갱년기 이소플라본',                       title: '갱년기 증상을 완화하는 이소플라본 효과' },
  { keyword: '폐경 후 골다공증 칼슘',                   title: '폐경 후 골다공증 예방하는 칼슘과 비타민D' },
  { keyword: '갱년기 열감 홍조 영양소',                 title: '갱년기 열감 홍조에 효과적인 영양소' },
  { keyword: '폐경 전후 호르몬 영양',                   title: '폐경 전후 호르몬 변화와 영양 전략' },
  { keyword: '갱년기 수면 장애 마그네슘',               title: '갱년기 수면 장애 마그네슘과 멜라토닌' },
  { keyword: '갱년기 체중 증가',                        title: '갱년기 체중 증가 막는 영양제와 생활습관' },
  { keyword: '폐경 후 피부 콜라겐',                     title: '폐경 후 피부 탄력 유지하는 콜라겐 섭취법' },

  // ── 피부/미용 ─────────────────────────────────────────────────
  { keyword: '생리 전 피부 트러블 영양소',              title: '생리 전 피부 트러블 줄이는 영양소' },
  { keyword: '히알루론산 피부 보습',                    title: '피부 속 보습을 채우는 히알루론산 효과' },
  { keyword: '비타민C 피부 미백',                       title: '비타민C 고용량 피부 미백 효과와 복용법' },
  { keyword: '탈모 비오틴',                             title: '탈모 막는 비오틴 얼마나 먹어야 할까' },
  { keyword: '여드름 아연',                             title: '여드름성 피부에 좋은 아연 복용법' },

  // ── 피로/스트레스 ─────────────────────────────────────────────
  { keyword: '만성 피로 코엔자임Q10',                   title: '만성 피로에 효과적인 코엔자임Q10' },
  { keyword: '직장인 번아웃 영양 전략',                 title: '직장인 여성의 번아웃과 부신 피로 영양 전략' },
  { keyword: '스트레스 마그네슘 비타민C',               title: '스트레스로 소모되는 영양소 마그네슘과 비타민C' },
  { keyword: '수면의 질 마그네슘',                      title: '수면의 질을 높이는 마그네슘 글리시네이트' },
  { keyword: '집중력 오메가3 DHA',                      title: '집중력과 기억력을 높이는 오메가3 DHA' },
]

async function populateKeywords() {
  const auth = new GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  const sheets = google.sheets({ version: 'v4', auth })

  // 현재 시트 이름 가져오기
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const sheetName = meta.data.sheets?.[0]?.properties?.title ?? '시트1'
  console.log(`[Sheets] 시트 이름: ${sheetName}`)

  // 기존 데이터 마지막 행 확인
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!B:B`,
  })
  const existingKeywords = new Set(
    (existing.data.values ?? []).flat().map(v => v?.trim()).filter(Boolean)
  )
  console.log(`[Sheets] 기존 키워드 ${existingKeywords.size}개 확인`)

  // 중복 제외
  const toAdd = NEW_KEYWORDS.filter(k => !existingKeywords.has(k.keyword))
  if (toAdd.length === 0) {
    console.log('[Sheets] 추가할 새 키워드가 없습니다 (모두 이미 존재)')
    return
  }

  // 마지막 행 다음에 추가
  const lastRow = (existing.data.values ?? []).length + 1
  const rows = toAdd.map(k => ['', k.keyword, k.title])

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${lastRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  })

  console.log(`[Sheets] ✓ ${toAdd.length}개 키워드 추가 완료 (행 ${lastRow}~${lastRow + toAdd.length - 1})`)
  toAdd.forEach((k, i) => console.log(`  ${lastRow + i}행: ${k.keyword}`))
}

populateKeywords().catch(console.error)
