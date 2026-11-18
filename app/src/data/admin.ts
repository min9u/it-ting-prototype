import { createStore } from '../lib/store'

/**
 * F11 운영 · 관리자 (저충실도). 화면 세부는 "추후 정한다"라 기능 목록만 동작하게 둔 목 데이터.
 */
export type QuestionType = '관심사' | 'TMI'
export interface IntroQuestion { id: string; text: string; type: QuestionType; category: string | null }

export const questionStore = createStore<{ list: IntroQuestion[] }>({
  list: [
    { id: 'q1', text: '요즘 가장 자주 듣는 시티팝 한 곡은?', type: '관심사', category: '음악·댄스' },
    { id: 'q2', text: '필름카메라로 처음 찍은 건 뭐였어요?', type: '관심사', category: '사진·영상' },
    { id: 'q3', text: '하루 동안 투명 인간이 된다면 뭐 해볼래요?', type: 'TMI', category: null },
    { id: 'q4', text: '남들은 모르는 나만의 잠버릇은?', type: 'TMI', category: null },
    { id: 'q5', text: '테라리움에 꼭 넣고 싶은 식물은?', type: '관심사', category: '반려동물·식물' },
  ],
})
export function saveQuestion(q: Omit<IntroQuestion, 'id'> & { id?: string }) {
  questionStore.set((s) => ({
    list: q.id ? s.list.map((x) => (x.id === q.id ? { ...x, ...q, id: x.id } : x)) : [...s.list, { ...q, id: `q${Date.now().toString(36)}` }],
  }))
}

export type ReportTarget = '글' | '댓글' | '사용자' | '방명록 글'
export interface ReportItem {
  id: string
  target: ReportTarget
  summary: string
  reason: string
  reporter: string
  at: string
  status: '대기' | '가림' | '복구' | '삭제' | '문제 없음'
  memo?: string
}
export const reportStore = createStore<{ list: ReportItem[] }>({
  list: [
    { id: 'rp1', target: '글', summary: '‘중고 텐트 나눔해요’', reason: '스팸·홍보', reporter: '하늘', at: '2026.11.14', status: '가림', memo: '외부 판매 링크 반복' },
    { id: 'rp2', target: '댓글', summary: '“그런 것도 몰라요?”', reason: '욕설·비하·괴롭힘', reporter: '예진', at: '2026.11.15', status: '대기' },
    { id: 'rp3', target: '사용자', summary: '산책토끼', reason: '기타', reporter: '서연', at: '2026.11.15', status: '대기' },
    { id: 'rp4', target: '방명록 글', summary: '“광고 보고 오세요 →”', reason: '스팸·홍보', reporter: '닉네임', at: '2026.11.16', status: '대기' },
  ],
})
export function resolveReport(id: string, status: ReportItem['status'], memo?: string) {
  reportStore.set((s) => ({ list: s.list.map((r) => (r.id === id ? { ...r, status, memo: memo ?? r.memo } : r)) }))
}

export interface Sanction { userId: string; nickname: string; until: string | null; reason: string }
export const sanctionStore = createStore<{ list: Sanction[] }>({
  list: [
    { userId: 'u-rabbit', nickname: '산책토끼', until: null, reason: '' },
    { userId: 'u-potato', nickname: '책읽는감자', until: '2026.11.20', reason: '반복된 홍보 글' },
    { userId: 'seobeok', nickname: '서벅이', until: null, reason: '' },
    { userId: 'ha', nickname: '하늘', until: null, reason: '' },
  ],
})
export function suspend(userId: string, days: number, reason: string) {
  const d = new Date(Date.now() + days * 86_400_000)
  const until = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  sanctionStore.set((s) => ({ list: s.list.map((u) => (u.userId === userId ? { ...u, until, reason } : u)) }))
}
export function liftSuspension(userId: string) {
  sanctionStore.set((s) => ({ list: s.list.map((u) => (u.userId === userId ? { ...u, until: null, reason: '' } : u)) }))
}
