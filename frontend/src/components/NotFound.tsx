import { useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from '@/lib/nav'
import { isChunkLoadError, reloadOnce } from '../lib/chunkReload'
import { ENV } from '../lib/env'
import mound from '../assets/mole-mound.png'
import styles from './NotFound.module.css'

/** 안내 문구 (00 공통 21 예: "삭제된 글이에요", "삭제된 모임이에요", "없는 땅굴이에요") */
export const GONE_TEXT = {
  post: { title: '삭제된 글이에요', desc: '글쓴이가 지웠거나 신고로 가려져서 볼 수 없어요.' },
  meetup: { title: '삭제된 모임이에요', desc: '주최자가 모임을 지웠거나 취소해서 볼 수 없어요.' },
  burrow: { title: '없는 땅굴이에요', desc: '탈퇴한 사람의 땅굴이거나 주소가 잘못됐어요.' },
  chat: { title: '없어진 대화예요', desc: '대화방이 닫혔거나 상대가 탈퇴했어요.' },
  notice: { title: '없는 공지예요', desc: '공지가 내려갔거나 주소가 잘못됐어요.' },
  page: { title: '없는 주소예요', desc: '주소가 바뀌었거나 없어진 화면이에요.' },
} as const
export type GoneWhat = keyof typeof GONE_TEXT

/**
 * 대상 없음 · 오류 공용 화면 (00 공통 21)
 * 삭제되거나 가려진 글 · 모임, 탈퇴한 사람의 땅굴, 없는 주소를 열면 같은 모양으로:
 * 볼 수 없는 까닭 + 돌아갈 버튼. 일시 오류는 같은 화면에 "다시 시도".
 * 다른 화면에서 쓸 때: <NotFound what="post" /> (지금 쓰는 <Navigate to="/board" /> 대신)
 */
export default function NotFound({ what = 'page', error, onRetry, inline }: { what?: GoneWhat; error?: boolean; onRetry?: () => void; inline?: boolean }) {
  const navigate = useNavigate()
  const t = error ? { title: '잠시 문제가 생겼어요', desc: '연결이 고르지 않거나 서버가 잠깐 쉬고 있어요. 조금 뒤에 다시 시도해 주세요.' } : GONE_TEXT[what]
  const canBack = typeof window !== 'undefined' && window.history.length > 1
  return (
    <main className={inline ? `${styles.page} ${styles.inline}` : styles.page}>
      <div className={styles.card} role={error ? 'alert' : undefined}>
        <img src={mound} alt="" width={132} height={132} />
        <h1 className="display">{t.title}</h1>
        <p>{t.desc}</p>
        <div className={styles.actions}>
          {error ? (
            <button className="btn btn-cta" onClick={() => (onRetry ? onRetry() : window.location.reload())}>다시 시도</button>
          ) : canBack ? (
            <button className="btn btn-line" onClick={() => navigate(-1)}>이전 화면으로</button>
          ) : null}
          <Link to="/burrow" className={error ? 'btn btn-line' : 'btn btn-cta'}>내 땅굴로 가기</Link>
        </div>
      </div>
    </main>
  )
}

/** /gone/:what — 알림에서 원본이 사라진 경우 (F9 알림 한 줄) */
export function GoneRoute() {
  const { what } = useParams()
  return <NotFound what={what && what in GONE_TEXT ? (what as GoneWhat) : 'page'} />
}

/**
 * 화면 에러 경계(Next 의 error.tsx 가 그림): 화면이 그리다 깨지면 같은 안내 + 다시 시도 (src/app 의 error.tsx 들)
 * - inline: 헤더(GNB)·설정 메뉴 같은 바깥 틀은 두고 안쪽만 바꿈
 * - 재배포 뒤 옛 파일을 못 받은 것(청크 404)이면 한 번만 새로고침 (lib/chunkReload.ts). 이미 했으면 안내 화면
 * - "다시 시도"는 Vite 앱과 같이 새로고침 (Next 의 reset 대신. 깨진 상태 · 캐시가 함께 풀리게)
 * - 없는 주소(404)는 Next 의 not-found.tsx 가 따로 그림
 */
export function RouteError({ error, inline }: { error?: unknown; inline?: boolean }) {
  const err = error
  const chunk = isChunkLoadError(err)
  const reloading = useRef(false)
  useEffect(() => {
    if (chunk && !reloading.current) reloading.current = reloadOnce('route chunk')
  }, [chunk])
  useEffect(() => { if (err) console.error(err) }, [err])
  return (
    <>
      <NotFound error inline={inline} />
      {ENV.dev && err != null && (
        <pre style={{ margin: '0 auto 24px', maxWidth: 720, padding: 12, borderRadius: 8, background: '#2b1d14', color: '#f6e7d8', fontSize: 12, whiteSpace: 'pre-wrap' }}>
          {String((err as Error)?.stack ?? (err as Error)?.message ?? err)}
        </pre>
      )}
    </>
  )
}
