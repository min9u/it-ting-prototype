/// <reference types="next" />

/*
 * 에셋 import 타입. next.config.ts 의 Turbopack 규칙(type: 'asset')과 images.disableStaticImages 때문에
 * 이미지 · glb 를 import 하면 Vite 처럼 파일 주소(문자열)가 온다. 테스트(vitest)도 같은 결과.
 * next-env.d.ts(자동 생성, gitignore) 없이도 `tsc --noEmit` 이 되도록 next 타입을 여기서 참조한다 (import.meta.glob 타입 포함).
 */
declare module '*.glb?url' { const url: string; export default url }
declare module '*.glb' { const url: string; export default url }
declare module '*.png' { const url: string; export default url }
declare module '*.jpg' { const url: string; export default url }
declare module '*.webp' { const url: string; export default url }
declare module '*.svg' { const url: string; export default url }
declare module '*.module.css' { const classes: { readonly [key: string]: string }; export default classes }
declare module '*.css'
