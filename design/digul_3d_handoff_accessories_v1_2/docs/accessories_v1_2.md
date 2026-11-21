# 두더지 액세서리 (온보딩 꾸미기) — v1.2 (2026-11-18)

## v1.2에서 바뀐 것 (v1.1 → v1.2)

- **관심사 연결 없음**: 액세서리는 관심사 선택과 별개로 따로 고름. v1.1의 "관심사 전용" 구분을 없애고, 그 10개도 **기본**으로 바꿈
- 새 액세서리 2개 추가 → **41개 → 43개**: `hat_mortarboard` 학사모(head), `prop_lightstick` 응원봉(hand). 둘 다 기본
- 기존 41개 모델은 **그대로** (모양·소켓·좌표 안 바뀜). glb extras에서 `interest`를 지움
- 새 규칙: **채팅방에 4명 이상이면 손 소품 숨기기** (2번 표)
- 소켓·착용 방식·두더지 모델(`mole_v1_2_chat_draco.glb`)은 그대로라서, 채팅방 핸드오프의 `accessories_v1.glb`를 이 파일로 **바꿔 끼우면 됨**

## 0. 파일

- 모델: **`models/accessories_v1_2.glb`** (43개, 1.6MB). 두더지는 안 바뀜 → 기존 **`mole_v1_2_chat_draco.glb`** (웹용) / `mole_v1_2_chat.glb` (압축 없는 원본, 채팅방 핸드오프 zip에 있음)
- 액세서리 glb는 2MB 미만이라 압축본 없음
- 두더지 색은 기본 갈색 하나로 고정 (색 바꾸기 기능 없음)
- 콧수염 3종은 최종에서 **제외** (glb에 없음). `mole_v1_1.glb`에 `socket_mouth`는 남아 있지만 지금은 쓰는 액세서리가 없음
- 작업 기록이 모두 들어 있는 이전 문서: `docs/accessories_v3_working.md` (원작업 폴더에만 있음)

## 1. 부위와 소켓

| 부위(part) | 들어가는 것 | 소켓 이름 | 붙은 뼈 | 위치 (three.js, 발밑 원점, m, 두더지 v1.2 기본 자세에서 잰 값) |
|---|---|---|---|---|
| head | 모자·머리카락·머리띠·헤드폰·티아라·학사모 | `socket_head` | `upper_body` | (0, 0.976, 0.003) 머리 꼭대기 |
| face | 안경·볼 반창고 | `socket_face` | `upper_body` | (0, 0.726, 0.313) 눈 높이 얼굴 표면 |
| neck | 목도리·나비넥타이·목걸이 카메라·등 리본 | `socket_neck` | `lower_body` | (0, 0.340, 0.010) 몸 아래쪽 1/3 높이, 몸 중심축 |
| hand | 손 소품·응원봉 | `socket_hand_R` | `arm_R` | (-0.385, 0.309, 0.150) 오른 앞발 |

- 위 숫자는 참고용. 두더지 v1.2는 v1.1보다 소켓이 3cm 낮은데, 액세서리가 소켓 기준이라 코드는 안 바뀜
- 소켓은 `mole_v1_2_chat.glb` 안의 빈 노드. 기본 자세에서 회전 없음 (정면 three.js +Z, 위 +Y)
- 액세서리 노드는 glb 안에서 원점이 이미 소켓 위치에 맞춰져 있어서, **소켓의 자식으로 위치·회전·크기 기본값 그대로 붙이기만 하면** 맞음
- 각 액세서리 노드의 `userData`(glTF extras): `socket`, `part`, `label_ko`

```js
const mole = (await loader.loadAsync('mole_v1_2_chat_draco.glb')).scene;   // DRACOLoader 필요 (HANDOFF 참고)
const accGltf = await loader.loadAsync('accessories_v1_2.glb');
const acc = accGltf.scene;
function wear(name) {
  const item = acc.getObjectByName(name).clone();          // ribbon_back만 SkeletonUtils.clone (6번)
  mole.getObjectByName(item.userData.socket).add(item);
  return item;
}
```

## 2. 착용 규칙

1. **한 사람당 최대 2개**
2. **같은 부위는 하나만** (head 안에서 모자 + 머리카락도 불가. 머리카락이 모자를 뚫고 나옴)
3. 서로 다른 부위 2개는 자유롭게 조합. 단 아래는 예외

