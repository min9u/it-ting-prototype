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
  /** 이 대분류의 세부 관심사를 하나라도 고르면 열리는 두더지 전용 액세서리 (interest_catalog accessories 를 새 대분류로 옮김) */
  accessories: string[]
  /** 맞는 세트가 없어 빌려 쓰는 경우 이유 (임시) */
  substitute?: string
}

export const CATEGORY_3D: Readonly<Record<string, Category3D>> = {
  food: { kit: 'tea_coffee', furniture: ['kitchen_counter', 'cafe_stool'], accessories: ['hat_chef', 'prop_cup'] },
  sports: {
    kit: 'outdoor', furniture: ['bike_rack_wall', 'camp_chair'], accessories: ['headband_sport'],
    substitute: '스포츠 가구가 없어 아웃도어 세트(벽걸이 자전거·캠핑 의자)를 같이 씀. 카탈로그의 러닝머신·덤벨 랙은 모델이 없음(unused)',
  },
  culture: { kit: 'movie', furniture: ['tv', 'projector'], accessories: ['glasses_3d'] },
  game: { kit: 'game', furniture: ['arcade', 'bean_bag'], accessories: ['prop_gamepad'] },
  music_dance: { kit: 'music', furniture: ['piano', 'speaker', 'piano_stool'], accessories: ['headphones'] },
  outdoor: { kit: 'outdoor', furniture: ['bike_rack_wall', 'camp_chair'], accessories: ['prop_suitcase', 'hat_straw'] },
  language_selfdev: {
    kit: 'book', furniture: ['bookshelf', 'reading_lamp'], accessories: [],
    substitute: '외국어·자기계발 가구가 없어 책 세트(책장·독서등)를 같이 씀 (공부하는 자리)',
  },
  book: { kit: 'book', furniture: ['bookshelf', 'reading_lamp'], accessories: ['prop_book'] },
  photo_video: { kit: 'photo', furniture: ['photo_board', 'tripod_camera'], accessories: ['camera_neck'] },
  art_craft: { kit: 'craft', furniture: ['easel', 'drawing_stool'], accessories: ['prop_palette', 'hat_beret'] },
  fandom_collect: {
    kit: 'science', furniture: ['mineral_bench'], accessories: [],
    substitute: '덕질·수집 가구가 없어 우주·과학 세트의 광물 진열 벤치만 진열대로 씀 (망원경은 안 씀)',
  },
  pet_plant: { kit: 'nature', furniture: ['plant_stand', 'terrarium_bench'], accessories: ['hat_sprout'] },
}

/**
 * 소분류 → 소품 (카탈로그 sub_prop 행 id). 주석 = 예전 세부 관심사 이름 (임시는 뜻이 가까워 빌린 것)
 * 반려동물 용품(cat_bed 등)을 고르면 짝 동물(slot.paired_pet)도 같이 놓임
 */
export const SUB_PROP: Readonly<Record<string, string | null>> = {
  // 음식·음료
  restaurant_tour: null, cafe_coffee: 'drip_kettle' /* 핸드드립 */, liquor: null, healthy_food: null, cooking: null,
  baking_dessert: 'baking_set' /* 베이킹 */, tea: 'tea_bowl_set' /* 다도 */,
  // 스포츠
  fitness_yoga: 'yoga_mat' /* 요가 */, running: null, climbing: 'chalk_bag' /* 클라이밍 */, soccer: null, baseball: null, ball_sports: null,
  racket_sports: null, billiards_bowling: null, ski_board: 'skateboard' /* 스케이트보드 (임시: 보드) */, martial_arts: null, water_sports: null,
  // 문화생활
  movie: 'popcorn' /* 고전영화 */, drama_variety: 'vhs_tapes' /* VHS수집 (임시: 녹화 테이프) */, animation: 'clapperboard' /* 애니메이션 */,
  concert_festival: null, exhibition: null, theater_musical: 'magic_hat' /* 마술 (임시: 무대 소품) */, fortune_tarot: 'star_chart' /* 별자리 (임시: 별자리 운세) */,
  // 게임
  pc_game: 'mech_keyboard' /* 기계식키보드 */, mobile_game: null, board_game: 'board_game_box' /* 보드게임 */, escape_room: null,
  console_game: 'game_console' /* 레트로게임 */, vr_arcade: 'arcade_stick' /* 아케이드 */, puzzle_cube: 'speed_cube' /* 스피드큐브 */, go_chess: 'chess_set' /* 체스 */,
  // 음악·댄스
  kpop: null, pop_song: 'vintage_radio' /* 올드팝 */, jpop_ost: 'cassette_walkman' /* 시티팝 */, hiphop_rock: 'mini_amp' /* 인디밴드 */,
  jazz_classical: 'trumpet' /* 재즈 */, dance: null, vocal: null, guitar_bass: 'guitar' /* 기타연주 (바닥 자리) */, piano_keys: 'metronome' /* 피아노 */,
  drums_orchestra: 'snare_drum' /* 드럼 */, compose_dj: 'mini_synth' /* 신스·작곡 */,
  // 아웃도어
  domestic_travel: null, overseas_travel: 'globe' /* 지도·지구본 */, hiking: 'binoculars' /* 천체관측 (임시: 쌍안경) */, camping: 'backpack' /* 캠핑 */,
  cycling_drive: 'bike_helmet' /* 자전거 */, fishing: null,
  // 외국어·자기계발: 맞는 소품 없음
  english: null, japanese: null, chinese: null, spanish: null, other_language: null, finance: null, volunteer: null,
  // 책·글
  novel: 'sf_books' /* SF소설 */, poem_essay: 'book_stack' /* 시집 */, webtoon_comics: 'comic_stack' /* 만화책 */, web_novel: null, current_affairs: null,
  humanities: null, writing: 'typewriter' /* 타자기 */,
  // 사진·영상
  smartphone_photo: null, video_editing: null, photo_retouch: null, mirrorless_dslr: 'camera_case' /* 사진산책 */, film_compact: 'film_camera' /* 필름카메라 */,
  actioncam_drone: null,
  // 미술·수공예
  drawing_painting: 'paint_box' /* 수채화 */, needlework: 'yarn_basket' /* 뜨개질 */, candle_diffuser: null, leather_pottery_wood: 'pottery_vase' /* 도자기 */,
  calligraphy: null, flower_art: 'small_pot' /* 다육식물 (임시: 작은 화분) */, accessory_etc: 'sewing_kit' /* 재봉 */,
  // 덕질·수집
  goods_photocard: null, keyring_doll: 'dino_figure' /* 공룡 (임시: 작은 인형) */, deco_stationery: 'writing_notebook' /* 필사 (임시: 다이어리) */,
  figure: 'figure_pair' /* 피규어 */, plamodel_lego: 'gunpla_robot' /* 건프라 */, lp_album: 'record_player' /* LP수집 */,
  // 반려동물·식물
  dog: 'dog_house' /* 강아지 + 짝 동물 */, cat: 'cat_bed' /* 고양이 + 짝 동물 */, small_animal: null, fish: 'fish_bowl' /* 열대어 */,
  bird: 'parrot_perch' /* 앵무새 + 짝 동물 */, insect_reptile: 'lizard_tank' /* 도마뱀 + 짝 동물 */, plant_terrarium: 'terrarium_jar' /* 테라리움 */,
}
