import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from '@/lib/nav'
import Footer from '../../components/Footer'
import Pagination from '../../components/Pagination'
import ProfilePopup from '../../components/ProfilePopup'
import { ConfirmDialog, EmptyMole, Toast } from '../../components/Feedback'
import { ChevronLeft } from '../../components/Icons'
import type { PostCategory } from '../../data/types'
import type { Person } from '../../api/common'
import {
  useBookmark, useDeletePost, useMyPosts, usePostList, type MyPostCardVM, type MyPostsParams, type PostCardVM, type PostSortLabel,
} from '../../api/community'
import { ErrorState, SkeletonRows } from '../../components/AsyncState'
import {
  ACTIVITY_LABEL, ActivityWidget, BOARD_CATS, CatTabs, GuideBanner, HotWidget, InterestWidget, MoreMenu, MyCommentLine, PAGE_SIZE, PostCard,
  SaveToggle, SearchBox, WriteButton, POST_DELETED_TOAST, SAVE_TOAST, UNSAVE_TOAST, useArrivalToast, type ActivityKind,
} from './parts'
import s from './Board.module.css'

export { BoardPost } from './BoardPost'
export { BoardWrite, BoardEdit } from './BoardWrite'

const SORTS: PostSortLabel[] = ['최신순', '인기순', '댓글순']
const asCat = (v: string | null): '전체' | PostCategory => (BOARD_CATS.includes(v as PostCategory) ? (v as PostCategory) : '전체')
/** 검색어는 입력이 멈춘 뒤에 부른다 (api 08 "화면마다 부르는 API") */
const SEARCH_DELAY = 300

/**
 * 커뮤니티 (Desktop) — 명세 08 커뮤니티 1~14. 글은 GET /posts, 오른쪽은 GET /posts/highlights · /me/posts/summary
 * 거르기 상태는 주소(?cat·mine·sort·q·interest·page)에 둬서 상세에서 돌아와도 그대로
 */
export function BoardList() {
  const [params, setParams] = useSearchParams()
  const cat = asCat(params.get('cat'))
  const mineOnly = params.get('mine') === '1'
  const sort: PostSortLabel = SORTS.includes(params.get('sort') as PostSortLabel) ? (params.get('sort') as PostSortLabel) : '최신순'
  const q = params.get('q') ?? ''
  const interest = params.get('interest')
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [toast, setToast] = useArrivalToast()
  const [profile, setProfile] = useState<Person | null>(null)
  // 검색창 글자는 바로 바꾸고, 주소(= 요청)는 입력이 멈추면
  const [kw, setKw] = useState(q)
  const pushed = useRef(q)
  // 주소가 밖에서 바뀌면(뒤로 가기 · 필터 초기화) 검색창도 따라감
  useEffect(() => { if (q !== pushed.current) { pushed.current = q; setKw(q) } }, [q])

  /** 주소 값 바꾸기. page 말고 다른 값이 바뀌면 1쪽으로 */
  const set = (next: Record<string, string | null>) => {
    setParams((cur) => {
      const p = new URLSearchParams(cur)
      for (const [k, v] of Object.entries(next)) { if (v == null || v === '') p.delete(k); else p.set(k, v) }
      if (!('page' in next)) p.delete('page')
      return p
    }, { replace: true })
  }
  useEffect(() => {
    if (kw === q) return
    const t = setTimeout(() => { pushed.current = kw; set({ q: kw }) }, SEARCH_DELAY)
    return () => clearTimeout(t)
  }, [kw]) // eslint-disable-line react-hooks/exhaustive-deps

  // 거르기 · 정렬 · 페이지는 서버가 함. 페이지는 주소(?page)에 있어서 새로고침 · 뒤로 가기에도 유지
  const res = usePostList({
    category: cat === '전체' ? undefined : cat, mineOnly: mineOnly || undefined, interest: interest ?? undefined,
    keyword: q.trim() || undefined, sort, page, size: PAGE_SIZE,
  })
  const list = res.data?.items ?? []
  const total = res.data?.totalPages ?? 1
  const cur = res.data?.page ?? page
  const filtered = cat !== '전체' || mineOnly || !!interest || !!q.trim()
  const bookmark = useBookmark()

  /** 저장: 카드를 먼저 바꾸고 실패하면 되돌림 */
  const onSave = (p: PostCardVM) => {
    const on = !p.bookmarked
    setToast(on ? SAVE_TOAST : UNSAVE_TOAST)
    bookmark(p.id, on, () => setToast(null))
  }

  return (
    <div className={s.wrap}>
      <div className={s.layout}>
        <section className={s.boardCard}>
          <header className={s.boardHead}>
            <div>
              <h1 className="display">게시판</h1>
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
                <PostCard key={p.id} p={p} onOpenUser={setProfile} right={<SaveToggle on={p.bookmarked} onToggle={() => onSave(p)} />} />
              ))}
            </ul>
          ) : (
            <div className={s.emptyBox}>
              {filtered ? (
                <EmptyMole message="조건에 맞는 글이 없어요">
                  <button type="button" className="btn btn-line btn-sm" onClick={() => { setKw(''); setParams(sort === '최신순' ? {} : { sort }, { replace: true }) }}>필터 초기화</button>
                </EmptyMole>
              ) : (
                <EmptyMole message="아직 글이 없어요. 첫 이야기를 남겨 보세요." />
              )}
            </div>
          )}
          <div className={s.pager}><Pagination page={cur} total={total} onChange={(n) => { set({ page: String(n) }); window.scrollTo(0, 0) }} /></div>
        </section>

        <aside className={s.side}>
          <SearchBox value={kw} onChange={setKw} />
          <HotWidget />
          <InterestWidget value={interest} onPick={(t) => set({ interest: t })} />
          <GuideBanner />
          <ActivityWidget />
        </aside>
      </div>
      <Footer />
      <ProfilePopup user={profile} onClose={() => setProfile(null)} />
      <Toast open={!!toast} {...(toast ?? { title: '' })} onClose={() => setToast(null)} />
    </div>
  )
}

