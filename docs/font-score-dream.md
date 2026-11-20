# S-Core Dream 폰트를 프로젝트에 넣기 (2026-11-20)

## 요청
> 다음 할 일은 S-Core Dream 폰트 파일을 프로젝트에 넣는 거야. styles/tokens.css에 --font-text 토큰을 이미 만들어 뒀어 (지금은 설치된 폰트에만 기대는 상태). 쓰는 굵기는 5 Medium, 6 Bold. 폰트 파일은 내가 받아서 줄게. 새 브랜치에서 작업하고, 커밋은 내가 확인한 다음에 할게.

## 결론
- **OTF 원본 그대로 번들에 넣음** (woff2 변환·서브셋 안 함. 2026-11-20 사용자가 라이선스 원문을 확인하고 확정). 받은 파일 `S-Core_Dream_OTF/SCDream5.otf`·`SCDream6.otf`를 `app/src/assets/fonts/`에 복사, 원본과 sha256 같음 (빌드 결과 `dist/assets/SCDream*.otf`도 같음)
- 이유: 받은 라이선스 안내(`app/src/assets/fonts/LICENSE-S-Core-Dream.png`) **3항 "폰트 파일을 수정·판매할 수 없으며 배포되는 파일 형태 그대로 사용"**. woff2 변환·서브셋이 "수정"인지 불분명해서 보수적으로 원본 유지. 2·4항은 무료·재배포·다른 소프트웨어에 번들 가능(안내를 같이 포함하거나 출처 표기). 그래서 안내 파일을 같은 폴더에 둠
- 굵기: 5 Medium = **500**, 6 Bold = **600**. 폰트 자체 표기(OS/2 usWeightClass)가 각각 500·600이고 7 ExtraBold 가 700. `bold`(700) 요청은 가장 가까운 6 Bold 로, 400 은 5 Medium 으로 연결되고 가짜 굵게는 안 생김 (브라우저에서 확인)
- 바뀐 것: `styles/fonts.css`(새, `@font-face` 2개, `font-display: swap`) · `main.tsx`에서 import · `tokens.css` 주석 · `assets/fonts/README.md`(수정 금지 안내)
- 확인: tsc · vitest 267 · vite build · 스모크(/start · /look, SwiftShader) 통과. 헤드리스 크롬에서 랜딩을 열어 500·600 모두 `loaded`, OTF 응답 200 `font/otf`, 본문 `.copy p` 가 `"S-Core Dream", "Pretendard Variable"…` 500 으로 적용. 폰트 글리프가 없는 문자는 뒤의 Pretendard 로 보임

## 다음 단계 · 확인할 것
1. **공유 빌드·아티팩트 게시**: `scripts/share-page.mjs`는 파일 형식을 따로 정하지 않음. `.otf`는 Artifact publish 때 `contentType: "font/otf"`를 직접 줘야 할 수 있음. **아티팩트(특히 공개 공유)가 otf를 받아 주는지는 아직 시험 안 함** (woff2·glb는 통과했던 것). 시험판에 올릴 때 확인하고, 막히면 woff2 변환이 가능한지 S-Core 라이선스 해석 확인이 먼저
2. **용량**: OTF 2개가 약 1.5MB(732KB + 743KB)로 Pretendard 서브셋보다 큼. 글꼴은 그 굵기를 쓰는 글자가 화면에 나올 때만 받음(6 Bold는 지금 쓰는 곳이 없어 안 받음). `font-display: swap`이라 느린 망에서는 처음 잠깐 Pretendard 로 보였다가 바뀜 → 거슬리면 preload 검토
3. **6 Bold 사용처**: `--font-text`를 쓰는 곳은 아직 랜딩 본문(`Start.module.css`, 500) 한 군데. **사용자 확정: 6 Bold(600)는 Figma의 라벨(닉네임 · 자기소개 · 관심사)에 쓸 예정.** 그 화면에 적용할 때 `font-family: var(--font-text); font-weight: 600`으로
4. **출처 표기 (4항 권장)**: **사용자 확정: 설정 크레딧에는 따로 안 넣음.** 4항대로 라이선스 안내 파일(`assets/fonts/LICENSE-S-Core-Dream.png`)을 같은 폴더에 포함했으므로 충분
5. 나머지 굵기(1~4, 7~9)는 안 넣음. 쓰게 되면 같은 폴더에 원본 그대로 추가하고 `fonts.css`에 굵기 값을 폰트 표기대로 (1=100 … 9=900)
