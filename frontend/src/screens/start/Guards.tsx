import type { ReactNode } from 'react'
import { Navigate, useLocation } from '@/lib/nav'
import { useMe } from '../../api/auth'
import { ErrorState } from '../../components/AsyncState'
import { LOGIN_FREE, isMobileDevice } from '../../data/auth'
import { rememberReturnTo } from '../../lib/authFlow'
import StartHeader, { PeekMole } from './StartHeader'
import s from './Start.module.css'

/**
 * 00 공통 11: 비로그인은 랜딩 · 둘러보기(F1)와 로그인 · 회원가입(F2)만 볼 수 있다.
 * 그 밖의 화면이나 공유 링크를 열면 로그인 화면으로 보낸다 (로그인한 뒤 열려던 주소로 돌아옴, lib/authFlow).
 * 로그인 여부와 다음 단계는 GET /me (02 "다음에 갈 화면"): 401 → 로그인, nextStep ONBOARDING → 온보딩 1.
 * NEW_TERM 은 그대로 들여보낸다 (내 땅굴 위의 새 학기 안내는 05 탐색 영역).
 * LOGIN_FREE(팀 공유 빌드)면 검사하지 않는다.
 * onboarding: 온보딩 화면 자체 (온보딩 중인 계정도 들어옴)
 */
export function RequireLogin({ children, onboarding }: { children: ReactNode; onboarding?: boolean }) {
  const loc = useLocation()
  const me = useMe(!LOGIN_FREE)
  if (LOGIN_FREE) return <>{children}</>
  if (me.isPending) return <div className={s.gateWait} role="status" aria-busy="true" aria-label="로그인 확인 중" />
  if (me.isError) return <main className={s.gateError}><ErrorState error={me.error} onRetry={() => void me.refetch()} retrying={me.isFetching} /></main>
  if (!me.data) {
    const from = `${loc.pathname}${loc.search}`
    rememberReturnTo(from)
    return <Navigate to="/login" replace state={{ from }} />
  }
  if (me.data.nextStep === 'ONBOARDING' && !onboarding) return <Navigate to="/onboarding/name" replace />
  return <>{children}</>
}

/**
 * 00 공통 20 지원 기기: 이번 범위는 데스크톱 웹만. 휴대폰 · 태블릿으로 열면(비밀번호 재설정 링크, 공유 링크 포함)
 * 서비스 화면 대신 "PC에서 이용해 주세요" 안내만. 창 폭이 아니라 기기로 판단 (좁은 데스크톱 창은 그대로). 시연: ?device=mobile
 */
export function PcOnly({ children }: { children: ReactNode }) {
  if (!isMobileDevice()) return <>{children}</>
  return (
    <div className={s.page}>
      <div className={s.blurBg} aria-hidden />
      <StartHeader tone="light" right={null} />
      <main className={s.center}>
        <div className={s.panelWrap}>
          <PeekMole />
          <section className={s.panel}>
            <h1 className={s.panelTitle}>PC에서 이용해 주세요</h1>
            <p className={s.panelText}>디굴디굴은 지금 데스크톱 웹에서만 쓸 수 있어요.<br />PC 브라우저에서 같은 주소로 들어와 주세요.</p>
          </section>
        </div>
      </main>
    </div>
  )
}
