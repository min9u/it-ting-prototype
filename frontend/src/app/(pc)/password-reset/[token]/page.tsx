'use client'

import { Navigate, useParams } from '@/lib/nav'

/**
 * 재설정 메일의 링크 (명세 02 API, KAN-41: `{프론트엔드 주소}/password-reset/{token}`) → 새 비밀번호 화면.
 * sent · new · expired 는 같은 폴더의 고정 주소라 먼저 잡히고, 그 밖의 값만 토큰으로 받는다
 */
export default function Page() {
  const { token = '' } = useParams<{ token: string }>()
  return <Navigate to={`/password-reset/new?token=${encodeURIComponent(token)}`} replace />
}
