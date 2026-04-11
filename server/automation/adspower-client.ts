const ADSPOWER_API = 'http://127.0.0.1:50325'

interface AdsPowerResponse {
  code: number
  msg: string
  data: { ws: { puppeteer: string } }
}

export async function startAdsPower(profileId: string): Promise<string> {
  const res = await fetch(`${ADSPOWER_API}/api/v1/browser/start?user_id=${profileId}`)
  const data = (await res.json()) as AdsPowerResponse

  if (data.code !== 0) {
    throw new Error(`[AdsPower] 프로필 시작 실패 (${profileId}): ${data.msg}\n→ AdsPower 프로그램이 실행 중인지 확인하세요.`)
  }

  const wsUrl = data.data.ws.puppeteer
  console.log(`[AdsPower] 프로필 ${profileId} 시작 ✓  ws: ${wsUrl}`)
  return wsUrl
}

export async function stopAdsPower(profileId: string): Promise<void> {
  try {
    await fetch(`${ADSPOWER_API}/api/v1/browser/stop?user_id=${profileId}`)
    console.log(`[AdsPower] 프로필 ${profileId} 종료 ✓`)
  } catch {
    // 종료 실패는 무시 (AdsPower가 이미 닫혀있을 수 있음)
  }
}
