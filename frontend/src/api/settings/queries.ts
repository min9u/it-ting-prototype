/** 10 설정 · 계정 — TanStack Query 훅과 캐시 키 */
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionMutation } from '../sessionMutation'
import { useMockStoreSync } from '../storeSync'
import { notificationKeys } from '../notifications'
import { accountStore } from '../../data/account'
import { noticePrefs } from '../../data/notifications'
import { useServiceNotices } from '../../data/serviceNotices'
import { toDtoId } from '../common/ids'
import { settingsApi } from './api'
import { pickValues, toAccount, toNotice, toNoticePage, toWithdrawalCheck, type NotifSettingsVM } from './mappers'
import type { AccountDto, NotificationSettingValuesDto, PasswordChangeRequest, WithdrawRequest } from './types'

export const settingsKeys = {
  all: ['settings'] as const,
  account: ['settings', 'account'] as const,
  notificationSettings: ['settings', 'notification-settings'] as const,
  notices: ['settings', 'notices'] as const,
  noticePage: (page: number) => ['settings', 'notices', 'page', page] as const,
  notice: (id: string) => ['settings', 'notices', 'detail', id] as const,
  withdrawalCheck: ['settings', 'withdrawal-check'] as const,
}

/** 공지 한 페이지 10개 (명세 10 공지사항 2) */
export const NOTICE_PAGE_SIZE = 10

/* ===== 계정 ===== */
/** GET /me/account — 설정의 모든 화면이 열 때 (메뉴 · 첫 화면 · Google 연동 상태) */
export function useAccount() {
  return useQuery({ queryKey: settingsKeys.account, queryFn: ({ signal }) => settingsApi.account(signal), select: toAccount })
}
/** PATCH /me/password. 실패는 화면이 code 로 칸을 고른다 (CURRENT_PASSWORD_MISMATCH · PASSWORD_UNCHANGED) */
export function useChangePassword() {
  return useSessionMutation({ mutationFn: (req: PasswordChangeRequest) => settingsApi.changePassword(req) })
}
/** PUT /me/google-link (Google 에서 verified=true 로 돌아왔을 때) · DELETE /me/google-link → 계정 캐시를 응답으로 */
export function useGoogleLink() {
  const qc = useQueryClient()
  const onSuccess = (d: AccountDto) => qc.setQueryData(settingsKeys.account, d)
  return {
    link: useSessionMutation({ mutationFn: () => settingsApi.linkGoogle(), onSuccess }),
    unlink: useSessionMutation({ mutationFn: () => settingsApi.unlinkGoogle(), onSuccess }),
  }
}

/* ===== 알림 설정 ===== */
export function useNotificationSettings() {
  return useQuery({
    queryKey: settingsKeys.notificationSettings,
    queryFn: ({ signal }) => settingsApi.notificationSettings(signal),
    select: (d): NotifSettingsVM => ({ values: pickValues(d), pushPublicKey: d.pushPublicKey }),
  })
}
/**
 * PATCH /me/notification-settings — 스위치를 누르면 바로 (낙관적으로 바꾸고, 실패하면 되돌림).
 * 끈 갈래는 빨간 점 · 알림 목록에서 빠지므로 알림 캐시도 새로 받는다
 */
export function useUpdateNotificationSettings() {
  const qc = useQueryClient()
  const key = settingsKeys.notificationSettings
  return useSessionMutation({
    mutationFn: (values: NotificationSettingValuesDto) => settingsApi.updateNotificationSettings(values),
    onMutate: async (values) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      qc.setQueryData(key, (old: object | undefined) => (old ? { ...old, ...values } : old))
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev) },
    onSuccess: (d) => { qc.setQueryData(key, (old: object | undefined) => (old ? { ...old, ...d } : old)) },
    onSettled: () => { void qc.invalidateQueries({ queryKey: notificationKeys.all }) },
  })
}

/* ===== 공지 ===== */
export function useNotices(page: number) {
  return useQuery({
    queryKey: settingsKeys.noticePage(page),
    queryFn: ({ signal }) => settingsApi.notices({ page, size: NOTICE_PAGE_SIZE }, signal),
    select: toNoticePage,
    placeholderData: keepPreviousData,
  })
}
export function useNotice(id: string) {
  return useQuery({ queryKey: settingsKeys.notice(id), queryFn: ({ signal }) => settingsApi.notice(toDtoId(id), signal), select: toNotice, enabled: !!id })
}

/* ===== 탈퇴 ===== */
/** GET /me/withdrawal-check — 열 때 · Google 에서 돌아왔을 때 (늘 새로) */
export function useWithdrawalCheck() {
  return useQuery({ queryKey: settingsKeys.withdrawalCheck, queryFn: ({ signal }) => settingsApi.withdrawalCheck(signal), select: toWithdrawalCheck, staleTime: 0 })
}
export function useWithdraw() {
  return useSessionMutation({ mutationFn: (req: WithdrawRequest) => settingsApi.withdraw(req) })
}

/** 목 모드: 저장소(관리자의 공지 작성 · 계정 데모 손잡이 · 알림 설정)가 바뀌면 이 영역 캐시를 새로 받음 (api/mockSync.tsx 가 부름) */
export function useSettingsMockSync() {
  useMockStoreSync('settings', useServiceNotices(), settingsKeys.notices)
  useMockStoreSync('settings', accountStore.use(), settingsKeys.account)
  useMockStoreSync('settings', noticePrefs.use().kinds, settingsKeys.notificationSettings)
}
