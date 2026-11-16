import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Footer from '../../components/Footer'
import Pagination from '../../components/Pagination'
import ProfilePopup from '../../components/ProfilePopup'
import { ConfirmDialog, EmptyMole, Toast } from '../../components/Feedback'
import { ChevronLeft } from '../../components/Icons'
import { USERS } from '../../data/mock'
import {
  BOARD_CATS, PAGE_SIZE, deletePost, isListed, isMine, myCommentsOn,
  toggleSave, usePosts, type BoardPost,
} from '../../data/boardStore'
import type { PostCategory } from '../../data/types'
import {
  ACTIVITY_LABEL, ActivityWidget, CatTabs, GuideBanner, HotWidget, InterestWidget, MoreMenu, MyCommentLine, PostCard, SaveToggle,
  SearchBox, WriteButton, POST_DELETED_TOAST, SAVE_TOAST, UNSAVE_TOAST, useArrivalToast, type ActivityKind,
} from './parts'
import s from './Board.module.css'
import { api } from '../../api'
import { POST_CATEGORY_CODE } from '../../api/mappers'
import { patch, useOptimistic, usePostList } from '../../api/queries'
import { qk } from '../../api/queryClient'
import { ErrorState, SkeletonRows } from '../../components/AsyncState'

export { BoardPost } from './BoardPost'
export { BoardWrite, BoardEdit } from './BoardWrite'

type Sort = '최신순' | '인기순' | '댓글순'
const SORTS: Sort[] = ['최신순', '인기순', '댓글순']
const SORT_CODE: Record<Sort, 'LATEST' | 'POPULAR' | 'COMMENTS'> = { 최신순: 'LATEST', 인기순: 'POPULAR', 댓글순: 'COMMENTS' }
const asCat = (v: string | null): '전체' | PostCategory => (BOARD_CATS.includes(v as PostCategory) ? (v as PostCategory) : '전체')

/**
 * 커뮤니티 (Desktop) — Figma 02 F8 커뮤니티 1~14 (design/figma/spec/f8/F8-01.png)
 * 거르기 상태는 주소(?cat·mine·sort·q·interest·page)에 둬서 상세에서 돌아와도 그대로
 */
export function BoardList() {
  const posts = usePosts()
  const [params, setParams] = useSearchParams()
  const cat = asCat(params.get('cat'))
  const mineOnly = params.get('mine') === '1'
  const sort: Sort = SORTS.includes(params.get('sort') as Sort) ? (params.get('sort') as Sort) : '최신순'
  const q = params.get('q') ?? ''
  const interest = params.get('interest')
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [toast, setToast] = useArrivalToast()
  const [profile, setProfile] = useState<string | null>(null)

  /** 주소 값 바꾸기. page 말고 다른 값이 바뀌면 1쪽으로 */
  const set = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) { if (v == null || v === '') p.delete(k); else p.set(k, v) }
    if (!('page' in next)) p.delete('page')
    setParams(p, { replace: true })
  }

  // 거르기 · 정렬 · 페이지는 서버가 함 (api/board.ts, 위험 B8). 페이지는 주소(?page)에 있어서 새로고침 · 뒤로 가기에도 유지
  const res = usePostList({
    category: cat === '전체' ? undefined : POST_CATEGORY_CODE[cat], mine: mineOnly || undefined, interest: interest ?? undefined,
    q: q.trim() || undefined, sort: SORT_CODE[sort], page, size: PAGE_SIZE,
  })
  const list = res.data?.items ?? []
  const total = res.data?.totalPages ?? 1
  const cur = res.data?.page ?? page
  const filtered = cat !== '전체' || mineOnly || !!interest || !!q.trim()
  const run = useOptimistic()

  /** 저장: 목록 캐시를 먼저 바꾸고 실패하면 되돌림 */
  const onSave = (p: BoardPost) => {
    const on = !p.savedAt
    setToast(on ? SAVE_TOAST : UNSAVE_TOAST)
    run.mutate({
      call: () => api.board.setBookmark(p.id, on), errorTitle: on ? '글을 저장하지 못했어요' : '저장을 취소하지 못했어요', invalidate: [qk.posts],
      patches: [patch<{ items: BoardPost[] }>(['posts', 'list'], (o) => ({ ...o, items: o.items.map((x) => (x.id === p.id ? { ...x, savedAt: on ? Date.now() : undefined } : x)) }))],
    }, { onError: () => setToast(null) })
  }

  return (
    <div className={s.wrap}>
      <div className={s.layout}>
        <section className={s.boardCard}>
          <header className={s.boardHead}>
            <div>
              <h1 className="display">커뮤니티</h1>
              <p>땅굴 밖에서 디굴디굴 나누는 이야기예요.</p>
            </div>
            <WriteButton />
          </header>
          <div className={s.filterBar}>
            <CatTabs value={cat} onChange={(c) => set({ cat: c === '전체' ? null : c })} />
            <label className={s.toggle}>
              <input type="checkbox" role="switch" checked={mineOnly} onChange={(e) => set({ mine: e.target.checked ? '1' : null })} />
              <span className={s.switch} aria-hidden />
              내 관심사만
            </label>
            <select className={s.sort} value={sort} onChange={(e) => set({ sort: e.target.value === '최신순' ? null : e.target.value })} aria-label="정렬">
              {SORTS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>
          {interest && (
            <p className={s.activeFilter}>
              <strong>#{interest}</strong> 글만 보고 있어요 <button type="button" onClick={() => set({ interest: null })}>해제</button>
            </p>
          )}
          {res.isPending ? (
            <SkeletonRows count={6} label="글을 불러오는 중" avatar={false} />
          ) : res.isError && !res.data ? (
            <ErrorState error={res.error} onRetry={() => void res.refetch()} retrying={res.isFetching} title="글을 불러오지 못했어요" />
          ) : list.length ? (
            <ul className={s.posts} aria-busy={res.isFetching}>
              {list.map((p) => (
                <PostCard key={p.id} p={p} onOpenUser={setProfile} right={<SaveToggle on={!!p.savedAt} onToggle={() => onSave(p)} />} />
              ))}
            </ul>
          ) : (
            <div className={s.emptyBox}>
              {filtered ? (
                <EmptyMole message="조건에 맞는 글이 없어요">
                  <button type="button" className="btn btn-line btn-sm" onClick={() => setParams(sort === '최신순' ? {} : { sort }, { replace: true })}>필터 초기화</button>
                </EmptyMole>
              ) : (
                <EmptyMole message="아직 글이 없어요. 첫 이야기를 남겨 보세요." />
              )}
            </div>
          )}
          <div className={s.pager}><Pagination page={cur} total={total} onChange={(n) => { set({ page: String(n) }); window.scrollTo(0, 0) }} /></div>
        </section>

        <aside className={s.side}>
          <SearchBox value={q} onChange={(v) => set({ q: v })} />
          <HotWidget posts={posts} />
          <InterestWidget posts={posts} value={interest} onPick={(t) => set({ interest: t })} />
          <GuideBanner />
          <ActivityWidget posts={posts} />
        </aside>
      </div>
      <Footer />
      <ProfilePopup user={profile ? USERS[profile] : null} onClose={() => setProfile(null)} />
      <Toast open={!!toast} {...(toast ?? { title: '' })} onClose={() => setToast(null)} />
    </div>
  )
}

