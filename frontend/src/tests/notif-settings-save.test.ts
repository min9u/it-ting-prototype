/**
 * 알림 설정 저장: 끝나면 설정을 서버에서 다시 받아 맞춤, 저장하는 동안 화면은 스위치를 잠금 (PR #37 Codex 리뷰 P1).
 * 앞 요청이 늦게 실패해 되돌리기가 다음 변경을 덮어써도 서버 값으로 돌아오게
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement as h, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { settingsApi } = await import('../api/settings/api')
const { settingsKeys, useUpdateNotificationSettings } = await import('../api/settings/queries')

const values = { isChatOn: true, isMeetupOn: true, isCommunityOn: true, isBurrowOn: true, isNoticeOn: true }

describe('알림 설정 저장 (useUpdateNotificationSettings)', () => {
  it('실패해도 끝나면 설정을 다시 받음 (되돌린 값이 서버 값과 달라도 바로잡힘)', async () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    qc.setQueryData(settingsKeys.notificationSettings, { ...values, pushPublicKey: null })
    const spy = vi.spyOn(settingsApi, 'updateNotificationSettings').mockRejectedValue(new Error('늦은 실패'))
    const wrapper = ({ children }: { children: ReactNode }) => h(QueryClientProvider, { client: qc }, children)
    const { result } = renderHook(() => useUpdateNotificationSettings(), { wrapper })
    act(() => { result.current.mutate({ ...values, isChatOn: false }) })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(qc.getQueryState(settingsKeys.notificationSettings)?.isInvalidated).toBe(true)
    spy.mockRestore()
  })

  it('화면: 저장하는 동안 알림 스위치를 잠금 (SettingsInfo)', async () => {
    const FS = 'node:fs'
    const fs = (await import(/* @vite-ignore */ FS)) as { readFileSync(p: string, e: string): string }
    const src = fs.readFileSync('src/screens/settings/SettingsInfo.tsx', 'utf8')
    expect(src).toMatch(/disabled=\{!q\.data \|\| update\.isPending\}/)
    expect(src).toMatch(/if \(!q\.data \|\| update\.isPending\) return/)
  })
})
