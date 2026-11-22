/**
 * 새 학기 안내 (명세 05 "땅굴 메인 – 새 학기 안내" · 00 공통 19 · api 05 "새 학기를 고르지 않은 계정")
 *
 * 새 학기 들판이 열렸는데 이번 학기의 캠퍼스 · 층을 아직 안 고른 계정은, 접속하면 내 땅굴 위에 안내가 뜨고
 * 고르기 전에는 닫을 수 없다(× · "나중에 하기" · Esc · 바깥 클릭 모두 없음). 서버에서는 `GET /me` 의 nextStep = NEW_TERM.
 * 프로토타입에는 학기가 하나뿐이라 시연 손잡이로 켠다:
 *   ?newterm=1 → 새 학기가 열린 것으로 함(고르기 전까지 계속 뜸. 주소에 붙어 있으면 새로고침해도 다시 뜸)
 *   ?newterm=0 → 되돌림(안내 없음, 지난 학기에 있던 층으로 복귀)
 * 저장하지 않음(이 탭 메모리에만): 저장하면 한 번 켠 뒤 모든 화면이 안내에 막혀 화면 목록 · 스모크가 깨짐. 서버가 생기면 GET /me 의 nextStep 이 이 역할을 함
 */
import { createStore } from '../lib/store'
import { MY_FLOOR, moveMyBurrow } from './field'
import { setMyProfile } from './myBurrow'

/** 새 학기 이름 (화면에 적는 표기는 디자인이 정함: Figma 1465:15925 "2027 상반기") */
export const NEW_TERM_NAME = '2027 상반기'

interface NewTermState {
  /** 새 학기 들판이 열렸는가 */
  open: boolean
  /** 이번(새) 학기의 캠퍼스 · 층을 골랐는가 */
  chosen: boolean
  /** 지난 학기에 땅굴이 있던 캠퍼스 · 층 (안내에서 처음 선택해 두고 "지난 학기" 표시) */
  lastCampus: string
  lastFloor: number
}
export const newTermStore = createStore<NewTermState>({ open: false, chosen: false, lastCampus: '', lastFloor: 0 })

export const isNewTermPending = (s = newTermStore.get()) => s.open && !s.chosen
export const useNewTermPending = () => isNewTermPending(newTermStore.use())
export const useNewTerm = () => newTermStore.use()

/** 시연: 새 학기가 열린 것으로 함 (지난 학기 자리 = 지금 내 땅굴 자리) */
export function openNewTerm() {
  const s = newTermStore.get()
  if (s.open && !s.chosen) return
  newTermStore.set({ open: true, chosen: false, lastCampus: MY_FLOOR.campus, lastFloor: MY_FLOOR.floor })
}
/** 시연: 되돌림 (지난 학기에 있던 자리로 돌아감) */
export function resetNewTerm() {
  const s = newTermStore.get()
  if (!s.open && !s.chosen) return
  if (s.lastCampus) { moveMyBurrow(s.lastCampus, s.lastFloor); setMyProfile({ campus: s.lastCampus, floor: s.lastFloor }) }
  newTermStore.set({ open: false, chosen: false, lastCampus: '', lastFloor: 0 })
}

/**
 * "이 층으로 정하기": 내 땅굴이 고른 캠퍼스 · 층의 이번 학기 들판으로 이사한다 (서버: POST /me/burrow/move).
 * 방명록 · 단골 · 방의 모습은 그대로, 위치만 바뀜. 프로필의 캠퍼스 · 층도 그 값으로. 지난 학기 들판의 자리는 비고 입구가 남지 않음.
 */
export function chooseNewTermFloor(campus: string, floor: number) {
  moveMyBurrow(campus, floor)
  setMyProfile({ campus, floor })
  newTermStore.set({ chosen: true })
}
