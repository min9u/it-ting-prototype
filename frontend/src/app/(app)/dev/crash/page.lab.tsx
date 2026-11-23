'use client'

/** 실험실 전용: 화면 에러 경계 확인 (/dev/crash → 헤더는 남고 안쪽만 안내). Vite 앱에서는 개발 서버 전용이었음 */
export default function DevCrash(): never {
  throw new Error('개발용: 화면 에러 경계 확인 (/dev/crash)')
}