/**
 * 저장한 글 · 내가 쓴 글 · 댓글 단 글 (Figma 02 F8-02·03 / 09·10 / 11·12)
 * 카테고리 탭, 20개씩, 검색 없음. 오른쪽에 인기 글 · 관심사 · 내 활동 · 글쓰기
 */
export function BoardActivity({ kind }: { kind: ActivityKind }) {
  const posts = usePosts()
  const nav = useNavigate()
  const [cat, setCat] = useState<'전체' | PostCategory>('전체')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useArrivalToast()
  const [profile, setProfile] = useState<string | null>(null)
  const [del, setDel] = useState<string | null>(null)

  const list = useMemo(() => {
    let l: BoardPost[]
    if (kind === 'saved') l = posts.filter((p) => isListed(p) && p.savedAt).sort((a, b) => b.savedAt! - a.savedAt!)
    else if (kind === 'mine') l = posts.filter((p) => isMine(p) && p.status !== 'deleted').sort((a, b) => b.at - a.at)
    else l = posts.filter((p) => isListed(p) && myCommentsOn(p).length).sort((a, b) => myCommentsOn(b)[0].at - myCommentsOn(a)[0].at)
    return l.filter((p) => cat === '전체' || p.category === cat)
  }, [posts, kind, cat])
  const total = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const cur = Math.min(page, total)

  const right = (p: BoardPost) => {
    if (kind !== 'mine') {
      return <SaveToggle on={!!p.savedAt} onToggle={() => setToast(toggleSave(p.id) ? SAVE_TOAST : UNSAVE_TOAST)} />
    }
    // 내가 쓴 글: 저장 아이콘 자리에 더보기. 가려진 글은 삭제만 (수정 불가)
    return (
      <MoreMenu small label="글 더보기" items={[
        ...(p.status === 'public' ? [{ label: '수정', onClick: () => nav(`/board/${p.id}/edit`) }] : []),
        { label: '삭제', danger: true, onClick: () => setDel(p.id) },
      ]} />
    )
  }

  const empty = { saved: '저장한 글이 없어요', mine: '아직 쓴 글이 없어요', commented: '댓글 단 글이 없어요' }[kind]

  return (
    <div className={s.wrap}>
      <div className={s.layout}>
        <section className={s.subBoard}>
          <Link to="/board" className={s.backLink}><ChevronLeft size={16} /> 커뮤니티로 돌아가기</Link>
          <h1 className="page-sign">{ACTIVITY_LABEL[kind]}</h1>
          <div className={s.filterBar}>
            <CatTabs value={cat} onChange={(c) => { setCat(c); setPage(1) }} />
          </div>
          {list.length ? (
            <ul className={s.posts}>
              {list.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE).map((p) => (
                <PostCard key={p.id} p={p} onOpenUser={setProfile} savedLine={kind === 'saved'} right={right(p)}
                  below={kind === 'commented' ? <MyCommentLine p={p} /> : undefined} />
              ))}
            </ul>
          ) : (
            <div className={s.emptyBox}>
              <EmptyMole message={empty}>{kind === 'mine' && <WriteButton />}</EmptyMole>
            </div>
          )}
          <div className={s.pager}><Pagination page={cur} total={total} onChange={(n) => { setPage(n); window.scrollTo(0, 0) }} /></div>
        </section>

        <aside className={`${s.side} ${s.sideSub}`}>
          <HotWidget posts={posts} />
          <InterestWidget posts={posts} onPick={(t) => t && nav(`/board?interest=${encodeURIComponent(t)}`)} />
          <ActivityWidget posts={posts} active={kind} />
          <WriteButton block />
        </aside>
      </div>
      <Footer />
      <ProfilePopup user={profile ? USERS[profile] : null} onClose={() => setProfile(null)} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => { if (del) { deletePost(del); setToast(POST_DELETED_TOAST) } }}
        title="게시물을 삭제할까요?" desc="게시물에 달린 댓글과 답글도 함께 사라지고 되돌릴 수 없어요." />
      <Toast open={!!toast} {...(toast ?? { title: '' })} onClose={() => setToast(null)} />
    </div>
  )
}
