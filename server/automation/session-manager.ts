import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { BrowserContext } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SESSIONS_DIR = path.join(__dirname, 'sessions')

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
}

function sessionPath(platform: string): string {
  return path.join(SESSIONS_DIR, `${platform}.json`)
}

export function hasSession(platform: string): boolean {
  return fs.existsSync(sessionPath(platform))
}

export function getStorageState(platform: string): object | undefined {
  if (!hasSession(platform)) return undefined
  return JSON.parse(fs.readFileSync(sessionPath(platform), 'utf8'))
}

export async function saveSession(context: BrowserContext, platform: string): Promise<void> {
  const state = await context.storageState()
  fs.writeFileSync(sessionPath(platform), JSON.stringify(state), 'utf8')
  console.log(`[${platform}] 세션 저장 완료`)
}

export function clearSession(platform: string): void {
  const p = sessionPath(platform)
  if (fs.existsSync(p)) {
    fs.unlinkSync(p)
    console.log(`[${platform}] 세션 삭제 완료`)
  }
}

// Cookie-Editor 확장 프로그램 JSON → Playwright storageState 변환
export function importFromCookieEditor(platform: string, cookieFilePath: string): void {
  const raw = fs.readFileSync(cookieFilePath, 'utf8')
  const cookies: any[] = JSON.parse(raw)

  const sameSiteMap: Record<string, 'Strict' | 'Lax' | 'None'> = {
    strict: 'Strict',
    lax: 'Lax',
    no_restriction: 'None',
    unspecified: 'None',
  }

  const converted = cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path ?? '/',
    expires: c.expirationDate ?? -1,
    httpOnly: c.httpOnly ?? false,
    secure: c.secure ?? false,
    sameSite: sameSiteMap[c.sameSite?.toLowerCase?.()] ?? 'None',
  }))

  const storageState = { cookies: converted, origins: [] }
  fs.writeFileSync(sessionPath(platform), JSON.stringify(storageState, null, 2), 'utf8')
  console.log(`[${platform}] 쿠키 ${converted.length}개 가져오기 완료 → sessions/${platform}.json`)
}