const TAB: Record<ActivityKind, MyPostsParams['tab']> = { mine: 'WRITTEN', commented: 'COMMENTED', saved: 'BOOKMARKED' }

/**
 * 저장한 글 · 내가 쓴 글 · 댓글 단 글 (명세 08) — GET /me/posts?tab=…
 * 카테고리 탭, 20개씩, 검색 없음. 오른쪽에 인기 글 · 관심사 · 내 활동 · 글쓰기
 */
export function BoardActivity({ kind }: { kind: ActivityKind }) {
  const nav = useNavigate()
  const [cat, setCat] = useState<'전체' | PostCategory>('전체')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useArrivalToast()
  const [profile, setProfile] = useState<Person | null>(null)
  const [del, setDel] = useState<string | null>(null)
  const res = useMyPosts({ tab: TAB[kind], category: cat === '전체' ? undefined : cat, page })
  const list = res.data?.items ?? []
  const total = res.data?.totalPages ?? 1
  const cur = res.data?.page ?? page
  const bookmark = useBookmark()
  const remove = useDeletePost()

  const right = (p: MyPostCardVM) => {
    if (kind !== 'mine') {
      return <SaveToggle on={p.bookmarked} onToggle={() => { const on = !p.bookmarked; setToast(on ? SAVE_TOAST : UNSAVE_TOAST); bookmark(p.id, on, () => setToast(null)) }} />
    }
    // 내가 쓴 글: 저장 아이콘 자리에 더보기. 가려진 글은 삭제만 (canEdit 이 false 면 수정 없음)
    return (
      <MoreMenu small label="글 더보기" items={[
        ...(p.canEdit ? [{ label: '수정', onClick: () => nav(`/board/${p.id}/edit`) }] : []),
        { label: '삭제', danger: true, onClick: () => setDel(p.id) },
      ]} />
    )
  }

  const empty = { saved: '저장한 글이 없어요', mine: '아직 쓴 글이 없어요', commented: '댓글 단 글이 없어요' }[kind]

  return (
    <div className={s.wrap}>
      <div className={s.layout}>
        <section className={s.subBoard}>
          <Link to="/board" className={s.backLink}><ChevronLeft size={16} /> 게시판으로 돌아가기</Link>
          <h1 className="page-sign">{ACTIVITY_LABEL[kind]}</h1>
          <div className={s.filterBar}>
            <CatTabs value={cat} onChange={(c) => { setCat(c); setPage(1) }} />
          </div>
          {res.isPending ? (
            <SkeletonRows count={4} label="글을 불러오는 중" avatar={false} />
          ) : res.isError && !res.data ? (
            <ErrorState error={res.error} onRetry={() => void res.refetch()} retrying={res.isFetching} title="글을 불러오지 못했어요" />
          ) : list.length ? (
            <ul className={s.posts} aria-busy={res.isFetching}>
              {list.map((p) => (
                <PostCard key={p.id} p={p} onOpenUser={setProfile} savedAt={kind === 'saved' ? p.bookmarkedAt : undefined} right={right(p)}
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
          <HotWidget />
          <InterestWidget onPick={(t) => t && nav(`/board?interest=${encodeURIComponent(t)}`)} />
          <ActivityWidget active={kind} />
          <WriteButton block />
        </aside>
      </div>
      <Footer />
      <ProfilePopup user={profile} onClose={() => setProfile(null)} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => { if (del) remove.mutate(del, { onSuccess: () => setToast(POST_DELETED_TOAST) }) }}
        title="게시물을 삭제할까요?" desc="게시물에 달린 댓글과 답글도 함께 사라지고 되돌릴 수 없어요." />
      <Toast open={!!toast} {...(toast ?? { title: '' })} onClose={() => setToast(null)} />
    </div>
  )
}
