# 관심사 v3.8 4~5단계: 낙하 확인 · 꾸미기 소품 탭 (2026-11-21)

- 브랜치 `feat/room-interest-v3-8` (push 안 함). 앞 단계: [step3](room-interest-v3-8-step3.md)
- 요청: "4단계 낙하(새로 고른 관심사의 가구가 drop_by_height · pop 으로 spec 그대로 떨어지게) → 5단계 소품 탭(Figma 711:7994 모양)"

## 4단계. 낙하

### 결론
- **낙하는 2단계에서 이미 새 규칙으로 연결돼 있어서 코드를 고치지 않았다.** `planRoom` 이 소분류마다 놓인 자리의 낙하 값(바닥 공용은 모델 키 이상인 첫 `drop_by_height` 줄, 선반·벽·동물은 슬롯 `drop` = pop)을 `PlannedItem.slot.drop` 에 복사하고, `roomScene.stepDrops` 가 그 값으로 `furnitureDrop(t, H, S, mode)` 를 부른다
- **관심사를 새로 고르면** 내 정보 수정 저장 → 내 땅굴 `interests` 가 바뀜 → `RoomCanvas` deps 가 바뀌어 장면을 새로 만듦 → 천장 구멍 → 두더지 낙하 → 가구 낙하 시간표(앞 단계 규칙: 부피 큰 것부터 0.12초 간격, 마지막 시작 1.0초 안)가 처음부터 다시 돈다. **새로 고른 것만 떨어지는 게 아니라 방 전체가 다시 떨어진다**(예전 방식 그대로, 기획 확인 필요: 새 관심사의 가구만 떨어뜨릴지)
- 곡선·시간·먼지는 spec 숫자 그대로(`three/furnitureDrop.ts`): 0.30초 낙하(H 2.0/1.6/1.2, S 오프셋), t=0.30 착지·먼지, 찌그러짐 t=0.34 세로 0.80 · 가로 1.10, 튕김 0.40~0.52 최고 0.15m, 0.60 안착. pop 은 0.22초에 1.08배 · 0.36초 세로 0.90 · 가로 1.05 · 0.60 안착, 위치 이동 없음
- 캡처: `_shots/v38/4-drop-a~d.png`(커밋 안 함). 두더지가 구멍에서 떨어지는 중간 장면(b)과 착지 뒤(c)

### 테스트
- `tests/furniture-drop.test.ts` 새로: 곡선 값(spec 2번 표 · 코드), 90개 소분류 단어 전부 `planRoom` 의 낙하 값(fall 이면 H 있음, 선반·벽·동물은 pop), 시작 시각 간격, 단어를 바꾸면 계획이 바뀜

## 5단계. 꾸미기 소품 탭 (Figma 711:7994 모양)

