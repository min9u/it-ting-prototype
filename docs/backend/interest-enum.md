# 관심사 분류 코드 (백엔드에 넘길 것, 2026-11-18 확정본)

- 날짜: 2026-11-18
- 근거: 사용자가 확정한 관심사 태그 (대분류 12 · 소분류 90) → [../interest-tags-2026-11-18.md](../interest-tags-2026-11-18.md)
- 프론트 원본: `app/src/data/interestTags.ts` (이 표는 거기서 만든 것. 이름·순서가 바뀌면 그 파일과 이 표를 같이 고침)

## 제안
- ERD 의 `interest_category` · `interest` 는 **기준 데이터(시드 행)**로 두고, 칼럼을 하나씩 더하는 것을 제안: **`code VARCHAR(30) UNIQUE`** (아래 영어 id), `sort_order TINYINT`, `interest_category.emoji VARCHAR(8)`.
  - 프론트는 지금 소분류 **이름**을 값으로 들고 다니고(목 데이터), 방 만들기·잠금 판단은 code 로 바꿔서 씀. 서버 응답에 `id`(BIGINT) · `code` · `name` 이 같이 오면 매핑 표 없이 바로 씀
  - `GET /interest-categories` 응답(`InterestCategoryDto`)에 `code` · `emoji` · `sortOrder` 를 더하면 좋음 ([api-draft.md](api-draft.md) 2.2)
- 길이: 가장 긴 code 20자(`leather_pottery_wood`), 가장 긴 이름 12자(`자전거/바이크/드라이브`) → `code VARCHAR(30)`, `name VARCHAR(20)` 이면 충분
- 이름에 `/` 가 들어감 (예: `카페/커피`). 주소(쿼리)에 넣을 때는 인코딩 필요 (프론트는 이미 `encodeURIComponent`)
- 이름·이모지는 사용자 문구 그대로 ("기타언어"는 붙여 씀, "액세서리/기타"의 "기타"는 '그 밖의 것' 뜻). 바꾸려면 기획 확인
- **최대 10개 · 최소 3개** 는 그대로 (02 F3 2-5, `PUT /me/interests` 400 INTEREST_COUNT)
- 인원수(`memberCount`)는 서버가 셈. 프론트의 숫자는 목(임시)이고 드문 관심사 기준(100 · 250 · 700명, `data/rarity.ts`)은 실제 인원이 생기면 다시 정함
- 예전 관심사 v2(카테고리 11 · 세부 65)는 서버에 저장된 적이 없으므로 서버 쪽 옮기기는 필요 없음. 프론트는 브라우저에 남은 예전 값만 `data/interestTags.ts LEGACY_SUBS` 로 옮김
- 커뮤니티 글 태그(`post_interest`)는 **대분류 이름 12개**, 모임 대표 관심사·태그(`meetup.category`, Q3)는 **소분류**

## 표

| sort_order | code (`interest_category`) | 이름 | 이모지 |
|---|---|---|---|
| 1 | `food` | 음식·음료 | 🍽️ |
| 2 | `sports` | 스포츠 | 🏃 |
| 3 | `culture` | 문화생활 | 🎬 |
| 4 | `game` | 게임 | 🎮 |
| 5 | `music_dance` | 음악·댄스 | 🎵 |
| 6 | `outdoor` | 아웃도어 | 🏕️ |
| 7 | `language_selfdev` | 외국어·자기계발 | 📚 |
| 8 | `book` | 책·글 | 📖 |
| 9 | `photo_video` | 사진·영상 | 📷 |
| 10 | `art_craft` | 미술·수공예 | 🎨 |
| 11 | `fandom_collect` | 덕질·수집 | 🧸 |
| 12 | `pet_plant` | 반려동물·식물 | 🐾 |

