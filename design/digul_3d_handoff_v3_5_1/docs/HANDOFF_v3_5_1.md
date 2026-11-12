# 디굴디굴 3D 전달 v3.5.1 — 벽지용 shell v3

`models/room_shell_v3_draco_webp.glb`(0.35MB, 웹 권장) / `room_shell_v3.glb`(7.5MB, 원본). v2(0.20MB / 4.0MB)와 노드·메시 이름 동일. 벽지 타일·연결표는 v3.5 zip의 `wallpapers/`.

> **v3.5의 (B) 셰이더 방식은 폐기. 이 문서 기준으로 적용한다.** (v3.5의 `HANDOFF_v3_5.md`는 이번 zip에서 뺐다.) `wallpaper_03_flower`, `wallpaper_07_forest`는 무늬가 큰 새 타일로 교체됐고 `wallpapers.json`의 평균 색은 8장 모두 다시 계산했다(이전 값은 틀렸으니 이번 json으로 교체).

**개발이 할 일 (5줄)**
1. `room_dome`의 재질 `wall_inner`(안쪽 면)에만 벽지를 적용하고, `wall_outer`(바깥·두께 면)와 다른 노드는 그대로 둔다. 01 기본은 타일 이미지 대신 **단색 `#F0B47A`**를 쓴다(`map` 없이 `color = #F0B47A`, 또는 단색 타일. 4번의 "단색 `#F0B47A` 타일이면 v2 렌더와 같다"와 같은 뜻).
2. 타일: `colorSpace=SRGB`, `wrapS=wrapT=RepeatWrapping`, **`tile.channel = 1`**(두 번째 UV `wall_uv`, N=1 기준), `tile.repeat.set(N, N)` — N은 4~6.
3. 음영 맵은 `wall_inner`의 emissiveTexture(`T_room_wall_shade`, UV0, 값 = 음영÷4)다. `lightMap = emissiveMap; emissiveMap = null; lightMap.channel = 0; lightMapIntensity = 4`.
4. 재질은 `new MeshBasicMaterial({ map: tile, lightMap })` — 결과 = 타일 × 음영. 단색 `#F0B47A` 타일이면 v2 렌더와 같다(Blender 확인: 평균 오차 0.00007/1, 최대 2/255). 밝기가 어긋나면 three 버전의 lightMap 계수(π)를 확인.
5. v3.5의 (B) 셰이더 계산법(`타일 × 구운 텍스처 × 8 ÷ 벽색`)과 "wall_uv 필요" 안내는 **필요 없어졌다**(음영 맵·`wall_uv`가 파일에 들어 있음).

참고: `wall_uv`는 `u = 방위각/2π`, `v = 자오선 길이/(2π×바닥 반지름)`(안쪽 면 기준 6.23m / 3.25m)이라 `repeat (N,N)`이면 바닥 링에서 정사각형. 위쪽은 둘레가 줄어 무늬가 가로로 모인다(v3.5 보고 그대로). `wall_inner`에 흰색 자리표시 텍스처(`T_wallpaper_placeholder`)가 baseColor로 들어 있으니 `map`으로 교체하면 된다. 확인 렌더: `renders/shell_v3/`.