### 한 것
- **탭 글자 "가구" → "소품"** (탭 값은 `'furniture'` 그대로 둠 → `MyBurrow.tsx` 를 안 건드림). 탭 순서는 소품 · 색 · 두더지(색은 개발 실험 탭 유지)
- **칩** = 내 관심사 중 단어를 고를 수 있는 것만(`wordChoices(subId)` 비어 있지 않음, 90개 중 57개). 한 단어 관심사는 소품이 고정이라 안 나옴. 고를 게 없으면 "고를 수 있는 소품이 없어요" 안내
- **제목** "헬스/필라테스/요가 소품 고르기 · 3개 중 1개", **후보 카드** = 단어마다 모델 1개(썸네일 + 모델 이름), 처음 값 = 첫 단어("기본" 표시), 고르면 ✓ 선택 테두리. 꾸미기를 열면 첫 칩이 선택돼 방에서 그 소품에 점선 + "관심사 · 소품 이름"
- 모양은 2026-11-12 에 Figma 711:7994 로 맞춰 둔 기존 CSS(`Burrow.module.css` `furnCats` `furnHead` `furnGrid` `furnCard` `furnCardOn`)를 그대로 씀. 대조한 Figma 캡처 `design/figma/screens-2026-11-12/burrow-decorate-furniture.png` 와 패널 폭·칩·제목 줄·카드 크기(3열)·선택 테두리·아래 취소/저장하기가 같음. **Figma MCP 는 호출하지 않음**(한도가 적고, 같은 프레임을 이미 받아 둠). 달라진 것은 안내 문구와 칩 글자뿐
- **고르면 방에 바로 반영** (`three/roomScene.ts applyFurniture` 다시 씀): 예전은 모델만 바꿔 끼웠는데 v3.8 은 단어에 따라 자리 종류가 달라진다(캠핑 의자 = 바닥, 캠핑 랜턴 = 선반). 그래서 새 선택으로 `planRoom` 을 다시 계산해 지금 방과 견주고(슬롯 이름 + 모델), **빠질 것은 빼고 새로 놓을 것만 `addItem` 으로 놓음**. 새로 놓인 것은 방 전체 낙하와 상관없이 **제자리 등장(pop, 0.60초, 슬롯 먼지 값)**. 발자리(`itemFeet`)·칠하기 등록(`styler.unregister`/`register`)·배경 다시 굽기도 같이 갱신. 가구를 다 놓기 전에 온 선택은 `pendingChoice` 로 미뤘다가 적용
- **저장하기**는 기존 `MyBurrow.saveDecor` 가 `setMyFurnChoice` 로 저장(값은 소분류 id → 단어. 이전엔 가구 id 였음). 다시 열면 `opts.furniture` 로 처음부터 그 선택대로 놓임(캡처로 확인: `{"camping":"글램핑"}` 저장 → 새로고침 → 랜턴이 선반)
- 고른 단어가 자리가 없어 다른 단어로 넘어가면(`placeWords`) 카드 아래에 "지금은 ○○ 소품이 놓일 자리가 없어서 △△ 소품이 놓여요" 안내(기획 확인 받을 것: 이 안내가 필요한지)

### 썸네일
- **지금은 임시 카드**: 대분류 색 바탕에 단어(카페 · 커피 …). 진짜 썸네일은 `app/src/assets/prop-thumbs/<모델 노드>.webp` 를 넣으면 자동으로 씀(`import.meta.glob`, 파일이 없는 것만 임시 카드). glb 로 앱에서 직접 그리지 않은 이유: 128~131개를 방 열 때마다 WebGL 로 그리면 가속 꺼진 PC 에서 멈춤이 생기고, 공유 빌드 크기도 늘어서
- **필요한 썸네일: 단어를 고를 수 있는 57개 소분류의 모델 131개** (한 단어 소분류 33개는 고정이라 카드가 안 나옴). 정사각 256×256 투명 배경 WebP, 파일 이름 = 모델 노드 이름. 목록은 `interest_words_v3_8.json` 에서 `words.length > 1` 인 소분류의 `words[].node`
  ```
  espresso_machine, drip_kettle, beer_set, wine_set, whiskey_set, bathroom_scale, salad_bowl, kitchen_counter, 
  recipe_book, baking_set, cake_stand, tea_tins, tea_bowl_set, dumbbell_tower, gym_ball, yoga_mat, 
  running_shoes, marathon_medal, basketball, volleyball, ball_basket, pingpong_set, tennis_racket, 
  badminton_set, billiard_set, pool_rack, bowling_pin, ski_set, snowboard, boxing_gloves, martial_belt, 
  vhs_tapes, tv, light_stick, festival_band, gallery_rope, art_frame_stand, theater_mask, playbill, saju_book, 
  tarot_set, escape_box, magnifier_lock, vr_headset, arcade, speed_cube, jigsaw_puzzle, sudoku_book, baduk_set, 
  janggi_set, chess_set, vintage_radio, speaker, cassette_walkman, ost_cd, boombox, mini_amp, trumpet, 
  metronome, disco_ball, dance_shoes, guitar, bass_guitar, electric_guitar, piano, mini_synth, snare_drum, 
  violin, music_stand, midi_pad, dj_controller, backpack, trekking_poles, camp_chair, camping_lantern, 
  bike_rack_wall, bike_helmet, toy_car, calculator_ledger, stock_chart, piggy_bank, poetry_book, book_stack, 
  webtoon_phone, comic_stack, newspaper, economy_magazine, old_scroll, bust_statue, bookshelf, typewriter, 
  writing_notebook, laptop_blog, video_camera, editing_monitor, pen_tablet, photoshop_monitor, 
  mirrorless_camera, tripod_camera, film_camera, compact_camera, action_cam, drone, paint_box, easel, 
  embroidery_hoop, yarn_basket, sewing_kit, candle_set, diffuser, plaster_cast, leather_kit, pottery_vase, 
  woodwork_tools, fan_poster, photocard_binder, plush_keyring, teddy_bear, sticker_diary, display_cabinet, 
  stationery_set, gunpla_robot, lego_bricks, record_player, cd_stack, hamster_cage, rabbit_hutch, 
  ant_farm_case, lizard_tank, plant_stand, terrarium_jar
  ```
  (디자이너에게 요청할지, 3D 담당이 glb 에서 한 번에 뽑을지는 확인 필요. 뽑는 스크립트가 필요하면 `tools/` 에 만들 수 있음)

