/**
 * 꾸미기 소품 탭 (screens/burrow/DecorPanel.tsx PropTab, 2026-11-21 v3.8 5단계)
 * 칩 = 내 관심사 중 단어를 고를 수 있는 것(90개 중 57개). 고른 값(FurnChoice) = 소분류 → 단어, 처음 값은 첫 단어
 */
import { describe, expect, it } from 'vitest'
import { SUB_WORDS, wordsOfSub } from '../data/interestWords'
import { planRoom } from '../data/roomPlan'
import { getMyFurnChoice, pruneChoice, setMyFurnChoice, wordChoices } from '../data/myBurrow'
import { validFurniture } from '../data/roomLook'
import { INTEREST_SUBS } from '../data/interests'

describe('소품 탭: 칩 · 후보', () => {
  it('칩이 되는 소분류는 57개, 이름에 "/"가 있는 58개에서 "액세서리/기타"(모델 1개 = 고정)만 빠짐', () => {
    const chips = SUB_WORDS.filter((s) => wordChoices(s.subId).length > 0)
    expect(chips.length).toBe(57)
    const slash = INTEREST_SUBS.filter((s) => s.name_ko.includes('/'))
    expect(slash.length).toBe(58)
    expect(slash.filter((s) => wordChoices(s.id).length === 0).map((s) => s.name_ko)).toEqual(['액세서리/기타'])
  })
  it('후보 수 = 단어 수, 한 단어 관심사는 후보 없음(고정)', () => {
    for (const sw of SUB_WORDS) expect(wordChoices(sw.subId)).toEqual(sw.pickable ? sw.words.map((w) => w.word) : [])
  })
  it('후보마다 모델 이름과 모델 노드가 있음 (카드 = 썸네일 + 이름)', () => {
    for (const sw of SUB_WORDS) for (const w of sw.words) { expect(w.name.length).toBeGreaterThan(0); expect(w.node.length).toBeGreaterThan(0) }
  })
})

describe('소품 탭: 고르면 방에 반영', () => {
  it('소분류 하나만 골랐을 때 고른 단어의 모델이 방에 놓임 (57개 × 단어 전부)', () => {
    for (const sw of SUB_WORDS.filter((s) => s.pickable)) {
      for (const w of sw.words) {
        const ids = planRoom([sw.subId], { [sw.subId]: w.word }).items.map((i) => i.row.id)
        expect(ids, `${sw.tag} → ${w.word}`).toContain(w.pet ? w.pet : w.node)
      }
    }
  })
  it('처음 값(고른 게 없음) = 첫 단어', () => {
    const sw = SUB_WORDS.find((s) => s.pickable)!
    const ids = planRoom([sw.subId], {}).items.map((i) => i.row.id)
    expect(ids).toContain(sw.words[0].pet ?? sw.words[0].node)
  })
  it('모르는 단어를 넣으면 첫 단어로 (옛 저장값 방어)', () => {
    const sw = SUB_WORDS.find((s) => s.pickable)!
    const a = planRoom([sw.subId], { [sw.subId]: '없는단어' }).items.map((i) => i.row.id)
    const b = planRoom([sw.subId], {}).items.map((i) => i.row.id)
    expect(a).toEqual(b)
  })
})

describe('소품 탭: 저장 · 관심사 바꾸면', () => {
  it('저장한 선택을 다시 읽으면 같음', () => {
    const sw = SUB_WORDS.find((s) => s.pickable)!
    setMyFurnChoice({ [sw.subId]: sw.words[1].word })
    expect(getMyFurnChoice()).toEqual({ [sw.subId]: sw.words[1].word })
    setMyFurnChoice({})
  })
  it('관심사에서 뺀 소분류의 선택은 사라지고 둔 것은 유지', () => {
    const [a, b] = SUB_WORDS.filter((s) => s.pickable)
    const c = { [a.subId]: a.words[1].word, [b.subId]: b.words[1].word }
    expect(pruneChoice(c, [a.subId])).toEqual({ [a.subId]: a.words[1].word })
  })
  it('남이 보는 땅굴: 단어 후보에 없는 값은 버림', () => {
    const sw = SUB_WORDS.find((s) => s.pickable)!
    expect(validFurniture({ [sw.subId]: '없는단어' }, [sw.subId])).toEqual({})
    expect(validFurniture({ [sw.subId]: sw.words[1].word }, [sw.subId])).toEqual({ [sw.subId]: sw.words[1].word })
    expect(wordsOfSub(sw.subId)).toBeTruthy()
  })
})

describe('소품 썸네일 (3D 핸드오프 v3.8.1, 규격은 docs/room-interest-v3-8-step4-5.md 3번)', () => {
  const FS = 'node:fs'
  const NODES = SUB_WORDS.filter((s) => s.pickable).flatMap((s) => s.words.map((w) => w.node))
  const load = async () => (await import(/* @vite-ignore */ FS)) as { readdirSync(p: string): string[]; readFileSync(p: string): Uint8Array }
  const DIR = 'src/assets/prop-thumbs'

  it('단어를 고를 수 있는 소분류의 모델 131개 전부 썸네일이 있고, 남는 파일은 없음', async () => {
    const fs = await load()
    expect(NODES).toHaveLength(131)
    expect(new Set(NODES).size).toBe(131)
    const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, ''))
    expect(NODES.filter((n) => !files.includes(n)), '없는 썸네일').toEqual([])
    expect(files.filter((f) => !NODES.includes(f)), '모델과 이름이 안 맞는 파일').toEqual([])
  })
  it('규격: 192×192 투명(알파) WebP, 파일당 12KB 이하', async () => {
    const fs = await load()
    for (const n of NODES) {
      const b = fs.readFileSync(`${DIR}/${n}.webp`)
      expect(new TextDecoder().decode(b.subarray(0, 4)), n).toBe('RIFF')
      expect(new TextDecoder().decode(b.subarray(8, 12)), n).toBe('WEBP')
      // 알파가 있는 WebP 는 VP8X 확장 헤더: 플래그 바이트 0x10 = 알파, 캔버스 폭·높이(−1) 3바이트씩
      expect(new TextDecoder().decode(b.subarray(12, 16)), `${n} VP8X`).toBe('VP8X')
      expect(b[20] & 0x10, `${n} 알파`).toBe(0x10)
      const w = 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h = 1 + (b[27] | (b[28] << 8) | (b[29] << 16))
      expect([w, h], n).toEqual([192, 192])
      expect(b.byteLength, n).toBeLessThanOrEqual(12 * 1024)
    }
  })
})
