# 두더지 액세서리 (온보딩 꾸미기) — 최종 확정 (2026-11-11)

- 모델: **`models/accessories_v1.glb`** (41개, 1.4MB) + 두더지 **`models/mole_v1_1_draco_webp.glb`** (웹용) / `models/mole_v1_1.glb` (압축 없는 원본)
- 액세서리 glb는 2MB 미만이라 압축본 없음
- 두더지 색은 기본 갈색 하나로 고정 (색 바꾸기 기능 없음)
- 콧수염 3종은 최종에서 **제외** (glb에 없음). `mole_v1_1.glb`에 `socket_mouth`는 남아 있지만 지금은 쓰는 액세서리가 없음
- 작업 기록이 모두 들어 있는 이전 문서: `docs/accessories_v3_working.md` (원작업 폴더에만 있음)

## 1. 부위와 소켓

| 부위(part) | 들어가는 것 | 소켓 이름 | 붙은 뼈 | 위치 (three.js, 발밑 원점, m) |
|---|---|---|---|---|
| head | 모자·머리카락·머리띠·헤드폰·티아라 | `socket_head` | `upper_body` | (0, 1.006, 0.003) 머리 꼭대기 |
| face | 안경·볼 반창고 | `socket_face` | `upper_body` | (0, 0.756, 0.313) 눈 높이 얼굴 표면 |
| neck | 목도리·나비넥타이·목걸이 카메라·등 리본 | `socket_neck` | `lower_body` | (0, 0.370, 0.010) 몸 아래쪽 1/3 높이, 몸 중심축 |
| hand | 손 소품 | `socket_hand_R` | `arm_R` | (-0.385, 0.339, 0.150) 오른 앞발 |

- 소켓은 `mole_v1_1.glb` 안의 빈 노드. 기본 자세에서 회전 없음 (정면 three.js +Z, 위 +Y)
- 액세서리 노드는 glb 안에서 원점이 이미 소켓 위치에 맞춰져 있어서, **소켓의 자식으로 위치·회전·크기 기본값 그대로 붙이기만 하면** 맞음
- 각 액세서리 노드의 `userData`(glTF extras): `socket`, `part`, `label_ko`, `interest`(관심사 전용만)

