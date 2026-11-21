/**
 * 관심사 소품 v3.8 단어 데이터 (data/interestWords.ts ← interest_words_v3_8.json, 3D 핸드오프 v3.8)
 * - 단어 164개 node 가 대분류 glb 12개의 루트 노드 이름과 빠짐 · 남음 없이 일치 (HANDOFF_v3_8.md 3번)
 * - 소분류 90개가 앱 TAG_TREE 와 같음 (이름 대조: docs/interest-words-v3-8-compare.md)
 * - 고르기 57 · 고정 33, 예외 2건
 */
import { describe, expect, it } from 'vitest'
import wordsRaw from '../data/interest_words_v3_8.json'
import slotsNew from '../data/slots.json'
import { TAG_TREE } from '../data/interestTags'
import { JSON_TO_APP_CATEGORY, SUB_WORDS, WORD_MAX_PICK, WORD_MODEL_FILES, defaultWord, isPickable, wordModelFile, wordsOfSub } from '../data/interestWords'
import { MAX_PICK } from '../data/interestTags'

const raw = wordsRaw as unknown as { categories: { id: string; subs: { tag: string; words: { word: string; node: string; pet: string | null }[] }[] }[] }
const ALL_WORDS = SUB_WORDS.flatMap((s) => s.words)

/** glb 첫 장면의 루트 노드 이름 (JSON 청크만 읽음. Draco 해독 안 함) */
async function rootNames(file: string): Promise<string[]> {
  const spec = 'node:fs' // @types/node 가 없어서 문자열로 불러 타입 검사를 피함
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync: (path: string) => Uint8Array }
  const buf = fs.readFileSync(`src/assets/models/room/${file}`) // vitest 는 app/ 에서 실행
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const len = dv.getUint32(12, true)
  const json = JSON.parse(new TextDecoder().decode(buf.subarray(20, 20 + len))) as { scene?: number; scenes: { nodes: number[] }[]; nodes: { name?: string }[] }
  return json.scenes[json.scene ?? 0].nodes.map((i) => json.nodes[i].name ?? '')
}

