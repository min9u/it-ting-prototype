/**
 * 로그아웃 · 탈퇴 뒤 이 브라우저 정리 (10 로그아웃 확인 · 탈퇴 확인).
 * lib/authFlow.ts 와 나눈 까닭: 이쪽은 실시간 연결 · 채팅 · API 를 불러와서, authFlow 에 두면 불러오는 고리가 생김
 *
 * 순서: logout() → 화면 이동(랜딩) → afterSignOut().
 * 캐시를 먼저 비우면 아직 떠 있는 설정 화면이 다시 불러오다 401 을 받아 로그인 화면으로 튈 수 있어서, 이동한 뒤에 비운다
 */
import { newSession, queryClient } from '../api/queryClient'
import { isUnauthorized } from '../api/client'
import { authApi } from '../api/auth'
import { stopEventStream } from '../realtime/events'
import { outbox } from '../api/chat/outbox'
import { disablePush, forgetPush } from './browserPush'

/** 세션이 끝난 뒤: 실시간 연결을 끊고, 받아 둔 서버 데이터를 모두 버림 (다음 사람에게 보이지 않게) */
export function afterSignOut() {
  stopEventStream()
  newSession() // 그 전에 시작한 쓰기가 늦게 끝나도 다음 사람의 캐시를 안 바꾸게 (api/sessionMutation)
  queryClient.clear()
  outbox.clear() // 보내지 못한 채팅 메시지 (서버 캐시 밖, 탭 메모리)
}

/**
 * 로그아웃 (10 로그아웃 확인 2): 이 브라우저의 푸시 등록을 먼저 지우고 → DELETE /sessions/current.
 * 이미 로그인이 풀려 있으면(401) 성공으로 본다. 그 밖의 실패는 던짐 (화면이 토스트). 끝나면 화면이 이동한 뒤 afterSignOut()
 */
export async function logout() {
  try { await disablePush() } catch { await forgetPush() }
  try { await authApi.logout() } catch (e) { if (!isUnauthorized(e)) throw e }
}

/** 탈퇴가 성공하고 랜딩으로 이동한 뒤 (서버가 세션 · 푸시 등록을 모두 지움) */
export async function afterWithdraw() {
  await forgetPush()
  afterSignOut()
}
