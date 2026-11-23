/**
 * "브라우저 알림 받기" (10 알림 설정 2 · 00 공통 2, API 10 "브라우저 푸시")
 * 스위치는 브라우저마다 따로라 서버가 상태를 주지 않는다: 이 브라우저의 알림 권한이 허용이고 등록 id 를 갖고 있으면 켜짐.
 *
 * 켜기: 알림 권한 요청 → 허용이면 pushPublicKey 로 구독 만들기 → POST /me/push-subscriptions → 받은 id 를 이 브라우저(localStorage)에
 * 끄기: DELETE /me/push-subscriptions/{id} → 브라우저 구독 해지 → id 지우기. 로그아웃 직전에도 끈다
 *
 * 실제 서버: 서비스 워커(public/push-sw.js)의 PushManager 구독. 목 서버: 구독 모양만 흉내 (서비스 워커 없음, 목 서버가 Notification 으로 띄움)
 * 불러올 때 window · storage 를 만지지 않는다 (함수 안에서만)
 */
import { settingsApi, SETTINGS_IS_MOCK, type PushSubscriptionRequest } from '../api/settings'
import { ENV } from './env'

const KEY = 'digul.push.v1'
const SW_PATH = 'push-sw.js'

interface Saved { id: number; endpoint: string }

export function savedPush(): Saved | null {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return v && typeof v.id === 'number' ? v : null } catch { return null }
}
function save(v: Saved | null) {
  try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY) } catch { /* 저장소가 막힌 곳 */ }
}

/** 이 브라우저가 알림을 띄울 수 있는지 (목은 Notification 만, 실제는 서비스 워커 + PushManager 도) */
export function pushSupported(): boolean {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return false
  return SETTINGS_IS_MOCK || ('serviceWorker' in navigator && 'PushManager' in window)
}
export const pushPermission = (): NotificationPermission | 'unsupported' => (pushSupported() ? Notification.permission : 'unsupported')
/** 스위치 상태: 권한 허용 + 등록 id 있음 */
export const pushIsOn = () => pushPermission() === 'granted' && !!savedPush()

/** VAPID 공개 키(base64url) → applicationServerKey */
export function base64UrlToBytes(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function swRegistration(): Promise<ServiceWorkerRegistration> {
  const base = ENV.base.endsWith('/') ? ENV.base : `${ENV.base}/`
  return navigator.serviceWorker.register(`${base}${SW_PATH}`)
}

/** 브라우저 구독 만들기 → 명세 요청 모양 */
async function subscribe(publicKey: string): Promise<PushSubscriptionRequest> {
  if (SETTINGS_IS_MOCK) {
    const endpoint = savedPush()?.endpoint ?? `https://push.mock.digul/${Math.random().toString(36).slice(2, 12)}`
    return { endpoint, keys: { p256dh: 'mock-p256dh', auth: 'mock-auth' } }
  }
  const reg = await swRegistration()
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) as BufferSource }))
  const j = sub.toJSON()
  return { endpoint: j.endpoint ?? sub.endpoint, keys: { p256dh: j.keys?.p256dh ?? '', auth: j.keys?.auth ?? '' } }
}

/** 켜기. 'on' | 'denied'(권한 거절 · 막힘) | 'unsupported'. 서버 실패는 ApiError 로 던짐 */
export async function enablePush(publicKey: string): Promise<'on' | 'denied' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported'
  let perm = Notification.permission
  if (perm === 'default') { try { perm = await Notification.requestPermission() } catch { perm = 'denied' } }
  if (perm !== 'granted') return 'denied'
  const req = await subscribe(publicKey)
  const { pushSubscriptionId } = await settingsApi.registerPush(req)
  save({ id: pushSubscriptionId, endpoint: req.endpoint })
  return 'on'
}

/** 끄기 (서버 등록 지우기 → 브라우저 구독 해지). 등록이 없으면 아무것도 안 함 */
export async function disablePush(): Promise<void> {
  const s = savedPush()
  if (s) await settingsApi.deletePush(s.id)
  save(null)
  if (!SETTINGS_IS_MOCK && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try { const reg = await navigator.serviceWorker.getRegistration(); await (await reg?.pushManager.getSubscription())?.unsubscribe() } catch { /* 이미 없음 */ }
  }
}

/** 로그아웃 · 탈퇴 뒤: 서버를 부르지 않고 이 브라우저의 id · 구독만 정리 (탈퇴는 서버가 모두 지움) */
export async function forgetPush(): Promise<void> {
  save(null)
  if (!SETTINGS_IS_MOCK && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try { const reg = await navigator.serviceWorker.getRegistration(); await (await reg?.pushManager.getSubscription())?.unsubscribe() } catch { /* 무시 */ }
  }
}