```js
const mole = (await loader.loadAsync('mole_v1_1_draco_webp.glb')).scene;   // DRACOLoader 필요 (HANDOFF 참고)
const accGltf = await loader.loadAsync('accessories_v1.glb');
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
| **인사 중 손 소품 숨기기** | `mole_greet`(손 흔들기) 재생 동안은 손 소품(hand)을 숨기기. 흔드는 손의 소품이 머리·얼굴 액세서리나 얼굴에 닿음 |
| **풍선은 위로 세우기** | `prop_balloon`, `prop_balloon_star`, `prop_balloon_heart`는 매 프레임 위로 세워 두기 (5번 코드). 안 세우면 줄이 기울어 머리·목도리에 닿음 |
| 허용 (알고만 있기) | `prop_wand_heart` + 목도리 2종: 막대 아래쪽(앞발 안)이 목도리 겉면을 최대 1.2cm 지나감. 앞발 자체가 목도리 높이라 생기는 것이고 화면에서는 막대가 목도리 앞에 보여 허용 |
| 허용 (알고만 있기) | 목 부위(목도리·카메라) + 팔: 팔을 크게 드는 동작(커피·인사·헛발질)에서 팔이 목도리 아랫단을 지나감 (최대 약 4cm) |

- 확인 방법: 다른 부위 2개 조합 전부를 기본 자세 + 동작 20개 전 프레임에서 메시끼리 겹치는지 계산. 위 표 말고는 서 있을 때 겹침 0

## 3. 전체 목록 (41개)

구분: **기본** = 처음부터 / **레벨 잠금** = 레벨이 오르면 열림 (괄호 안 Lv은 제안값) / **관심사 전용** = 온보딩에서 그 관심사를 고르면 열림 (레벨과 상관없음)

### head (18개, `socket_head`)
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
| `headphones` | 헤드폰 | head | 관심사 전용 (음악) |
| `headband_sport` | 땀 밴드 머리띠 | head | 관심사 전용 (운동) |
| `hat_chef` | 요리사 모자 | head | 관심사 전용 (요리) |
| `hat_sprout` | 새싹 | head | 관심사 전용 (식물) |

### face (6개, `socket_face`)
| 이름 | 한글 이름 | 부위 | 구분 |
|---|---|---|---|
| `glasses_round` | 동그란 안경 | face | 기본 |
| `glasses_sun` | 선글라스 | face | 기본 |
| `glasses_heart` | 하트 안경 | face | 레벨 잠금 (Lv.2) |
| `bandage` | 볼 반창고 | face | 레벨 잠금 (Lv.3) |
| `glasses_star` | 별 안경 | face | 레벨 잠금 (Lv.5) |
| `glasses_3d` | 3D 안경 | face | 관심사 전용 (영화) |

### neck (5개, `socket_neck`)
| 이름 | 한글 이름 | 부위 | 구분 |
|---|---|---|---|
| `scarf_stripe` | 줄무늬 목도리 | neck | 기본 |
| `bowtie` | 나비넥타이 | neck | 기본 |
| `scarf_knit` | 니트 목도리 | neck | 레벨 잠금 (Lv.2) |
| `ribbon_back` | 등 리본 | neck | 레벨 잠금 (Lv.7 또는 이벤트, 마법소녀 세트). 뼈 + 흔들림 애니메이션 (6번) |
| `camera_neck` | 목걸이 카메라 | neck | 관심사 전용 (사진) |

### hand (12개, `socket_hand_R`)
| 이름 | 한글 이름 | 부위 | 구분 |
|---|---|---|---|
| `prop_flower` | 꽃 한 송이 | hand | 기본 |
| `prop_cup` | 커피잔 | hand | 기본 (카페 관심사가 생기면 연결 후보) |
| `prop_balloon` | 풍선 | hand | 레벨 잠금 (Lv.3) · 위로 세우기 |
| `prop_candy_star` | 별 막대 사탕 | hand | 레벨 잠금 (Lv.3) |
| `prop_candy_heart` | 하트 막대 사탕 | hand | 레벨 잠금 (Lv.3) |
| `prop_balloon_star` | 별 풍선 | hand | 레벨 잠금 (Lv.5) · 위로 세우기 |
| `prop_balloon_heart` | 하트 풍선 | hand | 레벨 잠금 (Lv.5) · 위로 세우기 |
| `prop_wand_heart` | 하트 요술봉 | hand | 레벨 잠금 (Lv.7 또는 이벤트, 마법소녀 세트) |
| `prop_book` | 작은 책 | hand | 관심사 전용 (독서) |
| `prop_gamepad` | 게임패드 | hand | 관심사 전용 (게임) |
| `prop_palette` | 물감 팔레트 | hand | 관심사 전용 (그림) |
| `prop_suitcase` | 작은 캐리어 | hand | 관심사 전용 (여행) |

### 구분별 개수
| 구분 | 개수 | 내용 |
|---|---|---|
| 기본 | 11 | 부위마다 2개 이상 (head 5, face 2, neck 2, hand 2) |
| 레벨 잠금 | 20 | Lv.2: 5 / Lv.3: 7 / Lv.5: 5 / Lv.7·이벤트(마법소녀 세트 `ribbon_back`, `prop_wand_heart`, `hat_tiara`): 3 |
| 관심사 전용 | 10 | 4번 표 |
| 합계 | **41** | glb 안 루트 노드 41개와 이름·개수 일치 확인 |

- Lv 숫자는 제안값. 기획에 맞게 바꿔도 glb는 그대로
- 색은 모두 팔레트 색. 분홍(하트·리본·티아라 보석)만 두더지 코 색 #E8857A. 요술봉 가운데 보석만 약하게 빛남(emissive)

## 4. 관심사 연결

| 관심사 | 액세서리 | 부위 |
|---|---|---|
| 음악 | `headphones` 헤드폰 | head |
| 운동 | `headband_sport` 땀 밴드 머리띠 | head |
| 요리 | `hat_chef` 요리사 모자 | head |
| 식물 | `hat_sprout` 새싹 | head |
| 영화 | `glasses_3d` 3D 안경 | face |
| 사진 | `camera_neck` 목걸이 카메라 | neck |
| 독서 | `prop_book` 작은 책 | hand |
| 게임 | `prop_gamepad` 게임패드 | hand |
| 그림 | `prop_palette` 물감 팔레트 | hand (`hat_beret`와 같이 쓰면 화가 느낌) |
| 여행 | `prop_suitcase` 작은 캐리어 | hand (`ribbon_back`과 조합 불가) |

- glb extras `interest`에 관심사 이름(한글)이 들어 있음 (이 10개만)
- 이미지: `images/interest_sheet.png`

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
| `accessory_sheet_final.png` | 최종 41개 전부, 부위별 줄 (모든 칸 같은 카메라 거리) |
| `combo_sheet_final.png` | 조합 예시 10개 (모두 겹침 0): 요리사, 시안 기본, 새싹 소풍, 화가, 음악, 왕, 영화관, 게임, 마법소녀 2종 |
| `interest_sheet.png` | 관심사 전용 10개 |
| `magic_set_final.png` | 마법소녀 세트: 리본 정면·뒤·3/4 뒤, 요술봉, 티아라, 리본 + 요술봉, 티아라 + 요술봉 |
| `crown_final.png` | 작은 왕관 정면·3/4 |

- 아이콘: `icons/<이름>.png` 41개 (512px, 투명 배경, 파일 이름 = glb 노드 이름)
