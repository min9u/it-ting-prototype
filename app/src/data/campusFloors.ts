/**
 * 캠퍼스 · 층 목록 (00 공통 19, 임시 목록 — 관리 화면은 두지 않음). 앱 전체가 이 파일 한 곳을 같이 씀:
 * 회원가입 3 · 내 정보 수정 · 탐색 들판 · 추천 · 목 서버(api/burrows). 서버가 생기면 GET /campuses 값으로 바뀜.
 *
 * 순서가 두 가지임 (섞지 말 것):
 *  - CAMPUS_FLOORS: 데이터 순서. 층 → 작물 돌려 쓰기(data/field.ts cropOf)와 목 들판이 이 순서에 의존하므로 바꾸지 않음
 *  - CAMPUSES · campusesInOrder(): 화면에 보이는 캠퍼스 순서. 05 탐색 · 방문 명세의 "서울 · 대전 · 부울경 · 구미 · 광주"
 */
export const CAMPUS_FLOORS: { campus: string; floors: number[] }[] = [
  { campus: '서울', floors: [2, 3, 12] },
  { campus: '대전', floors: [1, 2] },
  { campus: '광주', floors: [1] },
  { campus: '구미', floors: [2, 3] },
  { campus: '부울경', floors: [1] },
]

/** 화면에 보이는 캠퍼스 순서 (05 탐색 · 방문 명세 "캠퍼스 선택") */
export const CAMPUS_SHOW_ORDER = ['서울', '대전', '부울경', '구미', '광주']
const campusRank = (c: string) => { const i = CAMPUS_SHOW_ORDER.indexOf(c); return i < 0 ? CAMPUS_SHOW_ORDER.length : i }

/** 캠퍼스 이름을 화면 순서로 */
export const CAMPUSES: string[] = CAMPUS_FLOORS.map((c) => c.campus).sort((a, b) => campusRank(a) - campusRank(b))
/** { campus, floors } 를 화면 순서로 (원본 배열은 건드리지 않음) */
export const campusesInOrder = () => [...CAMPUS_FLOORS].sort((a, b) => campusRank(a.campus) - campusRank(b.campus))
/** 그 캠퍼스의 층 번호 (없는 캠퍼스면 빈 목록) */
export const floorsOf = (campus: string): number[] => CAMPUS_FLOORS.find((c) => c.campus === campus)?.floors ?? []