| 규칙 | 내용 |
|---|---|
| **불가 조합** | `ribbon_back` + `prop_suitcase`: 캐리어가 리본 꼬리에 닿고 둘 다 몸 옆을 크게 차지함. 하나를 끼면 다른 하나는 잠금 표시 |
| **채팅방 4명 이상이면 손 소품 숨기기** | 채팅방에 4명 이상 앉으면 모든 손 소품(hand)을 숨기기. 옆 두더지 몸에 박힘 (4명에서 최대 8.4cm, 아래 확인 결과). 2·3명은 겹침 0이라 그대로 보임 |
| **인사 중 손 소품 숨기기** | `mole_greet`(손 흔들기) 재생 동안은 손 소품(hand)을 숨기기. 흔드는 손의 소품이 머리·얼굴 액세서리나 얼굴에 닿음 |
| **풍선은 위로 세우기** | `prop_balloon`, `prop_balloon_star`, `prop_balloon_heart`는 매 프레임 위로 세워 두기 (5번 코드). 안 세우면 줄이 기울어 머리·목도리에 닿음 |
| 허용 (알고만 있기) | `prop_wand_heart` + 목도리 2종: 막대 아래쪽(앞발 안)이 목도리 겉면을 최대 1.2cm 지나감. 앞발 자체가 목도리 높이라 생기는 것이고 화면에서는 막대가 목도리 앞에 보여 허용 |
| 허용 (알고만 있기) | `prop_lightstick` + 목도리 2종: 요술봉과 같은 이유로 막대(앞발 안)가 목도리 겉면을 최대 약 0.8cm 지나감 (요술봉은 1.05cm). 화면에서는 응원봉이 앞에 보여 허용. 등 리본·그 밖의 목·얼굴·머리 액세서리와는 겹침 0 |
| 허용 (알고만 있기) | 목 부위(목도리·카메라) + 팔: 팔을 크게 드는 동작(커피·인사·헛발질)에서 팔이 목도리 아랫단을 지나감 (최대 약 4cm) |

- 확인 방법: 다른 부위 2개 조합 전부를 기본 자세 + 동작 20개 전 프레임에서 메시끼리 겹치는지 계산. 위 표 말고는 서 있을 때 겹침 0
- v1.2 새 2개 확인: 다른 부위 액세서리 53쌍(학사모 × 얼굴·목·손 23개, 응원봉 × 머리·얼굴·목 30개)을 기본 자세 + 동작 5개(대기·걷기·커피·땅 긁기·등 리본 흔들림)에서 계산 → 위 표의 목도리 2종 말고는 **겹침 0**. 두더지 몸과는 동작 21개 전 프레임(2프레임 간격)에서 계산: 학사모는 **겹침 0**(머리에 묻히는 모자 밑부분 제외), 응원봉은 앞발을 쥔 부분 말고 몸과 닿는 곳이 요술봉과 같은 동작(인사·땅굴 들어가기/나오기·엉덩이 씰룩·방에 떨어지기·일어서기)에서만 생김, 그 프레임 수와 깊이는 요술봉 이하(인사 제외). 인사는 위 표대로 손 소품을 숨기니까 영향 없음
- 채팅방 확인 (`chat_room_3d_v3.blend` 기준, 2026-11-18): 자리 16곳(1명 배치 1 + 2명 2 + 3명 3 + 4명 4 + 6명 6) × 앉아 있기·말하기·커피 마시기 전 구간(3프레임 간격)에서 학사모·응원봉과 방 물건(원탁·티팟·찻잔·카펫·방석·바닥·벽·선반·침대 등) 겹침 **0**
- 6명 배치에서 옆 자리 두더지 몸과는: 학사모 **겹침 0**, 응원봉은 앉아 있기 0.6cm / 말하기 1.5cm / 커피 마시기 2.6cm까지 닿음 (최대 깊이). 5명은 5명 전용 자리 배치를 써서 따로 안 쟀지만 4명 이상 숨김 규칙이라 상관없음. 같은 조건에서 요술봉 1.7~1.9cm, 작은 캐리어 4.6cm, 작은 책 5.8cm, 게임패드 7.6cm, 물감 팔레트 9.7cm라서 응원봉이 손 소품 중 가장 덜함. v1.2 전부터 있던 배치 한계라서, **4명 이상이면 손 소품을 숨기기로 정함** (2번 착용 규칙 표)
- 인원별 옆 두더지 몸 접촉 (손 소품, 최대 깊이): 2·3명 전부 **0** / 4명 응원봉 1.2cm, 요술봉 0.6cm, 캐리어 3.0cm, 책 4.0cm, 게임패드 5.8cm, 팔레트 8.4cm / 6명 응원봉 2.6cm, 요술봉 1.9cm, 캐리어 4.6cm, 책 5.8cm, 게임패드 7.6cm, 팔레트 9.7cm

## 3. 전체 목록 (43개)

구분: **기본** = 처음부터 / **레벨 잠금** = 레벨이 오르면 열림 (괄호 안 Lv은 제안값) 

