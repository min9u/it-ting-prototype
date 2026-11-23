/**
 * 화면이 API 로만 읽고 쓰는지: 내 정보 수정(PATCH /me/profile · POST /nicknames/check) · 프로필 팝업(GET /users/{userId}/profile)
 * 목 서버를 그대로 써서 화면 → 훅 → 목 서버 → 응답 → 화면까지 한 번에 본다 (?api=fast)
 * (vitest 설정이 *.test.ts 만 읽어서 JSX 대신 createElement)
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from './memoryRouter'
import { createElement as h, type ReactNode } from 'react'
import MyInfoEdit from '../screens/burrow/MyInfoEdit'
import ProfilePopup from '../components/ProfilePopup'
import { burrowApi, toMyBurrow } from '../api/burrow'
import { USERS } from '../data/mock'
import { getMyProfile } from '../data/myBurrow'

beforeAll(() => { sessionStorage.setItem('digul.api.knobs', 'fast') })

function wrap(children: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(h(QueryClientProvider, { client: qc }, h(MemoryRouter, null, children)))
}

describe('내 정보 수정', () => {
  it('겹치는 닉네임은 칸 밑 문구 + 저장 막힘, 바꾸면 저장 → 응답으로 돌아감', async () => {
    const initial = toMyBurrow(await burrowApi.myBurrow())
    const onSaved = vi.fn()
    wrap(h(MyInfoEdit, { initial, onCancel: () => {}, onSaved }))
    const save = screen.getByRole('button', { name: /저장하기/ }) as HTMLButtonElement
    // 관심사 · 캠퍼스 목록을 받으면 저장할 수 있음
    await waitFor(() => expect(save.disabled).toBe(false))

    const nick = screen.getByLabelText(/닉네임/)
    fireEvent.change(nick, { target: { value: '예린' } })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/이미 쓰고 있는 닉네임/), { timeout: 3000 })
    expect(save.disabled).toBe(true)

    fireEvent.change(nick, { target: { value: '새로운두더지' } })
    await waitFor(() => expect(screen.getByText(/사용할 수 있는 닉네임/)).toBeTruthy(), { timeout: 3000 })
    fireEvent.change(screen.getByLabelText(/자기소개/), { target: { value: '화면에서 저장한 자기소개' } })
    await act(async () => { fireEvent.click(save) })
    await waitFor(() => expect(onSaved).toHaveBeenCalled(), { timeout: 3000 })
    const [b, moved] = onSaved.mock.calls[0]
    expect(b.nickname).toBe('새로운두더지')
    expect(b.intro).toBe('화면에서 저장한 자기소개')
    expect(moved).toBe(false)
    expect(getMyProfile().nickname).toBe('새로운두더지')
  })
})

describe('프로필 팝업', () => {
  it('GET /users/{userId}/profile 로 관심사 · 겹침(✓)을 보여 주고, 차단 메뉴는 없음', async () => {
    wrap(h(ProfilePopup, { user: USERS.yerin, onClose: () => {} }))
    await waitFor(() => expect(screen.getAllByText(/✓/).length).toBeGreaterThan(0), { timeout: 3000 })
    expect(screen.getByText('땅굴 놀러가기')).toBeTruthy()
    expect(screen.queryByText('차단하기')).toBeNull()
    expect(screen.getByRole('button', { name: /신고/ })).toBeTruthy()
  })
})
