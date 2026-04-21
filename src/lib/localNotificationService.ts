import { LocalNotifications } from '@capacitor/local-notifications'
import type { Pill } from '@/store/usePillStore'

// Notification IDs: BASE + pillIndex*10 + dayIndex
const BASE_ID = 1000

/** Android 알림 채널 생성 (Android에서만 필요, iOS는 무시됨) */
async function ensureChannel() {
  await LocalNotifications.createChannel({
    id: 'holsi_pills',
    name: '영양제 알림',
    description: '영양제 복용 시간 알림',
    importance: 4, // HIGH
    visibility: 1, // PUBLIC
    vibration: true,
    sound: 'default',
  })
}

/** 알림 권한 요청 — 이미 허용이면 바로 true 반환 */
export async function requestLocalNotificationPermission(): Promise<boolean> {
  try {
    await ensureChannel()
    const result = await LocalNotifications.requestPermissions()
    return result.display === 'granted'
  } catch {
    return false
  }
}

/**
 * 영양제 목록을 기반으로 로컬 알림 스케줄 등록
 * 기존 영양제 알림을 전부 취소하고 새로 등록
 */
export async function scheduleLocalNotifications(pills: Pill[]): Promise<boolean> {
  try {
    await ensureChannel()

    // 기존 예약 알림 전부 취소
    const pending = await LocalNotifications.getPending()
    const pillNotifs = pending.notifications.filter(n => n.id >= BASE_ID)
    if (pillNotifs.length > 0) {
      await LocalNotifications.cancel({ notifications: pillNotifs })
    }

    const activePills = pills.filter(p => p.isActive !== false)
    if (activePills.length === 0) return true

    const notifications: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = []

    activePills.forEach((pill, pillIndex) => {
      const [hour, minute] = pill.time.split(':').map(Number)
      const days = pill.days ?? [0, 1, 2, 3, 4, 5, 6]

      days.forEach((dayOfWeek, dayIndex) => {
        const notifId = BASE_ID + pillIndex * 10 + dayIndex
        // Capacitor weekday: 1=일요일, 2=월요일 ... 7=토요일
        // Pill store days: 0=일요일, 1=월요일 ... 6=토요일
        const capacitorWeekday = dayOfWeek + 1

        notifications.push({
          id: notifId,
          title: '영양제 시간이에요!',
          body: `${pill.name} 복용할 시간이에요.`,
          schedule: {
            on: { weekday: capacitorWeekday, hour, minute },
            repeats: true,
          },
          channelId: 'holsi_pills',
          smallIcon: 'ic_stat_icon_config_sample',
          actionTypeId: '',
          extra: { pillId: pill.id },
        })
      })
    })

    if (notifications.length === 0) return true
    await LocalNotifications.schedule({ notifications })
    return true
  } catch (err) {
    console.error('localNotification schedule error:', err)
    return false
  }
}

/** 영양제 알림 전부 취소 */
export async function cancelLocalNotifications(): Promise<void> {
  try {
    const pending = await LocalNotifications.getPending()
    const pillNotifs = pending.notifications.filter(n => n.id >= BASE_ID)
    if (pillNotifs.length > 0) {
      await LocalNotifications.cancel({ notifications: pillNotifs })
    }
  } catch (err) {
    console.error('cancelLocalNotifications error:', err)
  }
}
