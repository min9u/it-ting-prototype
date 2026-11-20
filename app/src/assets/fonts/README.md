# S-Core Dream (에스코어 드림)

Figma 디자인의 본문 글꼴. `styles/fonts.css`가 `@font-face`로 불러오고, `styles/tokens.css`의 `--font-text`가 씀.

| 파일 | 굵기 이름 | CSS font-weight |
|---|---|---|
| `SCDream5.otf` | 5 Medium | 500 |
| `SCDream6.otf` | 6 Bold | 600 (폰트 자체 표기가 600) |

출처: S-Core 홈페이지에서 받은 `S-Core_Dream_OTF`. 나머지 굵기(1~4, 7~9)는 쓰지 않아서 넣지 않음.

## ⚠️ 이 폴더의 파일은 수정하지 말 것
`LICENSE-S-Core-Dream.png`(받은 라이선스 안내 그대로)의 3항: **"폰트 파일을 수정·판매할 수 없으며 배포되는 파일 형태 그대로 사용해야 합니다."**

- 그래서 woff2 변환, 글자 일부만 뽑는 서브셋(subsetting), 이름·메타데이터 고치기를 하지 않고 **OTF 원본 그대로** 둠 (원본과 sha256 같음)
- 용량이 부담돼 woff2·서브셋으로 줄이고 싶으면 먼저 S-Core 라이선스 해석을 확인할 것
- 다른 소프트웨어에 번들해 재배포하는 건 가능(2·4항). 이 안내 파일을 같이 두는 것이 조건이라 **지우지 말 것**
- 4항: 안내를 넣기 어려우면 출처 표기를 권장 (현재는 이 폴더에 안내 파일을 포함)

자세한 결정 기록: `docs/font-score-dream.md`
