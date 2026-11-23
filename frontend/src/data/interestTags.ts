/**
 * 관심사 태그 확정본 (2026-11-18 사용자 확정): 대분류 12 · 소분류 90  → docs/interest-tags-2026-11-18.md
 *
 * 앱의 관심사 분류(무엇이 있고, 이름이 무엇이고, 어느 대분류에 속하는지, 순서)는 이 파일 하나에서 나옴.
 * - id: 영어 소문자(ASCII). 백엔드 enum 후보라 바꾸지 않기 (표: docs/backend/interest-enum.md)
 * - 이름·이모지: 사용자가 준 문구 그대로 (바꾸지 말 것). 화면에 보이는 관심사 값은 소분류 이름
 * - tone: 관심사 칩 배경색 (styles/tokens.css 의 --tone-*). 8가지라 12개 중 넷은 다른 대분류와 같은 색 (멀리 떨어진 것끼리)
 * 이 파일 밖에서 대분류마다 정하는 것: 3D 가구·소품 data/interest3d.ts · 목 인원수 data/mock.ts · 이펙트 색 data/interestFx.ts ·
 * 글리프 three/interestFx/icons.ts · 입자 three/interestFx/roomFx.ts · 질문 data/questions.ts · 땅굴 무드 이름 data/myBurrow.ts
 * (tests/interest-tags.test.ts 가 모든 대분류가 빠짐없이 들어 있는지 봄)
 */
import type { Tone } from './types'

export interface TagCategoryDef {
  id: string
  name: string
  emoji: string
  tone: Tone
  /** [소분류 id, 소분류 이름] (사용자 목록 순서) */
  subs: readonly (readonly [string, string])[]
}

