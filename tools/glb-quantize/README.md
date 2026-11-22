# glb 양자화 변환 (액세서리 등 텍스처 없는 glb)

`node convert.mjs <원본.glb> <결과.glb>` — `@gltf-transform/core · extensions · functions` 의 `quantize()` 만 적용.
이 폴더에는 package.json 이 없음: 임시 폴더에서 `npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer` 한 뒤 복사해서 실행.
(`gltf-transform` CLI 는 이 PC 의 sharp 가 안 돼서 스크립트로 함. 텍스처가 있는 glb 는 따로 WebP 변환 필요, docs/3d-handoff-v2-integration.md)
검증: v1.1 `accessories_v1.glb` 를 넣으면 기존 `accessories.glb` 와 바이트 수가 같음(1,054,640).
