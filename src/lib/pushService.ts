import type { Pill } from '@/store/usePillStore'

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length))
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/** 현재 SW 구독 객체 반환 (없으면 null) */
async function getSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/** 서버에 구독 + 영양제 목록 등록 */
export async function subscribePush(pills: Pill[]): Promise<boolean> {
  try {
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      alert('푸시 설정 오류: VAPID 키가 없어요.')
      return false
    }

    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('서비스워커 준비 시간 초과')), 8000)
      ),
    ])
    let sub = await reg.pushManager.getSubscription()

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
    }

    const key = sub.getKey('p256dh')
    const authKey = sub.getKey('auth')
    if (!key || !authKey) return false

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: btoa(String.fromCharCode(...new Uint8Array(key))),
        auth: btoa(String.fromCharCode(...new Uint8Array(authKey))),
        pills: pills.map(p => ({
          id: p.id, name: p.name, time: p.time,
          days: p.days ?? [0, 1, 2, 3, 4, 5, 6],
          isActive: p.isActive !== false,
        })),
      }),
    })
    return true
  } catch (err: any) {
    console.error('push subscribe error:', err)
    alert(`알림 등록 실패: ${err?.message ?? String(err)}`)
    return false
  }
}

/** 영양제 목록만 서버에 동기화 */
export async function syncPillsToServer(pills: Pill[]): Promise<void> {
  try {
    const sub = await getSubscription()
    if (!sub) return

    await fetch('/api/push/update-pills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        pills: pills.map(p => ({
          id: p.id, name: p.name, time: p.time,
          days: p.days ?? [0, 1, 2, 3, 4, 5, 6],
          isActive: p.isActive !== false,
        })),
      }),
    })
  } catch (err) {
    console.error('sync pills error:', err)
  }
}

/** 구독 해제 */
export async function unsubscribePush(): Promise<void> {
  try {
    const sub = await getSubscription()
    if (!sub) return
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    })
    await sub.unsubscribe()
  } catch (err) {
    console.error('push unsubscribe error:', err)
  }
}