export const TAG_TREE: readonly TagCategoryDef[] = [
  {
    id: 'food', name: '음식·음료', emoji: '🍽️', tone: 'butter',
    subs: [['restaurant_tour', '맛집탐방'], ['cafe_coffee', '카페/커피'], ['liquor', '주류/와인/위스키'], ['healthy_food', '다이어트/건강식'],
      ['cooking', '요리/레시피'], ['baking_dessert', '베이킹/디저트'], ['tea', '차/다도']],
  },
  {
    id: 'sports', name: '스포츠', emoji: '🏃', tone: 'mint',
    subs: [['fitness_yoga', '헬스/필라테스/요가'], ['running', '러닝/마라톤'], ['climbing', '클라이밍'], ['soccer', '축구'], ['baseball', '야구'],
      ['ball_sports', '농구/배구/구기'], ['racket_sports', '탁구/테니스/배드민턴'], ['billiards_bowling', '당구/포켓볼/볼링'], ['ski_board', '스키/보드'],
      ['martial_arts', '격투기/무술'], ['water_sports', '수상레저']],
  },
  {
    id: 'culture', name: '문화생활', emoji: '🎬', tone: 'rose',
    subs: [['movie', '영화'], ['drama_variety', '드라마/예능'], ['animation', '애니메이션'], ['concert_festival', '콘서트/페스티벌'],
      ['exhibition', '미술관/전시'], ['theater_musical', '연극/뮤지컬'], ['fortune_tarot', '사주/타로']],
  },
  {
    id: 'game', name: '게임', emoji: '🎮', tone: 'sky',
    subs: [['pc_game', 'PC게임'], ['mobile_game', '모바일게임'], ['board_game', '보드게임'], ['escape_room', '방탈출/추리'], ['console_game', '콘솔게임'],
      ['vr_arcade', 'VR/아케이드'], ['puzzle_cube', '큐브/퍼즐/두뇌'], ['go_chess', '바둑/장기/체스']],
  },
  {
    id: 'music_dance', name: '음악·댄스', emoji: '🎵', tone: 'lilac',
    subs: [['kpop', 'K-POP'], ['pop_song', '팝송/해외음악'], ['jpop_ost', 'JPOP/OST'], ['hiphop_rock', '힙합/락'], ['jazz_classical', '재즈/클래식'],
      ['dance', '댄스/무용'], ['vocal', '보컬'], ['guitar_bass', '기타/베이스/일렉'], ['piano_keys', '피아노/건반'], ['drums_orchestra', '드럼/관현악기'],
      ['compose_dj', '작곡/미디/DJ']],
  },
  {
    id: 'outdoor', name: '아웃도어', emoji: '🏕️', tone: 'sage',
    subs: [['domestic_travel', '국내여행'], ['overseas_travel', '해외여행'], ['hiking', '등산/트레킹'], ['camping', '캠핑/글램핑'],
      ['cycling_drive', '자전거/바이크/드라이브'], ['fishing', '낚시']],
  },
  {
    id: 'language_selfdev', name: '외국어·자기계발', emoji: '📚', tone: 'sand',
    subs: [['english', '영어'], ['japanese', '일본어'], ['chinese', '중국어'], ['spanish', '스페인어'], ['other_language', '기타언어'],
      ['finance', '금융/투자/재테크'], ['volunteer', '봉사']],
  },
  {
    id: 'book', name: '책·글', emoji: '📖', tone: 'butter',
    subs: [['novel', '소설'], ['poem_essay', '시/에세이'], ['webtoon_comics', '웹툰/만화'], ['web_novel', '웹소설'], ['current_affairs', '시사/경제'],
      ['humanities', '역사/철학/인문'], ['writing', '글쓰기/필사/블로그']],
  },
  {
    id: 'photo_video', name: '사진·영상', emoji: '📷', tone: 'mint',
    subs: [['smartphone_photo', '스마트폰촬영'], ['video_editing', '영상제작/편집'], ['photo_retouch', '보정/포토샵'], ['mirrorless_dslr', '미러리스/DSLR'],
      ['film_compact', '필름/컴팩트'], ['actioncam_drone', '액션캠/드론']],
  },
  {
    id: 'art_craft', name: '미술·수공예', emoji: '🎨', tone: 'clay',
    subs: [['drawing_painting', '드로잉/회화'], ['needlework', '자수/뜨개/패브릭'], ['candle_diffuser', '캔들/디퓨저/석고'], ['leather_pottery_wood', '가죽/도예/목공'],
      ['calligraphy', '캘리그라피'], ['flower_art', '플라워아트'], ['accessory_etc', '액세서리/기타']],
  },
  {
    id: 'fandom_collect', name: '덕질·수집', emoji: '🧸', tone: 'rose',
    subs: [['goods_photocard', '굿즈/포토카드'], ['keyring_doll', '키링/인형'], ['deco_stationery', '다꾸/소품/문구'], ['figure', '피규어'],
      ['plamodel_lego', '프라모델/레고'], ['lp_album', 'LP/음반']],
  },
  {
    id: 'pet_plant', name: '반려동물·식물', emoji: '🐾', tone: 'sage',
    subs: [['dog', '강아지'], ['cat', '고양이'], ['small_animal', '설치류/소동물'], ['fish', '물고기'], ['bird', '새'],
      ['insect_reptile', '곤충/파충류/기타'], ['plant_terrarium', '식물/테라리움']],
  },
]

/** 고를 수 있는 관심사 수 (02 F3 2-5 "최대 10개", 확정본에서도 그대로). 최소 3개는 data/myBurrow MIN_PICK */
export const MAX_PICK = 10

/**
 * 예전 관심사 v2 (3D 핸드오프 v3 interest_catalog.json: 카테고리 11 · 세부 65) → 새 소분류 id.
 * 저장소에 남은 예전 값(이름 또는 id)을 옮길 때만 씀 (data/interests migrateInterests). null = 맞는 새 관심사가 없어 버림.
 * [예전 id, 예전 이름, 새 id]
 */
