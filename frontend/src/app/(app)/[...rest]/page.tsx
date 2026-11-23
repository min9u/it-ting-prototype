import { notFound } from 'next/navigation'

/**
 * 어느 화면에도 안 맞는 주소 (Vite 앱의 path: '*'). 로그인 영역 레이아웃 안에서 404 를 내서
 * 헤더(GNB)가 있는 "없는 주소예요"(./not-found.tsx)를 보여 주고, 응답 코드도 404.
 * 실험실이 꺼진 빌드의 /lab/style · /screens 도 여기로 와서 404
 */
export default function CatchAll() {
  notFound()
}
