import { google } from 'googleapis'
import { GoogleAuth } from 'google-auth-library'

const PROPERTY_ID     = process.env.GA4_PROPERTY_ID ?? '532511472'
const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_FILE ?? 'credentials.json'

function getAuth() {
  return new GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  })
}

export interface GA4Summary {
  activeUsers: number
  sessions: number
  pageViews: number
  bounceRate: string
  topSources: Array<{ source: string; sessions: number }>
  dateRange: string
}

export async function fetchGA4Data(daysAgo = 7): Promise<GA4Summary | null> {
  try {
    const auth = getAuth()
    const analyticsdata = google.analyticsdata({ version: 'v1beta', auth })

    // 총계 지표
    const summaryRes = await analyticsdata.properties.runReport({
      property: `properties/${PROPERTY_ID}`,
      requestBody: {
        dateRanges: [{ startDate: `${daysAgo}daysAgo`, endDate: 'today' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
        ],
      },
    })

    const vals = summaryRes.data.rows?.[0]?.metricValues ?? []
    const bounceRaw = parseFloat(vals[3]?.value ?? '0')

    // 트래픽 소스별 세션 수 (상위 8개)
    const sourceRes = await analyticsdata.properties.runReport({
      property: `properties/${PROPERTY_ID}`,
      requestBody: {
        dateRanges: [{ startDate: `${daysAgo}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'sessionSource' }],
        metrics:   [{ name: 'sessions' }],
        orderBys:  [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 8,
      },
    })

    const topSources = (sourceRes.data.rows ?? []).map(row => ({
      source:   row.dimensionValues?.[0]?.value ?? '(unknown)',
      sessions: parseInt(row.metricValues?.[0]?.value ?? '0'),
    }))

    const today = new Date().toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
    const start = new Date(Date.now() - daysAgo * 86400_000)
      .toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })

    return {
      activeUsers: parseInt(vals[0]?.value ?? '0'),
      sessions:    parseInt(vals[1]?.value ?? '0'),
      pageViews:   parseInt(vals[2]?.value ?? '0'),
      bounceRate:  (bounceRaw * 100).toFixed(1) + '%',
      topSources,
      dateRange: `${start} ~ ${today}`,
    }
  } catch (err) {
    console.error('[Analytics] GA4 조회 실패:', err)
    return null
  }
}