export const LEGACY_SUBS: readonly (readonly [string, string, string | null])[] = [
  // 음악 → 음악·댄스 (LP수집은 덕질·수집)
  ['city_pop', '시티팝', 'jpop_ost'], ['lp_collecting', 'LP수집', 'lp_album'], ['jazz', '재즈', 'jazz_classical'], ['indie_band', '인디밴드', 'hiphop_rock'],
  ['guitar_play', '기타연주', 'guitar_bass'], ['synth_compose', '신스·작곡', 'compose_dj'], ['piano', '피아노', 'piano_keys'], ['drums', '드럼', 'drums_orchestra'],
  ['oldies', '올드팝', 'pop_song'],
  // 사진 → 사진·영상
  ['film_camera', '필름카메라', 'film_compact'], ['photo_walk', '사진산책', 'mirrorless_dslr'],
  // 자연·식물 → 반려동물·식물
  ['terrarium', '테라리움', 'plant_terrarium'], ['houseplants', '식물키우기', 'plant_terrarium'], ['tropical_fish', '열대어', 'fish'],
  ['bonsai', '분재', 'plant_terrarium'], ['succulents', '다육식물', 'plant_terrarium'], ['mushroom_grow', '버섯재배', 'plant_terrarium'],
  // 게임·놀이 → 게임 (피규어·건프라는 덕질·수집, 마술은 연극/뮤지컬)
  ['retro_game', '레트로게임', 'console_game'], ['mech_keyboard', '기계식키보드', 'pc_game'], ['figures', '피규어', 'figure'], ['board_game', '보드게임', 'board_game'],
  ['pc_build', 'PC조립', 'pc_game'], ['arcade', '아케이드', 'vr_arcade'], ['gunpla', '건프라', 'plamodel_lego'], ['chess', '체스', 'go_chess'],
  ['speed_cube', '스피드큐브', 'puzzle_cube'], ['magic', '마술', 'theater_musical'],
  // 공예·만들기 → 미술·수공예 (철도모형은 프라모델/레고)
  ['knitting', '뜨개질', 'needlework'], ['watercolor', '수채화', 'drawing_painting'], ['pottery', '도자기', 'leather_pottery_wood'], ['embroidery', '자수', 'needlework'],
  ['sewing', '재봉', 'needlework'], ['model_railway', '철도모형', 'plamodel_lego'],
  // 책·글
  ['sf_novel', 'SF소설', 'novel'], ['poetry', '시집', 'poem_essay'], ['transcription', '필사', 'writing'], ['typewriter', '타자기', 'writing'],
  // 우주·과학: 새 목록에 대분류가 없음. 뜻이 이어지는 것만 옮기고 나머지는 버림
  ['stargazing', '천체관측', null], ['constellations', '별자리', null], ['fossils', '화석수집', null], ['minerals', '광물수집', null],
  ['map_globe', '지도·지구본', 'overseas_travel'], ['ham_radio', '아마추어무선', null], ['meteorites', '운석수집', null],
  ['insect_specimens', '곤충표본', 'insect_reptile'], ['dinosaurs', '공룡', 'figure'],
  // 차·커피·베이킹 → 음식·음료
  ['black_tea', '홍차', 'tea'], ['hand_drip', '핸드드립', 'cafe_coffee'], ['baking', '베이킹', 'baking_dessert'], ['espresso', '에스프레소', 'cafe_coffee'],
  ['tea_ceremony', '다도', 'tea'],
  // 운동·아웃도어 → 스포츠 / 아웃도어 (스케이트보드는 가까운 스키/보드)
  ['camping', '캠핑', 'camping'], ['cycling', '자전거', 'cycling_drive'], ['climbing', '클라이밍', 'climbing'], ['yoga', '요가', 'fitness_yoga'],
  ['skateboard', '스케이트보드', 'ski_board'],
  // 영화·애니 → 문화생활 (만화책은 책·글 웹툰/만화)
  ['classic_film', '고전영화', 'movie'], ['animation', '애니메이션', 'animation'], ['comics', '만화책', 'webtoon_comics'], ['vhs', 'VHS수집', 'movie'],
  // 반려동물 → 반려동물·식물
  ['cat', '고양이', 'cat'], ['dog', '강아지', 'dog'], ['parrot', '앵무새', 'bird'], ['lizard', '도마뱀', 'insect_reptile'], ['ant_farm', '개미사육', 'insect_reptile'],
]

/** 예전 대분류 id (관심사 v2) → 새 대분류 id. 우주·과학은 없어짐 */
export const LEGACY_CATEGORIES: Readonly<Record<string, string | null>> = {
  music: 'music_dance', photo: 'photo_video', nature: 'pet_plant', game: 'game', craft: 'art_craft', book: 'book',
  science: null, tea_coffee: 'food', outdoor: 'outdoor', movie: 'culture', pet: 'pet_plant',
}
