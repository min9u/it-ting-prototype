/**
 * 관심사 태그 확정본 (2026-11-18 사용자 확정: 대분류 12 · 소분류 90) → docs/interest-tags-2026-11-18.md
 * - 사용자가 준 목록(아래 USER_LIST, 받은 글 그대로)과 data/interestTags.ts 가 이름·순서·개수까지 같은지
 * - id 는 영어 소문자(백엔드 enum 후보) · 겹치지 않음 · 모든 소분류가 대분류에 속함
 * - 대분류마다 빠지면 안 되는 것: 3D 가구 연결 · 이펙트 색·입자·글리프 · 질문 · 땅굴 무드 이름 · 블록 색 · 목 인원수
 * - 예전 관심사 v2(65개) → 새 id 옮기기 · 목 데이터가 모두 새 이름을 씀
 */
import { isMeetupCategory } from '../data/meetupCategory'
import { describe, expect, it } from 'vitest'
import { LEGACY_CATEGORIES, LEGACY_SUBS, MAX_PICK, TAG_TREE } from '../data/interestTags'
import { CATEGORY_3D, SUB_PROP } from '../data/interest3d'
import { INTEREST_CATS, INTEREST_SUBS, categoriesOf, migrateInterests, migrateSubId, subOf } from '../data/interests'
import { CATEGORIES, MEETUPS, USERS, categoryOf } from '../data/mock'
import { FX_COLORS, FX_STYLE } from '../data/interestFx'
import { MOOD_NAMES } from '../data/myBurrow'
import { BLOCK_COLORS, planRoom } from '../data/roomPlan'
import { QUESTIONS, questionOf } from '../data/questions'
import { DEFAULT_WALLPAPER, wallpaperForCategory } from '../data/wallpapers'
import { GUEST_ROOMS } from '../data/guestRooms'
import { BIG_INTERESTS, getPosts } from '../data/boardStore'
import { getMeetupState } from '../data/meetupStore'
import { GLYPH_NAMES } from '../three/interestFx/icons'
import legacyRaw from './fixtures/interest_catalog_v2.json' // 3D 핸드오프 v3 docs/interest_catalog.json 사본 (frontend/ 밖을 읽지 않게)

/** 사용자가 2026-11-18 에 준 목록 그대로 */
const USER_LIST = `
🍽️ 음식·음료 (7) │ 맛집탐방, 카페/커피, 주류/와인/위스키, 다이어트/건강식, 요리/레시피, 베이킹/디저트, 차/다도
🏃 스포츠 (11) │ 헬스/필라테스/요가, 러닝/마라톤, 클라이밍, 축구, 야구, 농구/배구/구기, 탁구/테니스/배드민턴, 당구/포켓볼/볼링, 스키/보드, 격투기/무술, 수상레저
🎬 문화생활 (7) │ 영화, 드라마/예능, 애니메이션, 콘서트/페스티벌, 미술관/전시, 연극/뮤지컬, 사주/타로
🎮 게임 (8) │ PC게임, 모바일게임, 보드게임, 방탈출/추리, 콘솔게임, VR/아케이드, 큐브/퍼즐/두뇌, 바둑/장기/체스
🎵 음악·댄스 (11) │ K-POP, 팝송/해외음악, JPOP/OST, 힙합/락, 재즈/클래식, 댄스/무용, 보컬, 기타/베이스/일렉, 피아노/건반, 드럼/관현악기, 작곡/미디/DJ
🏕️ 아웃도어 (6) │ 국내여행, 해외여행, 등산/트레킹, 캠핑/글램핑, 자전거/바이크/드라이브, 낚시
📚 외국어·자기계발 (7) │ 영어, 일본어, 중국어, 스페인어, 기타언어, 금융/투자/재테크, 봉사
📖 책·글 (7) │ 소설, 시/에세이, 웹툰/만화, 웹소설, 시사/경제, 역사/철학/인문, 글쓰기/필사/블로그
📷 사진·영상 (6) │ 스마트폰촬영, 영상제작/편집, 보정/포토샵, 미러리스/DSLR, 필름/컴팩트, 액션캠/드론
🎨 미술·수공예 (7) │ 드로잉/회화, 자수/뜨개/패브릭, 캔들/디퓨저/석고, 가죽/도예/목공, 캘리그라피, 플라워아트, 액세서리/기타
🧸 덕질·수집 (6) │ 굿즈/포토카드, 키링/인형, 다꾸/소품/문구, 피규어, 프라모델/레고, LP/음반
🐾 반려동물·식물 (7) │ 강아지, 고양이, 설치류/소동물, 물고기, 새, 곤충/파충류/기타, 식물/테라리움
`
const PARSED = USER_LIST.trim().split('\n').map((line) => {
  const [head, tail] = line.split('│').map((x) => x.trim())
  const m = /^(\S+)\s+(.+?)\s+\((\d+)\)$/.exec(head)!
  return { emoji: m[1], name: m[2], n: +m[3], subs: tail.split(',').map((x) => x.trim()) }
})

