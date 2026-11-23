/**
 * 관심사 소품 v3.8 단어 데이터 층 (3D 핸드오프 v3.8 interest_words_v3_8.json, 2026-11-18)
 * 계획·이름 대조: docs/room-interest-v3-8-plan.md · docs/interest-words-v3-8-compare.md
 *
 * 소분류("카페/커피")를 "/"로 쪼갠 단어("카페", "커피")마다 모델(node) 1개. 단어가 하나면 고정, 둘 이상이면 그중 하나 고르기
 * (판별은 words.length 하나로 함 — "액세서리/기타"는 기타 모델이 없어 단어 1개 = 고정, "곤충/파충류/기타"는 곤충·파충류 중 고르기).
 * 이름은 data/interestTags.ts(11-18 확정본)와 같고, 다른 것은 대분류 영어 id 5개뿐이라 아래 표로 앱 id 로 바꿈(앱 id 는 백엔드 enum 이라 그대로).
 *
 * 이 파일은 아직 방 배치(roomPlan.ts planRoom)에서 안 씀. 2단계에서 planRoom 을 새 규칙으로 바꿀 때 연결.
 */
import wordsRaw from './interest_words_v3_8.json'
import { TAG_TREE } from './interestTags'

/** 핸드오프 JSON 의 대분류 id → 앱 interestTags.ts id (이름이 같은 7개는 그대로) */
export const JSON_TO_APP_CATEGORY: Readonly<Record<string, string>> = {
  music: 'music_dance',
  self_dev: 'language_selfdev',
  photo: 'photo_video',
  craft: 'art_craft',
  fandom: 'fandom_collect',
}
export const appCategoryOf = (jsonId: string) => JSON_TO_APP_CATEGORY[jsonId] ?? jsonId

export type WordSize = '작은' | '큰' | '벽'
export interface WordDef {
  /** "/"로 쪼갠 단어 (예: 카페) */
  word: string
  /** glb 안 노드 이름 (대분류 glb 의 루트 노드) */
  node: string
  /** 반려동물 단어면 동물 노드 이름(pet_dog …). 아니면 null. node 는 이때 동물 용품 */
  pet: string | null
  /** 모델 한글 이름 (예: 에스프레소 머신) */
  name: string
  size: WordSize
  status: '기존' | '새로' | '되살림'
}
export interface SubWords {
  /** 앱 소분류 id (interestTags.ts) */
  subId: string
  /** 소분류 이름 (= 화면에 보이는 관심사 값) */
  tag: string
  /** 앱 대분류 id */
  categoryId: string
  /** 핸드오프 JSON 의 대분류 id (glb 파일 이름에 씀) */
  jsonCategoryId: string
  /** 쪼갠 단어와 모델. 첫 단어가 처음 값 */
  words: WordDef[]
  /** 둘 이상이면 단어 중 하나 고르기(true), 하나면 고정(false) */
  pickable: boolean
}

interface RawWord { word: string; node: string; pet: string | null; name: string; size: string; status: string }
interface RawJson { max_pick: number; categories: { id: string; name: string; subs: { tag: string; words: RawWord[] }[] }[] }
const raw = wordsRaw as unknown as RawJson

/** 소분류 90개 (TAG_TREE 순서). JSON 과 이름이 안 맞으면 그 소분류는 빠짐 → tests/interest-words.test.ts 가 잡음 */
export const SUB_WORDS: readonly SubWords[] = TAG_TREE.flatMap((cat) => {
  const jc = raw.categories.find((c) => appCategoryOf(c.id) === cat.id)
  if (!jc) return []
  return cat.subs.flatMap(([subId, name]): SubWords[] => {
    const js = jc.subs.find((s) => s.tag === name)
    if (!js) return []
    const words = js.words as WordDef[]
    return [{ subId, tag: name, categoryId: cat.id, jsonCategoryId: jc.id, words, pickable: words.length > 1 }]
  })
})

const BY_SUB = new Map(SUB_WORDS.map((s) => [s.subId, s]))
export const wordsOfSub = (subId: string): SubWords | undefined => BY_SUB.get(subId)
/** 단어 중 하나 고르는 소분류인가 (아니면 고정) */
export const isPickable = (subId: string) => BY_SUB.get(subId)?.pickable ?? false
/** 처음 값 = 첫 단어 */
export const defaultWord = (subId: string): WordDef | undefined => BY_SUB.get(subId)?.words[0]

/** 대분류 glb 파일 이름 (assets/models/room/ 안). jsonCategoryId = 핸드오프 JSON 의 id */
export const wordModelFile = (jsonCategoryId: string) => `interest_${jsonCategoryId}_v3_8_draco_webp.glb`
export const WORD_MODEL_FILES: readonly string[] = raw.categories.map((c) => wordModelFile(c.id))
export const WORD_MAX_PICK = raw.max_pick