| 대분류 code | sort_order | code (`interest`) | 이름 |
|---|---|---|---|
| `food` | 1 | `restaurant_tour` | 맛집탐방 |
| `food` | 2 | `cafe_coffee` | 카페/커피 |
| `food` | 3 | `liquor` | 주류/와인/위스키 |
| `food` | 4 | `healthy_food` | 다이어트/건강식 |
| `food` | 5 | `cooking` | 요리/레시피 |
| `food` | 6 | `baking_dessert` | 베이킹/디저트 |
| `food` | 7 | `tea` | 차/다도 |
| `sports` | 1 | `fitness_yoga` | 헬스/필라테스/요가 |
| `sports` | 2 | `running` | 러닝/마라톤 |
| `sports` | 3 | `climbing` | 클라이밍 |
| `sports` | 4 | `soccer` | 축구 |
| `sports` | 5 | `baseball` | 야구 |
| `sports` | 6 | `ball_sports` | 농구/배구/구기 |
| `sports` | 7 | `racket_sports` | 탁구/테니스/배드민턴 |
| `sports` | 8 | `billiards_bowling` | 당구/포켓볼/볼링 |
| `sports` | 9 | `ski_board` | 스키/보드 |
| `sports` | 10 | `martial_arts` | 격투기/무술 |
| `sports` | 11 | `water_sports` | 수상레저 |
| `culture` | 1 | `movie` | 영화 |
| `culture` | 2 | `drama_variety` | 드라마/예능 |
| `culture` | 3 | `animation` | 애니메이션 |
| `culture` | 4 | `concert_festival` | 콘서트/페스티벌 |
| `culture` | 5 | `exhibition` | 미술관/전시 |
| `culture` | 6 | `theater_musical` | 연극/뮤지컬 |
| `culture` | 7 | `fortune_tarot` | 사주/타로 |
| `game` | 1 | `pc_game` | PC게임 |
| `game` | 2 | `mobile_game` | 모바일게임 |
| `game` | 3 | `board_game` | 보드게임 |
| `game` | 4 | `escape_room` | 방탈출/추리 |
| `game` | 5 | `console_game` | 콘솔게임 |
| `game` | 6 | `vr_arcade` | VR/아케이드 |
| `game` | 7 | `puzzle_cube` | 큐브/퍼즐/두뇌 |
| `game` | 8 | `go_chess` | 바둑/장기/체스 |
| `music_dance` | 1 | `kpop` | K-POP |
| `music_dance` | 2 | `pop_song` | 팝송/해외음악 |
| `music_dance` | 3 | `jpop_ost` | JPOP/OST |
| `music_dance` | 4 | `hiphop_rock` | 힙합/락 |
| `music_dance` | 5 | `jazz_classical` | 재즈/클래식 |
| `music_dance` | 6 | `dance` | 댄스/무용 |
| `music_dance` | 7 | `vocal` | 보컬 |
| `music_dance` | 8 | `guitar_bass` | 기타/베이스/일렉 |
| `music_dance` | 9 | `piano_keys` | 피아노/건반 |
| `music_dance` | 10 | `drums_orchestra` | 드럼/관현악기 |
| `music_dance` | 11 | `compose_dj` | 작곡/미디/DJ |
| `outdoor` | 1 | `domestic_travel` | 국내여행 |
| `outdoor` | 2 | `overseas_travel` | 해외여행 |
| `outdoor` | 3 | `hiking` | 등산/트레킹 |
| `outdoor` | 4 | `camping` | 캠핑/글램핑 |
| `outdoor` | 5 | `cycling_drive` | 자전거/바이크/드라이브 |
| `outdoor` | 6 | `fishing` | 낚시 |
| `language_selfdev` | 1 | `english` | 영어 |
| `language_selfdev` | 2 | `japanese` | 일본어 |
| `language_selfdev` | 3 | `chinese` | 중국어 |
| `language_selfdev` | 4 | `spanish` | 스페인어 |
| `language_selfdev` | 5 | `other_language` | 기타언어 |
| `language_selfdev` | 6 | `finance` | 금융/투자/재테크 |
| `language_selfdev` | 7 | `volunteer` | 봉사 |
| `book` | 1 | `novel` | 소설 |
| `book` | 2 | `poem_essay` | 시/에세이 |
| `book` | 3 | `webtoon_comics` | 웹툰/만화 |
| `book` | 4 | `web_novel` | 웹소설 |
| `book` | 5 | `current_affairs` | 시사/경제 |
| `book` | 6 | `humanities` | 역사/철학/인문 |
| `book` | 7 | `writing` | 글쓰기/필사/블로그 |
| `photo_video` | 1 | `smartphone_photo` | 스마트폰촬영 |
| `photo_video` | 2 | `video_editing` | 영상제작/편집 |
| `photo_video` | 3 | `photo_retouch` | 보정/포토샵 |
| `photo_video` | 4 | `mirrorless_dslr` | 미러리스/DSLR |
| `photo_video` | 5 | `film_compact` | 필름/컴팩트 |
| `photo_video` | 6 | `actioncam_drone` | 액션캠/드론 |
| `art_craft` | 1 | `drawing_painting` | 드로잉/회화 |
| `art_craft` | 2 | `needlework` | 자수/뜨개/패브릭 |
| `art_craft` | 3 | `candle_diffuser` | 캔들/디퓨저/석고 |
| `art_craft` | 4 | `leather_pottery_wood` | 가죽/도예/목공 |
| `art_craft` | 5 | `calligraphy` | 캘리그라피 |
| `art_craft` | 6 | `flower_art` | 플라워아트 |
| `art_craft` | 7 | `accessory_etc` | 액세서리/기타 |
| `fandom_collect` | 1 | `goods_photocard` | 굿즈/포토카드 |
| `fandom_collect` | 2 | `keyring_doll` | 키링/인형 |
| `fandom_collect` | 3 | `deco_stationery` | 다꾸/소품/문구 |
| `fandom_collect` | 4 | `figure` | 피규어 |
| `fandom_collect` | 5 | `plamodel_lego` | 프라모델/레고 |
| `fandom_collect` | 6 | `lp_album` | LP/음반 |
| `pet_plant` | 1 | `dog` | 강아지 |
| `pet_plant` | 2 | `cat` | 고양이 |
| `pet_plant` | 3 | `small_animal` | 설치류/소동물 |
| `pet_plant` | 4 | `fish` | 물고기 |
| `pet_plant` | 5 | `bird` | 새 |
| `pet_plant` | 6 | `insect_reptile` | 곤충/파충류/기타 |
| `pet_plant` | 7 | `plant_terrarium` | 식물/테라리움 |

가장 긴 code 20자 (leather_pottery_wood), 가장 긴 이름 12자 (자전거/바이크/드라이브)