describe('관심사 v3.8 단어 데이터', () => {
  it('최대 선택은 10개(앱과 같음)', () => {
    expect(WORD_MAX_PICK).toBe(MAX_PICK)
  })

  it('대분류 12개, 소분류 90개, 단어 164개', () => {
    expect(raw.categories).toHaveLength(12)
    expect(SUB_WORDS).toHaveLength(90)
    expect(ALL_WORDS).toHaveLength(164)
  })

  it('JSON 소분류 90개가 앱 TAG_TREE 와 이름 · 순서까지 같음 (대분류 id 는 5개만 다르고 표로 바꿈)', () => {
    for (const cat of TAG_TREE) {
      const jc = raw.categories.find((c) => (JSON_TO_APP_CATEGORY[c.id] ?? c.id) === cat.id)
      expect(jc, `${cat.id} 대분류가 JSON 에 있음`).toBeTruthy()
      expect(jc!.subs.map((s) => s.tag)).toEqual(cat.subs.map(([, n]) => n))
    }
    expect(Object.keys(JSON_TO_APP_CATEGORY).sort()).toEqual(['craft', 'fandom', 'music', 'photo', 'self_dev'])
    for (const appId of Object.values(JSON_TO_APP_CATEGORY)) expect(TAG_TREE.some((c) => c.id === appId)).toBe(true)
  })

  it('고르기 57 · 고정 33, 단어 수는 "/" 쪼갠 수(예외 2건만 하나 적음)', () => {
    expect(SUB_WORDS.filter((s) => s.pickable)).toHaveLength(57)
    expect(SUB_WORDS.filter((s) => !s.pickable)).toHaveLength(33)
    const diff = SUB_WORDS.filter((s) => s.words.map((w) => w.word).join('/') !== s.tag)
    expect(diff.map((s) => s.tag).sort()).toEqual(['곤충/파충류/기타', '액세서리/기타'])
    // 이름에 "/"가 있는 소분류는 58개 (F4 문서의 표와 같음)
    expect(SUB_WORDS.filter((s) => s.tag.includes('/'))).toHaveLength(58)
  })

  it('예외 2건: 액세서리/기타 → 액세서리 고정, 곤충/파충류/기타 → 곤충 · 파충류 중 고르기', () => {
    const acc = SUB_WORDS.find((s) => s.tag === '액세서리/기타')!
    expect(acc.words.map((w) => w.word)).toEqual(['액세서리'])
    expect(isPickable(acc.subId)).toBe(false)
    const bug = SUB_WORDS.find((s) => s.tag === '곤충/파충류/기타')!
    expect(bug.words.map((w) => w.word)).toEqual(['곤충', '파충류'])
    expect(isPickable(bug.subId)).toBe(true)
    expect(defaultWord(bug.subId)?.word).toBe('곤충')
  })

  it('"기타" 라는 단어(모델)는 없음. 이름에 기타가 든 기타/베이스/일렉 · 기타언어는 그대로', () => {
    expect(ALL_WORDS.some((w) => w.word === '기타' && w.name.includes('기타') === false)).toBe(false)
    expect(wordsOfSub(SUB_WORDS.find((s) => s.tag === '기타언어')!.subId)!.words).toHaveLength(1)
    expect(SUB_WORDS.find((s) => s.tag === '기타/베이스/일렉')!.words.map((w) => w.word)).toEqual(['기타', '베이스', '일렉'])
  })

  it('단어 node 164개는 서로 다르고, 반려동물 단어 7개는 동물 노드(pet)가 있음', () => {
    expect(new Set(ALL_WORDS.map((w) => w.node)).size).toBe(164)
    expect(ALL_WORDS.filter((w) => w.pet).map((w) => w.word)).toEqual(['강아지', '고양이', '설치류', '소동물', '새', '곤충', '파충류'])
  })

  it('크기 구성 작은 134 · 큰 27 · 벽 3', () => {
    const n = (k: string) => ALL_WORDS.filter((w) => w.size === k).length
    expect([n('작은'), n('큰'), n('벽')]).toEqual([134, 27, 3])
  })

  it('처음 값은 첫 단어', () => {
    for (const s of SUB_WORDS) expect(defaultWord(s.subId)).toBe(s.words[0])
  })

  it('대분류 glb 12개: 루트 노드 이름 = 그 대분류 단어 node (+ 동물 pet 노드), 빠짐 · 남음 없음', async () => {
    expect(WORD_MODEL_FILES).toHaveLength(12)
    for (const jc of raw.categories) {
      const expected = jc.subs.flatMap((s) => s.words.flatMap((w) => (w.pet ? [w.node, w.pet] : [w.node])))
      const roots = await rootNames(wordModelFile(jc.id))
      expect([...roots].sort(), `${jc.id} 루트 노드`).toEqual([...expected].sort())
    }
  })
})

describe('slots.json (v3.8.1 슬롯 54개)', () => {
  const rows = slotsNew as unknown as { name: string; slot_type: string; kind: string; drop_by_height?: unknown[] }[]
  it('54개: 바닥 공용 20 + 벽 공용 4 + 선반 12 + 동물 5 + 용품 5 + 앞 구석 2 + 우체통 1 + 작은 소품 바닥 3 · 원탁 위 2', () => {
    expect(rows).toHaveLength(54)
    expect(new Set(rows.map((r) => r.name)).size).toBe(54)
    const n = (t: string, k: string) => rows.filter((r) => r.slot_type === t && r.kind === k).length
    expect(n('shared_big', 'floor')).toBe(20)
    expect(n('shared_big', 'wall')).toBe(4)
    expect(n('prop', 'shelf')).toBe(12)
    expect(n('pet', 'pet_floor')).toBe(5)
    expect(n('prop', 'pet_floor')).toBe(5)
    expect(n('fixed', 'fixed_floor')).toBe(1)
  })
  it('바닥 공용 자리 20칸에는 모두 drop_by_height 가 있음', () => {
    const floor = rows.filter((r) => r.slot_type === 'shared_big' && r.kind === 'floor')
    expect(floor.every((r) => (r.drop_by_height?.length ?? 0) > 0)).toBe(true)
  })
})