const catIds = INTEREST_CATS.map((c) => c.id)

describe('확정본 목록 그대로 (사용자 문구 · 개수 · 순서)', () => {
  it('대분류 12 · 소분류 90 · 최대 10개', () => {
    expect(PARSED).toHaveLength(12)
    expect(PARSED.reduce((n, c) => n + c.n, 0)).toBe(90)
    expect(INTEREST_CATS).toHaveLength(12)
    expect(INTEREST_SUBS).toHaveLength(90)
    expect(MAX_PICK).toBe(10)
    for (const c of INTEREST_CATS) expect(c.max_pick).toBe(10)
  })
  it('대분류 이름 · 이모지 · 순서가 사용자 목록과 같음', () => {
    expect(INTEREST_CATS.map((c) => c.name_ko)).toEqual(PARSED.map((c) => c.name))
    expect(INTEREST_CATS.map((c) => c.emoji)).toEqual(PARSED.map((c) => c.emoji))
    expect(INTEREST_CATS.map((c) => c.order)).toEqual(INTEREST_CATS.map((_, i) => i + 1))
  })
  it('소분류 이름 · 순서 · 개수가 사용자 목록과 같음 (대분류마다)', () => {
    PARSED.forEach((p, i) => {
      const subs = INTEREST_SUBS.filter((s) => s.category === INTEREST_CATS[i].id).map((s) => s.name_ko)
      expect(subs, p.name).toEqual(p.subs)
      expect(subs.length, p.name).toBe(p.n)
    })
  })
  it('화면용 CATEGORIES(이모지·칩 색·인원수)도 같은 12 · 90', () => {
    expect(CATEGORIES.map((c) => c.name)).toEqual(PARSED.map((c) => c.name))
    expect(CATEGORIES.flatMap((c) => c.tags)).toHaveLength(90)
  })
})

describe('id (백엔드 enum 후보)', () => {
  it('영어 소문자 · 숫자 · 밑줄만', () => {
    for (const id of [...catIds, ...INTEREST_SUBS.map((s) => s.id)]) expect(id, id).toMatch(/^[a-z][a-z0-9_]*$/)
  })
  it('대분류 id · 소분류 id · 소분류 이름이 겹치지 않음 (subOf 가 id 와 이름 둘 다로 찾음)', () => {
    expect(new Set(catIds).size).toBe(12)
    expect(new Set(INTEREST_SUBS.map((s) => s.id)).size).toBe(90)
    expect(new Set(INTEREST_SUBS.map((s) => s.name_ko)).size).toBe(90)
    for (const s of INTEREST_SUBS) {
      expect(subOf(s.id)).toBe(s)
      expect(subOf(s.name_ko)).toBe(s)
    }
  })
  it('모든 소분류는 있는 대분류에 속하고, 대분류마다 소분류가 하나 이상', () => {
    for (const s of INTEREST_SUBS) expect(catIds, s.id).toContain(s.category)
    for (const c of TAG_TREE) expect(c.subs.length, c.id).toBeGreaterThan(0)
  })
})

