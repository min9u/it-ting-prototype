import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// Next.js 기본 린트 설정 (core-web-vitals + typescript). 바꾼 규칙은 아래에 까닭과 함께 (docs/nextjs-migration.md "린트")
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // React Compiler 용 규칙(eslint-plugin-react-hooks 7). 이 프로젝트는 React Compiler 를 쓰지 않고,
      // 3D 화면이 렌더 중 ref 읽기 · effect 안 setState 를 일부러 씀(three.js 장면과 React 상태 잇기). 고칠 곳이 보이게 경고로 둠
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      // 이미지는 import 하면 주소 문자열(next.config.ts images.disableStaticImages)이라 next/image 대신 <img> 를 씀.
      // 3D 정지 그림 · 아이콘은 이미 크기를 맞춘 webp/png 라 Next 이미지 최적화가 필요 없음
      '@next/next/no-img-element': 'off',
    },
  },
  {
    // 스크립트 · 테스트: 조건부 실행 식(a && b()) 을 씀
    files: ['scripts/**', 'src/tests/**'],
    rules: { '@typescript-eslint/no-unused-expressions': 'off' },
  },
  // 생성된 파일 (explore/3d/lib/build-app.js 가 만듦, 직접 고치지 않음 — CLAUDE.md) · 빌드 결과 · Draco 해독기 원본
  globalIgnores(['.next/**', 'out/**', 'node_modules/**', 'shots/**', 'next-env.d.ts', 'public/draco/**', 'src/three/mole.ts', 'src/three/furniture.ts']),
])