### head (19개, `socket_head`)
| 이름 | 한글 이름 | 부위 | 구분 |
|---|---|---|---|
| `hat_beret` | 베레모 | head | 기본 |
| `hat_beanie` | 비니 | head | 기본 |
| `hat_straw` | 밀짚모자 | head | 기본 |
| `hair_tuft` | 삐죽 머리털 | head | 기본 |
| `hair_thin_1` | 얇은 한 가닥 | head | 기본 |
| `hat_party` | 고깔모자 | head | 레벨 잠금 (Lv.2) |
| `hat_flower_pin` | 꽃 핀 | head | 레벨 잠금 (Lv.2) |
| `hair_curl` | 곱슬 앞머리 | head | 레벨 잠금 (Lv.2) |
| `hair_ponytail` | 꽁지머리 | head | 레벨 잠금 (Lv.3) |
| `hair_ribbon` | 리본 머리핀 | head | 레벨 잠금 (Lv.3) |
| `hair_thin_2` | 얇은 두 가닥 | head | 레벨 잠금 (Lv.3) |
| `hat_crown` | 작은 왕관 | head | 레벨 잠금 (Lv.5) |
| `hair_thin_3` | 얇은 세 가닥 | head | 레벨 잠금 (Lv.5) |
| `hat_tiara` | 하트 티아라 | head | 레벨 잠금 (Lv.7 또는 이벤트, 마법소녀 세트) |
| `headphones` | 헤드폰 | head | 기본 |
| `headband_sport` | 땀 밴드 머리띠 | head | 기본 |
| `hat_chef` | 요리사 모자 | head | 기본 |
| `hat_sprout` | 새싹 | head | 기본 |
| `hat_mortarboard` | 학사모 | head | 기본 · **v1.2 새로** |

### face (6개, `socket_face`)
| 이름 | 한글 이름 | 부위 | 구분 |
|---|---|---|---|
| `glasses_round` | 동그란 안경 | face | 기본 |
| `glasses_sun` | 선글라스 | face | 기본 |
| `glasses_heart` | 하트 안경 | face | 레벨 잠금 (Lv.2) |
| `bandage` | 볼 반창고 | face | 레벨 잠금 (Lv.3) |
| `glasses_star` | 별 안경 | face | 레벨 잠금 (Lv.5) |
| `glasses_3d` | 3D 안경 | face | 기본 |

### neck (5개, `socket_neck`)
| 이름 | 한글 이름 | 부위 | 구분 |
|---|---|---|---|
| `scarf_stripe` | 줄무늬 목도리 | neck | 기본 |
| `bowtie` | 나비넥타이 | neck | 기본 |
| `scarf_knit` | 니트 목도리 | neck | 레벨 잠금 (Lv.2) |
| `ribbon_back` | 등 리본 | neck | 레벨 잠금 (Lv.7 또는 이벤트, 마법소녀 세트). 뼈 + 흔들림 애니메이션 (6번) |
| `camera_neck` | 목걸이 카메라 | neck | 기본 |

### hand (13개, `socket_hand_R`)
| 이름 | 한글 이름 | 부위 | 구분 |
|---|---|---|---|
| `prop_flower` | 꽃 한 송이 | hand | 기본 |
| `prop_cup` | 커피잔 | hand | 기본 |
| `prop_balloon` | 풍선 | hand | 레벨 잠금 (Lv.3) · 위로 세우기 |
| `prop_candy_star` | 별 막대 사탕 | hand | 레벨 잠금 (Lv.3) |
| `prop_candy_heart` | 하트 막대 사탕 | hand | 레벨 잠금 (Lv.3) |
| `prop_balloon_star` | 별 풍선 | hand | 레벨 잠금 (Lv.5) · 위로 세우기 |
| `prop_balloon_heart` | 하트 풍선 | hand | 레벨 잠금 (Lv.5) · 위로 세우기 |
| `prop_wand_heart` | 하트 요술봉 | hand | 레벨 잠금 (Lv.7 또는 이벤트, 마법소녀 세트) |
| `prop_book` | 작은 책 | hand | 기본 |
| `prop_gamepad` | 게임패드 | hand | 기본 |
| `prop_palette` | 물감 팔레트 | hand | 기본 |
| `prop_suitcase` | 작은 캐리어 | hand | 기본 |
| `prop_lightstick` | 응원봉 | hand | 기본 · **v1.2 새로** |