describe('대분류마다 빠짐없이 (새 대분류를 더하면 여기서 알려 줌)', () => {
  it('3D 가구 연결 · 이펙트 색 · 입자 · 글리프 · 땅굴 무드 이름 · 블록 색', () => {
    for (const id of catIds) {
      expect(CATEGORY_3D[id], `${id} 3D`).toBeDefined()
      expect(FX_COLORS[id], `${id} 색`).toMatch(/^#[0-9A-F]{6}$/i)
      expect(FX_STYLE[id], `${id} 입자`).toBeTruthy()
      expect(GLYPH_NAMES, `${id} 글리프`).toContain(id)
      expect(MOOD_NAMES[id], `${id} 무드`).toBeTruthy()
      expect(BLOCK_COLORS[id], `${id} 블록 색`).toBeTruthy()
    }
    // 예전 대분류 id 만 남은 표가 없음
    for (const m of [CATEGORY_3D, FX_COLORS, FX_STYLE, MOOD_NAMES, BLOCK_COLORS]) expect(Object.keys(m).sort()).toEqual([...catIds].sort())
  })
  it('대분류마다 관심사 질문이 있음 · 질문 id 가 겹치지 않음', () => {
    for (const id of catIds) expect(QUESTIONS.filter((q) => q.category === id).length, id).toBeGreaterThanOrEqual(2)
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length)
  })
  it('예전 질문 id(내 답변에 저장된 값)도 찾아짐', () => {
    for (const id of ['music-1', 'photo-1', 'nature-1', 'pet-1', 'game-1', 'craft-1', 'book-1', 'outdoor-1', 'tea_coffee-1', 'movie-2', 'outdoor-2', 'science-2']) {
      expect(questionOf(id), id).toBeDefined()
    }
  })
  it('입자 모양 12개가 서로 다름', () => {
    expect(new Set(Object.values(FX_STYLE)).size).toBe(12)
  })
})

describe('3D 가구 · 소품 연결 (data/interest3d.ts)', () => {
  it('대분류마다 3D 세트(kit, 벽지 · 블록 색)가 있음. 대분류 가구 · 소분류 소품 표는 v3.8 에서 비움(모델은 data/interestWords.ts)', () => {
    for (const c of INTEREST_CATS) {
      expect(c.kit, c.id).toBeTruthy()
      expect(c.furniture, c.id).toEqual([])
    }
    expect(Object.keys(SUB_PROP)).toEqual([])
    for (const s of INTEREST_SUBS) expect(s.prop, s.id).toBeNull()
  })
  it('소분류 하나를 고르면 모델 하나가 놓임 (v3.8). 두 대분류를 같이 골라도 그대로', () => {
    const p = planRoom(['러닝/마라톤', '캠핑/글램핑'])
    expect(p.items).toHaveLength(2)
    expect(p.items.map((it) => it.sub).sort()).toEqual(['camping', 'running'])
    expect(p.categories).toEqual(['sports', 'outdoor'])
    expect(p.items.map((it) => it.category).sort()).toEqual(['outdoor', 'sports'])
  })
  it('"/"로 묶인 소분류는 첫 단어의 모델 (카페/커피 → 카페 = 에스프레소 머신), 고른 단어가 있으면 그 단어', () => {
    expect(planRoom(['카페/커피']).items[0].row.node).toBe('espresso_machine')
    expect(planRoom(['카페/커피'], { cafe_coffee: '커피' }).items[0].row.node).toBe('drip_kettle')
  })
  it('반려동물 소분류는 용품 + 짝 동물 두 개가 같은 시각에 놓임', () => {
    const p = planRoom(['강아지'])
    expect(p.items.map((it) => it.row.type).sort()).toEqual(['pet', 'sub_prop'])
    expect(new Set(p.items.map((it) => it.start)).size).toBe(1)
  })
  it('벽지는 대분류의 3D 세트로 (반려동물·식물 = 숲, 음식·음료 = 체크, 스포츠 = 기본)', () => {
    expect(wallpaperForCategory('pet_plant')).toBe(wallpaperForCategory('nature'))
    expect(wallpaperForCategory('food')).toBe(wallpaperForCategory('tea_coffee'))
    expect(wallpaperForCategory('food')).not.toBe(DEFAULT_WALLPAPER)
    expect(wallpaperForCategory('sports')).toBe(DEFAULT_WALLPAPER)
  })
})

