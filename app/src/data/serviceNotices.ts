import { createStore } from '../lib/store'
import { addNotice } from './notifications'

/** F10 공지사항: 관리자가 올린다(F11 공지 작성). 서비스 버전이 바뀐 소식은 "업데이트" 분류 */
export type ServiceNoticeCat = '공지' | '업데이트' | '이벤트'
export const SERVICE_NOTICE_CATS: ServiceNoticeCat[] = ['공지', '업데이트', '이벤트']

export interface ServiceNotice {
  id: string
  cat: ServiceNoticeCat
  title: string
  /** YYYY.MM.DD */
  date: string
  body: string[]
}

const SEED: ServiceNotice[] = [
  { id: 'sn1', cat: '공지', title: '서비스 점검 안내', date: '2026.11.10', body: ['11월 15일(토) 02:00 ~ 04:00에 서버 점검을 합니다.', '점검하는 동안에는 디굴디굴에 접속할 수 없어요.', '', '더 나은 서비스로 찾아뵙겠습니다.'] },
  { id: 'sn2', cat: '업데이트', title: '채팅 기능 업데이트', date: '2026.11.07', body: ['1:1 대화와 모임 대화를 한 화면에서 볼 수 있게 바뀌었어요.', '받은 대화 요청은 5일 동안 보관돼요.'] },
  { id: 'sn3', cat: '공지', title: '이용약관 개정 안내', date: '2026.11.03', body: ['11월 17일부터 바뀐 이용약관이 적용돼요.', '바뀐 내용은 화면 아래 이용약관에서 확인할 수 있어요.'] },
  { id: 'sn4', cat: '이벤트', title: '가을 이벤트 안내', date: '2026.10.30', body: ['땅굴을 꾸미고 이웃을 초대해 보세요.', '방명록을 3개 이상 받으면 가을 가구를 드려요.'] },
  { id: 'sn5', cat: '업데이트', title: '알림 기능 개선 안내', date: '2026.10.25', body: ['설정 › 알림 설정에서 알림을 종류별로 켜고 끌 수 있어요.'] },
]

export const serviceNoticeStore = createStore({ list: SEED })
export const useServiceNotices = () => serviceNoticeStore.use().list
export const serviceNoticeOf = (id: string) => serviceNoticeStore.get().list.find((n) => n.id === id)

/** 관리자 공지 작성 → 맨 위에 추가 + "공지" 알림 */
export function addServiceNotice(n: Omit<ServiceNotice, 'id' | 'date'>) {
  const d = new Date()
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  const item: ServiceNotice = { ...n, id: `sn${Date.now().toString(36)}`, date }
  serviceNoticeStore.set((s) => ({ list: [item, ...s.list] }))
  addNotice({ type: 'NOTICE_PUBLISHED', targetId: item.id }) // 목 서버의 알림 (09 NOTICE_PUBLISHED, 모든 사용자 = 나)
  return item
}
