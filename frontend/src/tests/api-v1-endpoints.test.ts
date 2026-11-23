/**
 * 완성도 검사: 백엔드 확정 명세(docs/backend/team-spec/api/*.md)의 API 제목 111개와 영역마다의 ENDPOINTS 비교
 * (docs/backend/api-v1-foundation.md "완성도 검사").
 *
 * - 명세의 "## GET /api/v1/…" 제목 = 만들어야 할 API
 * - api/<영역>/real.ts 의 ENDPOINTS = 명세대로 만든 API
 * - api/<영역>/PENDING = 아직 안 만든 API (영역 작업자가 맡은 목록). 여기 있는 것은 it.todo 로 보이고 실패하지 않음
 * 실패하는 때: 명세에 있는데 어느 영역도 맡지 않음 / ENDPOINTS 에 명세에 없는 주소 / 두 영역이 같은 API / ENDPOINTS 와 PENDING 에 둘 다
 * 모든 영역의 PENDING 이 비면 명세를 다 맞춘 것
 */
import { describe, expect, it } from 'vitest'
import { AREAS, type Area } from '../api/config'
import { ENDPOINTS_BY_AREA } from '../api/endpoints'
import { TEAM_DOCS } from './teamDocs'

const FS = 'node:fs' // 브라우저 타입에 node 가 없어서 문자열로 불러옴 (rules.test 와 같은 방식)
const fs = (await import(/* @vite-ignore */ FS)) as {
  readFileSync(p: string, enc: string): string
  readdirSync(p: string): string[]
  existsSync(p: string): boolean
}

const SPEC_DIR = `${TEAM_DOCS}/api`
const HEADING = /^#+ ((?:GET|POST|PATCH|PUT|DELETE) \/api\/v1\S*)\s*$/

/** 명세 API: "메서드 주소" → 문서 이름 */
const spec = new Map<string, string>()
for (const f of fs.readdirSync(SPEC_DIR).filter((x) => /^\d\d-.*\.md$/.test(x)).sort()) {
  for (const line of fs.readFileSync(`${SPEC_DIR}/${f}`, 'utf8').split('\n')) {
    const m = HEADING.exec(line)
    if (m) spec.set(m[1], f)
  }
}

/** 영역의 PENDING (주석 · 빈 줄 빼고) */
function pendingOf(area: Area): string[] {
  const p = `src/api/${area}/PENDING`
  if (!fs.existsSync(p)) return []
  return fs.readFileSync(p, 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean)
}
const PENDING = Object.fromEntries(AREAS.map((a) => [a, pendingOf(a)])) as Record<Area, string[]>

describe('API 명세 v1 완성도', () => {
  it('명세에서 API 제목 111개를 읽음', () => {
    expect(spec.size).toBe(111)
  })

  it('ENDPOINTS · PENDING 에 적은 주소는 모두 명세에 있음 (오타 · 옛 주소 막기)', () => {
    for (const a of AREAS) {
      for (const ep of ENDPOINTS_BY_AREA[a]) expect(spec.has(ep), `${a} ENDPOINTS: ${ep}`).toBe(true)
      for (const ep of PENDING[a]) expect(spec.has(ep), `${a}/PENDING: ${ep}`).toBe(true)
    }
  })

  it('한 API 는 한 영역만 맡음, 만든 API 는 PENDING 에서 지움', () => {
    const owner = new Map<string, string>()
    for (const a of AREAS) {
      for (const ep of [...ENDPOINTS_BY_AREA[a], ...PENDING[a]]) {
        expect(owner.get(ep), `${ep} 를 ${owner.get(ep)} 과 ${a} 가 함께 적음 (ENDPOINTS 와 PENDING 에 둘 다 있어도 이 오류)`).toBeUndefined()
        owner.set(ep, a)
      }
    }
  })

  it('명세의 모든 API 가 어느 영역의 ENDPOINTS 나 PENDING 에 있음', () => {
    const claimed = new Set(AREAS.flatMap((a) => [...ENDPOINTS_BY_AREA[a], ...PENDING[a]]))
    const missing = [...spec.keys()].filter((ep) => !claimed.has(ep))
    expect(missing, '맡은 영역이 없는 API').toEqual([])
  })
})

// 영역별 남은 일 (vitest 출력에 todo 로 보임)
for (const a of AREAS) {
  const done = ENDPOINTS_BY_AREA[a].length
  const left = PENDING[a]
  describe(`영역 ${a}: 만든 것 ${done} · 남은 것 ${left.length}`, () => {
    if (!left.length) it(`${a}: 남은 API 없음`, () => expect(left).toEqual([]))
    for (const ep of left) it.todo(`${ep}  (${spec.get(ep) ?? '?'})`)
  })
}