describe('예전 관심사 v2 → 확정본 옮기기 (저장소에 남은 값)', () => {
  const legacy = (legacyRaw as unknown as { type: string; id: string; name_ko: string }[]).filter((r) => r.type === 'sub')
  it('예전 세부 관심사 65개를 모두 적음 (id · 이름이 예전 카탈로그와 같음)', () => {
    expect(LEGACY_SUBS).toHaveLength(65)
    expect(LEGACY_SUBS.map(([id, name]) => [id, name]).sort()).toEqual(legacy.map((r) => [r.id, r.name_ko]).sort())
  })
  it('옮길 곳은 모두 있는 소분류 (없으면 null = 버림)', () => {
    for (const [, , next] of LEGACY_SUBS) if (next) expect(subOf(next), next).toBeDefined()
    for (const next of Object.values(LEGACY_CATEGORIES)) if (next) expect(catIds).toContain(next)
  })
  it('예전 이름 · id 를 섞어도 새 이름으로, 순서 유지 · 합쳐지면 한 번 · 버린 것은 뺌', () => {
    expect(migrateInterests(['캠핑', '레트로게임', 'tea_ceremony', '홍차', '운석수집', '고양이', 7, '모르는 것'])).toEqual(['캠핑/글램핑', '콘솔게임', '차/다도', '고양이'])
    expect(migrateSubId('camping')).toBe('camping')
    expect(migrateSubId('시티팝')).toBe('jpop_ost')
    expect(migrateSubId('ham_radio')).toBeNull()
  })
  it('새 이름 목록은 그대로', () => {
    const now = USERS.me.interests
    expect(migrateInterests(now)).toEqual(now)
  })
})

describe('목 데이터가 모두 확정본 이름을 씀', () => {
  const known = (x: string) => !!subOf(x)
  it('사람(USERS) · 견본 방 관심사는 모두 소분류 이름', () => {
    for (const u of Object.values(USERS)) for (const i of u.interests) expect(known(i), `${u.id}: ${i}`).toBe(true)
    for (const r of GUEST_ROOMS) for (const i of r.interests) expect(known(i), `${r.id}: ${i}`).toBe(true)
  })
  it('모임 카테고리는 모임 전용 6개(관심사 아님)', () => {
    for (const m of [...MEETUPS, ...getMeetupState().list]) {
      expect(isMeetupCategory(m.category), `${m.id}: ${m.category}`).toBe(true)
      expect(m, m.id).not.toHaveProperty('tags') // 모임 관심사 태그 없음 (명세 07)
    }
  })
  it('게시글 관심사 태그는 대분류 이름 12개 중에서', () => {
    expect(BIG_INTERESTS).toEqual(PARSED.map((c) => c.name))
    for (const p of getPosts()) for (const t of p.interests) expect(BIG_INTERESTS, `${p.id}: ${t}`).toContain(t)
  })
  it('예린 데모: 나와 3개 겹침 · 가장 드문 관심사 차/다도 · 고양이', () => {
    const shared = USERS.yerin.interests.filter((i) => USERS.me.interests.includes(i))
    expect(shared).toEqual(['캠핑/글램핑', '드로잉/회화', '콘솔게임'])
    expect(USERS.yerin.interests).toContain('고양이')
    const counts = USERS.yerin.interests.map((i) => CATEGORIES.flatMap((c) => c.tags).find((t) => t.name === i)!.count)
    expect(Math.min(...counts)).toBe(190)
    expect(categoryOf('차/다도')?.id).toBe('food')
  })
  it('내 땅굴 · 랜딩 땅굴은 예전과 같은 3D 세트(가구가 그대로)', () => {
    expect(categoriesOf(USERS.me.interests).map((c) => INTEREST_CATS.find((x) => x.id === c)!.kit))
      .toEqual(['outdoor', 'game', 'book', 'music', 'craft', 'photo', 'movie', 'tea_coffee'])
  })
})