### 구분별 개수
| 구분 | 개수 | 내용 |
|---|---|---|
| 기본 | 23 | head 10, face 3, neck 3, hand 7 (v1.1의 관심사 전용 10개와 새 2개 포함) |
| 레벨 잠금 | 20 | Lv.2: 5 / Lv.3: 7 / Lv.5: 5 / Lv.7·이벤트(마법소녀 세트 `ribbon_back`, `prop_wand_heart`, `hat_tiara`): 3 |
| 합계 | **43** | glb 안 루트 노드 43개와 이름·개수 일치 확인 (v1.2 glb를 다시 불러서 확인) |

- Lv 숫자는 제안값. 기획에 맞게 바꿔도 glb는 그대로
- 색은 모두 팔레트 색. 분홍(하트·리본·티아라 보석)만 두더지 코 색 #E8857A. 요술봉 가운데 보석과 응원봉 구슬(하늘색)만 약하게 빛남(emissive)

## 4. 관심사 연결 — 없음

- 액세서리는 관심사(대분류·소분류) 선택과 별개로 따로 고름
- v1.1의 관심사 전용 10개와 새 2개는 모두 기본 액세서리

## 5. 풍선 위로 세우기 코드

```js
// mixer.update(dt) 다음에, 풍선 3종에만
const qRoot = new THREE.Quaternion(), qSock = new THREE.Quaternion();
mole.getObjectByName('root').getWorldQuaternion(qRoot);
balloon.parent.getWorldQuaternion(qSock);          // socket_hand_R
balloon.quaternion.copy(qSock.invert().multiply(qRoot));
```

## 6. 등 리본 `ribbon_back` (뼈가 있는 액세서리)

- glb 안에서 `ribbon_back`은 뼈(`ribbon_root` → `ribbon_tail_L`, `ribbon_tail_R`)와 SkinnedMesh `ribbon_back_mesh`를 자식으로 가진 노드. **`socket_neck`에 붙이기만 하면 됨**
- 복제는 `SkeletonUtils.clone` (일반 `clone()`은 뼈 연결이 끊김)
- 흔들림 애니메이션 `ribbon_back_sway`: 1초 반복, 꼬리 두 가닥이 몸 세로축 기준 ±6° 흔들림. 고리·매듭은 고정
- 동작에 따라 세기를 바꾸고 싶으면 `timeScale`·`weight`만 조절 (예: 서 있을 때 0.6 / 0.5, 걷기·씰룩 1.2 / 1)

```js
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
const ribbon = SkeletonUtils.clone(acc.getObjectByName('ribbon_back'));
mole.getObjectByName('socket_neck').add(ribbon);
const ribbonMixer = new THREE.AnimationMixer(ribbon);
ribbonMixer.clipAction(THREE.AnimationClip.findByName(accGltf.animations, 'ribbon_back_sway')).play();
// 매 프레임 ribbonMixer.update(dt)
```

- 확인: 꼬리 흔들림 양 끝까지 넣어 동작 20개 전 프레임에서 몸·팔 뚫림 0, 바닥·앉는 자리 뚫림 0

## 7. 온보딩 미리보기

- 두더지는 대기 동작 **`mole_showcase`를 반복 재생** (3.0초 = 72프레임, 24fps, 마지막 프레임 = 첫 프레임이라 끊김 없음)
  - 통통 2번 → 고개 갸웃 + 눈 깜빡 → 엉덩이 씰룩 2번 → 작게 통통
- 회전: 두더지(또는 미리보기 받침)를 Y축으로 **초당 60°, 한 바퀴 6초** (`mole_showcase` 2번 = 한 바퀴)
  ```js
  previewRoot.rotation.y += THREE.MathUtils.degToRad(60) * dt;
  ```
- 참고 영상: `videos/turntable_beret.mp4` (회전 속도·동작 확인용. 영상 속 베레모·목도리는 초기 모양이고, 최종 모양은 `images/accessory_sheet_final.png`)

## 8. 이미지·아이콘

| 파일 (`images/`) | 내용 |
|---|---|
| `accessory_sheet_final.png` | v1.1 최종 41개, 부위별 줄 (v1.2에서는 안 다시 만듦: 학사모·응원봉은 아이콘으로 확인) |
| `combo_sheet_final.png` | 조합 예시 10개 (모두 겹침 0): 요리사, 시안 기본, 새싹 소풍, 화가, 음악, 왕, 영화관, 게임, 마법소녀 2종 |
| `magic_set_final.png` | 마법소녀 세트: 리본 정면·뒤·3/4 뒤, 요술봉, 티아라, 리본 + 요술봉, 티아라 + 요술봉 |
| `crown_final.png` | 작은 왕관 정면·3/4 |

- 아이콘: `icons/<이름>.png` 43개 (512px, 투명 배경, 파일 이름 = glb 노드 이름). v1.2에서 `hat_mortarboard.png`, `prop_lightstick.png` 추가
