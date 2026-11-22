/**
 * 관심사(2026-11-18 확정본, data/interestTags.ts) → 땅굴 3D 가구·소품·전용 액세서리 연결표.
 * 표 전체와 판단 이유: docs/interest-tags-2026-11-18.md "3D 가구·소품 연결"
 *
 * 가구 모델은 아직 3D 핸드오프 v3 의 것뿐: "가구 세트" 11종 (furnitureCatalog.json · slots.json 의 category 값
 * music · photo · nature · game · craft · book · science · tea_coffee · outdoor · movie · pet). 새 대분류 12개에 이 세트를 이어 붙임.
 * - 뜻이 맞는 세트는 그대로 (음식·음료 = 차·커피 세트, 문화생활 = 영화 세트, 반려동물·식물 = 자연 세트 + 반려동물 자리 …)
 * - 맞는 세트가 없는 대분류는 가장 가까운 세트를 빌림 (임시, substitute 에 이유):
 *   스포츠 → 아웃도어 세트(아웃도어와 같이 씀), 외국어·자기계발 → 책 세트(책·글과 같이 씀), 덕질·수집 → 과학 세트의 진열 벤치만
 *   두 대분류가 같은 가구를 쓰면 방에는 한 번만 놓임 (먼저 고른 대분류 몫, data/roomPlan.ts)
 * - 소분류 소품은 예전 세부 관심사 65개의 선반 소품 중 뜻이 맞는 것 하나 (소품 하나는 소분류 하나에만). 맞는 게 없으면 null = 소품 없음
 * 디자이너에게 새 세트·소품이 오면 이 표만 바꾸면 됨 (카탈로그 JSON 의 행 id 를 적음)
 */

export interface Category3D {
  /** 벽지·블록 색을 정하는 3D 세트 (카탈로그 category 값) */
  kit: string
  /** 방에 놓을 대분류 가구 (카탈로그 행 id, 첫 번째가 주 가구 = 이펙트 입자를 내는 가구). 자리는 행의 slot.name */
  furniture: string[]
  /** 맞는 세트가 없어 빌려 쓰는 경우 이유 (임시) */
  substitute?: string
}

export const CATEGORY_3D: Readonly<Record<string, Category3D>> = {
  food: { kit: 'tea_coffee', furniture: [] },
  sports: {
    kit: 'outdoor', furniture: [],
    substitute: '스포츠 가구가 없어 아웃도어 세트(벽걸이 자전거·캠핑 의자)를 같이 씀. 카탈로그의 러닝머신·덤벨 랙은 모델이 없음(unused)',
  },
  culture: { kit: 'movie', furniture: [] },
  game: { kit: 'game', furniture: [] },
  music_dance: { kit: 'music', furniture: [] },
  outdoor: { kit: 'outdoor', furniture: [] },
  language_selfdev: {
    kit: 'book', furniture: [],
    substitute: '외국어·자기계발 가구가 없어 책 세트(책장·독서등)를 같이 씀 (공부하는 자리)',
  },
  book: { kit: 'book', furniture: [] },
  photo_video: { kit: 'photo', furniture: [] },
  art_craft: { kit: 'craft', furniture: [] },
  fandom_collect: {
    kit: 'science', furniture: [],
    substitute: '덕질·수집 가구가 없어 우주·과학 세트의 광물 진열 벤치만 진열대로 씀 (망원경은 안 씀)',
  },
  pet_plant: { kit: 'nature', furniture: [] },
}

/**
 * 소분류 → 소품 (카탈로그 sub_prop 행 id). 주석 = 예전 세부 관심사 이름 (임시는 뜻이 가까워 빌린 것)
 * 반려동물 용품(cat_bed 등)을 고르면 짝 동물(slot.paired_pet)도 같이 놓임
 */
export const SUB_PROP: Readonly<Record<string, string | null>> = {}
