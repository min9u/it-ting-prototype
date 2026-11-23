/**
 * 00 공통 — 목 서버. 캠퍼스 · 층은 data/campusFloors.ts, 기수는 data/auth.ts GENERATIONS 를 "DB"로 씀.
 * id: 캠퍼스는 이름, 층은 "캠퍼스|층" 글자 id 를 toDtoId 로 숫자로 (앱 쪽 toAppId 로 되돌아옴 → 탐색 들판이 쓰는 글자와 같음)
 */
import { campusesInOrder } from '../../data/campusFloors'
import { GENERATIONS } from '../../data/auth'
import { items, mockRead } from '../mock/server'
import { toDtoId } from './ids'
import type { CommonApi } from './real'

export const mock: CommonApi = {
  campuses: (signal) => mockRead(() => items(campusesInOrder().map((c) => ({
    id: toDtoId(c.campus), name: c.campus,
    floors: [...c.floors].sort((a, b) => a - b).map((floor) => ({ id: toDtoId(`${c.campus}|${floor}`), floor })),
  }))), { signal }),
  generations: (signal) => mockRead(() => items(
    [...new Set(GENERATIONS.map((g) => parseInt(g, 10)))].sort((a, b) => b - a).map((generation) => ({ generation })),
  ), { signal }),
}