### #3(`try/explore-v3-11`)과 겹침
- `DecorPanel.tsx` · `roomScene.ts` · `roomStyle.ts` · 새 테스트 2개는 #3 이 안 건드리는 파일 → 지금 합쳐도 충돌 없음. **`MyBurrow.tsx` · `RoomView.tsx` 는 안 고침**(탭 값을 그대로 둬서 연결 변경이 필요 없음). "#3 머지 후"로 미룰 것 없음
- 다만 `MyBurrow.tsx` 의 `firstSub`(`defaultFurniture` 로 구함)는 예전 소품 카탈로그를 읽는 낡은 코드. 소품 탭이 열릴 때 `DecorPanel` 이 첫 칩을 `setFocusSub` 로 맞추므로 동작에는 문제가 없고, #3 머지 뒤에 지우면 됨

### 남은 것 (6단계 후보 · 이번엔 안 함)
- 온보딩 4 미리보기의 "관심사 가구 N개" 목록(`Onboarding.tsx`, `interestFurnitureCount` · `defaultFurniture`)이 아직 **옛 소품 카탈로그**를 읽음 → v3.8 방(`planRoom` 의 items)과 개수가 다를 수 있음. 6단계에서 `planRoom` 결과로 바꿀 것
- 백엔드: 소분류마다 고른 단어를 저장할 칸이 없음(F4 문서 "백엔드: 지금 소품 선택을 저장할 곳이 없다"와 같은 질문, 값은 이제 **단어**). `docs/backend/erd-gaps.md` 는 #3 이 고친 파일이라 이번엔 안 적음

### 테스트
- `tests/prop-tab.test.ts` 새로(9개): 칩 57개 · "/" 58개 중 "액세서리/기타"만 고정 · 후보 수 = 단어 수 · 단어마다 모델 이름과 노드 · 57개 × 단어 전부 고르면 방에 그 모델이 놓임 · 처음 값 첫 단어 · 모르는 단어는 첫 단어 · 저장 후 다시 읽음 · 관심사를 빼면 선택 사라짐 · 남이 보는 땅굴에서 후보에 없는 값은 버림
- 전체 301 통과 · 2 todo, `tsc -b` 통과
- 캡처(커밋 안 함) `_shots/v38/`: `5-prop-tab`(소품 탭) · `5-prop-chip-camping` · `5-prop-word-pop`(바꾸는 중) · `5-prop-word-changed`(캠핑 의자 → 랜턴이 선반에) · `5-prop-word-yoga` · `5-save-done` · `5-save-reload`
