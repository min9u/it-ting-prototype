import { useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useLocation, useNavigate, useParams } from '@/lib/nav'
import Avatar from '../../components/Avatar'
import Footer from '../../components/Footer'
import InterestChip from '../../components/InterestChip'
import ProfilePopup from '../../components/ProfilePopup'
import { ConfirmDialog, ReportDialog, TOAST, Toast, type ToastSpec } from '../../components/Feedback'
import { CalendarIcon, ChatIcon, ChevronLeft, ChevronRight, HomeIcon } from '../../components/Icons'
import { toneOf } from '../../data/mock'
import { isApiError } from '../../api'
import type { Person } from '../../api/common'
import {
  COMMENT_PAGE_SIZE, flattenComments, useBookmark, useComments, usePostActions, usePostDetail, usePostView, useRelatedPosts, useReport,
  type CommentThreadVM, type CommentVM, type LinkedMeetupVM, type PostDetailVM,
} from '../../api/community'
import { DetailSkeleton, ErrorState, QueryGate } from '../../components/AsyncState'
import { clock, monthDay } from '../../lib/time'
import {
  ALREADY_REPORTED_TOAST, BookmarkIcon, COMMENT_MAX, CatPill, GonePage, HeartFill, MoreMenu, POST_DELETED_TOAST, Photo, SAVE_TOAST, ShareIcon,
  UNSAVE_TOAST, Who, affLine, ago, bigOf, dateLabel, isGone, useArrivalToast, type MenuItem,
} from './parts'
import s from './Board.module.css'

/**
 * 커뮤니티 – 글 상세 (Desktop) — 명세 08 글 상세 1~17
 * 열 때: GET /posts/{id} + POST /posts/{id}/views + GET /posts/{id}/comments + GET /posts/{id}/related-posts
 * 대표 사진(폭 전체) → 왼쪽 액션 레일(따라옴) + 가운데 본문 카드(댓글 포함) → 다음 읽을 글 → 푸터
 */
export function BoardPost() {
  const { postId = '' } = useParams()
  const { hash } = useLocation()
  const q = usePostDetail(postId)
  // 조회수: 글을 열 때마다 +1 (작성자도 셈). 글 수정 화면은 부르지 않음
  const viewed = usePostView(postId)
  // 특정 댓글로 오면(#댓글id) 댓글 쪽에서 스크롤하므로 맨 위로 올리지 않음
  useEffect(() => { if (!hash) window.scrollTo(0, 0) }, [postId]) // eslint-disable-line react-hooks/exhaustive-deps

  // 404 POST_NOT_FOUND = 없거나 삭제된 글, 404 POST_HIDDEN = 신고로 가려진 남의 글 (00 공통 21 안내 화면)
  return (
    <QueryGate q={q} skeleton={<DetailSkeleton label="글을 불러오는 중" />}
      notFound={(e) => <GonePage message={isApiError(e) && e.code === 'POST_HIDDEN' ? '신고로 가려진 글이에요' : '삭제된 글이에요'} />}
      error={(retry, e) => <div className={s.wrap}><ErrorState error={e} onRetry={retry} retrying={q.isFetching} title="글을 불러오지 못했어요" /></div>}>
      {(p) => <PostView key={p.id} p={p} viewed={viewed} />}
    </QueryGate>
  )
}

const meetupWhen = (m: LinkedMeetupVM) => `${monthDay(m.startsAt)} ${clock(m.startsAt)}`
const RECRUIT_LABEL = { closed: '모집 마감', past: '지난 모임', cancelled: '취소된 모임' } as const

function PostView({ p, viewed }: { p: PostDetailVM; viewed: number | null }) {
  const nav = useNavigate()
  const loc = useLocation()
  const [toast, setToast] = useArrivalToast()
  const [dialog, setDialog] = useState<'delete' | 'report' | null>(null)
  const [unfold, setUnfold] = useState(false)
  const [profile, setProfile] = useState<Person | null>(null)
  const commentsRef = useRef<HTMLElement>(null)
  const act = usePostActions(p.id)
  const bookmark = useBookmark()
  const report = useReport()
  const main = p.interests[0]
  const related = useRelatedPosts(p.id)
  const next = related.data ?? []
  const folded = p.reportedByMe && !unfold && !p.hidden
  const views = Math.max(p.views, viewed ?? 0)

  // 더보기: 내 글이면 수정(고칠 수 있을 때만) · 삭제, 남의 글이면 신고
  const menu: MenuItem[] = p.mine
    ? [...(p.canEdit ? [{ label: '수정', onClick: () => nav(`/board/${p.id}/edit`) }] : []), { label: '삭제', danger: true, onClick: () => setDialog('delete') }]
    : [{ label: '신고', danger: true, onClick: () => (p.reportedByMe ? setToast(ALREADY_REPORTED_TOAST) : setDialog('report')) }]

  const onSave = () => {
    const on = !p.bookmarked
    setToast(on ? SAVE_TOAST : UNSAVE_TOAST)
    bookmark(p.id, on, () => setToast(null))
  }
  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setToast({ title: '링크를 복사했어요', desc: '붙여 넣어 글을 나눠 보세요' }) }
    catch { setToast({ title: '링크를 복사하지 못했어요', desc: '주소창의 주소를 복사해 주세요' }) }
  }
  const hero = p.images[0]
  const m = p.meetup

  return (
    <div className={s.wrap}>
      {/* 2 대표 사진: 첫 사진을 폭 전체로, 없으면 관심사 일러스트 */}
      <div className={hero ? s.heroPhoto : s.hero} style={hero ? { background: `var(--tone-${hero.tone}-bg)` } : undefined}>
        {hero?.url ? <img src={hero.url} alt="" /> : hero ? <span className={s.heroLabel}>사진 영역 · 글쓴이가 올린 대표 사진</span> : (
          <span className={s.heroArt} aria-hidden><span>{bigOf(main ?? '')?.emoji ?? '🌱'}</span></span>
        )}
      </div>

      <div className={s.detail}>
        {/* 3 액션 레일: 좋아요 · 댓글 · 저장 · 공유. 스크롤해도 따라옴. 가려진 글에는 좋아요 · 저장을 못 함 */}
        <nav className={s.rail} aria-label="글 반응">
          <button type="button" className={p.liked ? s.railOn : undefined} aria-pressed={p.liked} onClick={() => act.setLike(!p.liked)} disabled={p.hidden} aria-label={`좋아요 ${p.likes}개`}>
            <span><HeartFill on={p.liked} size={18} /></span><em>{p.likes}</em>
          </button>
          <button type="button" onClick={() => commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} aria-label={`댓글 ${p.comments}개 보기`}>
            <span><ChatIcon size={18} /></span><em>{p.comments}</em>
          </button>
          <button type="button" className={p.bookmarked ? s.railOn : undefined} aria-pressed={p.bookmarked} disabled={p.hidden} onClick={onSave}>
            <span><BookmarkIcon on={p.bookmarked} size={18} /></span><em>저장</em>
          </button>
          <button type="button" onClick={share} disabled={p.hidden}><span><ShareIcon /></span><em>공유</em></button>
        </nav>

        <article className={s.paper}>
          {p.hidden && (
            <p className={s.hiddenNote}>신고로 가려진 글이에요. 다른 사람에게는 보이지 않고, 수정할 수 없어요. 열어 보거나 삭제할 수는 있어요.</p>
          )}
          {/* 4 위치 · 카테고리 */}
          <p className={s.crumb}>
            <Link to="/board"><ChevronLeft size={14} /> 게시판</Link>
            <Link to={`/board?cat=${encodeURIComponent(p.category)}`}><CatPill cat={p.category} /></Link>
          </p>
          {folded ? (
            <div className={s.foldedPost}>
              <strong className="display">신고한 게시물이에요</strong>
              <p>신고한 글은 나에게만 접힌 채로 보여요.</p>
              <button type="button" className="btn btn-line btn-sm" onClick={() => setUnfold(true)}>내용 보기</button>
            </div>
          ) : (
            <>
              {/* 5 제목 (최대 2줄) */}
              <h1 className={`display ${s.title}`}>{p.title}</h1>
              {/* 6 작성자 · 7 더보기 */}
              <div className={s.author}>
                <Who user={p.author} onOpen={setProfile} className={s.authorAva}><Avatar size={40} empty={isGone(p.author)} /></Who>
                <div className={s.authorText}>
                  <p className={s.authorName}>
                    <Who user={p.author} onOpen={setProfile} className={s.authorNick} />
                    {p.sharedInterests.map((i) => <InterestChip key={i} label={`✓ ${i}`} tone={toneOf(i)} shared />)}
                  </p>
                  <p className={s.authorSub}>
                    {[affLine(p.author), dateLabel(p.createdAt)].filter(Boolean).join(' · ')}
                    {p.edited && <span className={s.edited}>수정됨</span>}
                    {` · 조회 ${views}`}
                    {p.sharedInterests.length > 0 && ` · 나와 겹치는 관심사 ${p.sharedInterests.length}개`}
                  </p>
                </div>
                {!p.mine && !isGone(p.author) && (
                  <Link to={`/burrow/${p.author.id}`} className={s.visit}><HomeIcon size={15} /> 땅굴 놀러 가기</Link>
                )}
                <MoreMenu items={menu} label="작성자 더보기" />
              </div>
              <div className={s.body}>
                {p.content.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
              </div>
              {p.images.length > 1 && (
                <div className={s.morePhotos}>
                  {p.images.slice(1).map((ph, i) => (
                    <span key={ph.id || i} style={{ background: `var(--tone-${ph.tone}-bg)` }}>{ph.url ? <img src={ph.url} alt={`사진 ${i + 2}`} /> : `사진 ${i + 2}`}</span>
                  ))}
                </div>
              )}
              {/* 8 글에 나온 모임: 지금의 모집 상태 (모임이 삭제되면 카드 없음) */}
              {m && (
                <div className={s.meetup}>
                  <span className={s.meetupSign}><span>{m.title}</span></span>
                  <div className={s.meetupText}>
                    <p className={s.meetupState}>
                      {m.recruit === 'open' ? <em className={s.recruiting}>● 모집 중</em> : <em className={s.closed}>{RECRUIT_LABEL[m.recruit]}</em>}
                      <span>글에 나온 모임</span>
                    </p>
                    <strong>{m.title}</strong>
                    <p className={s.meetupInfo}><span><CalendarIcon size={13} /> {meetupWhen(m)}</span><span>👤 {m.confirmed} / {m.capacity}명</span></p>
                  </div>
                  <Link to={`/meetups/${m.id}`} className={`btn btn-sm ${s.meetupGo}`}>모임 보기 <ChevronRight size={14} /></Link>
                </div>
              )}
              {/* 9 태그: 관심사(대분류) · 카테고리. 누르면 그 태그 글 목록 */}
              <div className={s.tags}>
                {p.interests.map((t) => (
                  <Link key={t} to={`/board?interest=${encodeURIComponent(t)}`}><InterestChip label={t} tone={bigOf(t)?.tone} /></Link>
                ))}
                <Link to={`/board?cat=${encodeURIComponent(p.category)}`}><InterestChip label={p.category} tone="sand" /></Link>
              </div>
            </>
          )}

          {/* 10~13 댓글 */}
          <Comments ref_={commentsRef} p={p} act={act} hash={loc.hash.slice(1)} onToast={setToast} onOpenUser={setProfile} />
        </article>
      </div>

      {/* 14 다음 읽을 글: 같은 관심사 대분류의 인기 글 3개 */}
      {next.length > 0 && (
        <section className={s.next} aria-label="다음 읽을 글">
          <header>
            <h2 className="display">{main ? `${main} 이야기 더 보기` : '다른 이야기 더 보기'}</h2>
            <Link to={main ? `/board?interest=${encodeURIComponent(main)}` : '/board'}>전체 보기</Link>
          </header>
          <ul>
            {next.map((x) => (
              <li key={x.id}>
                <Link to={`/board/${x.id}`} className={s.nextCard}>
                  {x.thumb
                    ? <Photo ph={x.thumb} interest={x.interests[0]} className={s.nextArt} />
                    : <span className={s.nextArt} style={{ background: `var(--tone-${bigOf(x.interests[0] ?? main ?? '')?.tone ?? 'sand'}-bg)` }} aria-hidden>{bigOf(x.interests[0] ?? '')?.emoji}</span>}
                  <span className={s.nextText}>
                    <em>{x.category}</em>
                    <strong>{x.reportedByMe ? '신고한 게시물이에요' : x.title}</strong>
                    <small>댓글 {x.comments} · 좋아요 {x.likes}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Footer />

      <ProfilePopup user={profile} onClose={() => setProfile(null)} />
      <ConfirmDialog open={dialog === 'delete'} onClose={() => setDialog(null)}
        onConfirm={() => act.removePost.mutate(undefined, { onSuccess: () => nav('/board', { state: { toast: POST_DELETED_TOAST } }) })}
        title="게시물을 삭제할까요?" desc="게시물에 달린 댓글과 답글도 함께 사라지고 되돌릴 수 없어요." />
      <ReportDialog open={dialog === 'report'} target="게시물" onClose={() => setDialog(null)}
        onConfirm={(why) => report.mutate({ type: 'POST', id: p.id, picked: why, onAlready: () => setToast(ALREADY_REPORTED_TOAST) }, { onSuccess: () => setToast(TOAST.reported) })} />
      <Toast open={!!toast} {...(toast ?? { title: '' })} onClose={() => setToast(null)} />
    </div>
  )
}

/* ===== 댓글 (10 · 11 · 13) ===== */
type PostActions = ReturnType<typeof usePostActions>
type Pending = { kind: 'delete' | 'report'; c: CommentVM; hasReplies: boolean } | null
/** 답글 입력창: thread(그 댓글) 아래에 열리고, target(답하는 댓글이나 답글)에 답함 */
type ReplyTo = { thread: string; target: string; to: string }

function Comments({ p, act, hash, onToast, onOpenUser, ref_ }: {
  p: PostDetailVM; act: PostActions; hash: string; onToast: (t: ToastSpec) => void; onOpenUser: (u: Person) => void; ref_: React.RefObject<HTMLElement | null>
}) {
  const cq = useComments(p.id)
  const top = flattenComments(cq.data)
  const report = useReport()
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [peek, setPeek] = useState<string[]>([])
  const [discard, setDiscard] = useState<null | (() => void)>(null)
  const disabled = p.hidden
  const found = !!hash && top.some((c) => c.id === hash || c.replies.some((r) => r.id === hash))
  const scrolled = useRef('')

  // 댓글 단 글 · 알림에서 특정 댓글로 오면 그 댓글이 나올 때까지 이어 받고 그 자리로 (api 08 GET comments)
  useEffect(() => {
    if (!hash || scrolled.current === hash) return
    if (!found) { if (cq.hasNextPage && !cq.isFetchingNextPage) void cq.fetchNextPage(); return }
    const el = document.getElementById(hash)
    if (el) { scrolled.current = hash; el.scrollIntoView({ block: 'center' }); el.classList.add(s.flash) }
  }, [hash, found, cq.hasNextPage, cq.isFetchingNextPage]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    const t = draft.trim()
    if (!t || act.addComment.isPending) return
    act.addComment.mutate({ content: t, replyTo: null }, { onSuccess: () => setDraft('') })
  }

  const row = (c: CommentVM, thread: CommentThreadVM) => {
    const isThread = c.id === thread.id
    // 가려진 댓글: 본문 없이 자리만. 내 것이면 지울 수는 있음(고칠 수는 없음)
    if (c.hidden) {
      return (
        <p className={s.cHidden}>신고로 가려진 댓글이에요
          {c.mine && !disabled && <MoreMenu small label="댓글 더보기" items={[{ label: '삭제', danger: true, onClick: () => setPending({ kind: 'delete', c, hasReplies: isThread && thread.replies.length > 0 }) }]} />}
        </p>
      )
    }
    if (c.reportedByMe && !peek.includes(c.id)) {
      return <p className={s.cHidden}>신고한 댓글이에요 <button type="button" onClick={() => setPeek((l) => [...l, c.id])}>보기</button></p>
    }
    const items: MenuItem[] = c.mine
      ? [{ label: '수정', onClick: () => { setEditing(c.id); setReplyTo(null) } }, { label: '삭제', danger: true, onClick: () => setPending({ kind: 'delete', c, hasReplies: isThread && thread.replies.length > 0 }) }]
      : [{ label: '신고', danger: true, onClick: () => (c.reportedByMe ? onToast(ALREADY_REPORTED_TOAST) : setPending({ kind: 'report', c, hasReplies: false })) }]
    return (
      <div className={s.comment}>
        <Who user={c.author} onOpen={onOpenUser} className={s.cAva}><Avatar size={32} empty={isGone(c.author)} /></Who>
        <div className={s.cMain}>
          <p className={s.cMeta}>
            <Who user={c.author} onOpen={onOpenUser} className={s.cNick} />
            {c.author.id === p.author.id && !isGone(c.author) && <em>글쓴이</em>}
            <span>{ago(c.createdAt)}</span>
            {c.edited && <span className={s.edited}>수정됨</span>}
            {!disabled && <MoreMenu small items={items} label="댓글 더보기" />}
          </p>
          {editing === c.id ? (
            <EditBox initial={c.content ?? ''} onCancel={(changed) => (changed ? setDiscard(() => () => setEditing(null)) : setEditing(null))}
              onSave={(t) => { act.editComment(c.id, t); setEditing(null) }} />
          ) : (
            <>
              <p className={s.cText}>{c.mention && <span className={s.mention}>@{c.mention} </span>}{c.content}</p>
              <p className={s.cActions}>
                <button type="button" className={c.liked ? s.cLiked : undefined} aria-pressed={c.liked} disabled={disabled} onClick={() => act.setCommentLike(c, !c.liked)} aria-label={`댓글 좋아요 ${c.likes}개`}>
                  <HeartFill on={c.liked} size={13} /> {c.likes}
                </button>
                {!disabled && (
                  <button type="button" onClick={() => { setReplyTo({ thread: thread.id, target: c.id, to: c.author.nickname }); setEditing(null) }}>답글</button>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <section ref={ref_} className={s.comments} aria-label="댓글">
      <h2 className={`display ${s.cHead}`}>댓글 <span>{p.comments}</span></h2>
      {!disabled && (
        <form className={s.commentForm} onSubmit={(e) => { e.preventDefault(); submit() }}>
          <Avatar size={32} />
          <div className={s.commentBox}>
            <textarea value={draft} maxLength={COMMENT_MAX} onChange={(e) => setDraft(e.target.value)} placeholder="댓글 남기기" aria-label="댓글 입력"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() } }} />
            <span className={s.commentFoot}>
              <small>{draft.length} / {COMMENT_MAX}</small>
              <button className="btn btn-primary btn-sm" disabled={!draft.trim() || act.addComment.isPending}>등록</button>
            </span>
          </div>
        </form>
      )}
      {cq.isPending ? (
        <p className={s.cEmpty} aria-busy>댓글을 불러오는 중이에요…</p>
      ) : cq.isError && !cq.data ? (
        <p className={s.cEmpty}>댓글을 불러오지 못했어요. <button type="button" className="btn btn-line btn-sm" onClick={() => void cq.refetch()}>다시 시도</button></p>
      ) : top.length ? (
        <ul className={s.cList}>
          {top.map((c) => (
            <li key={c.id} id={c.id}>
              {row(c, c)}
              {c.replies.map((r) => <div key={r.id} id={r.id} className={s.reply}>{row(r, c)}</div>)}
              {replyTo?.thread === c.id && (
                <ReplyBox key={replyTo.target} to={replyTo.to} busy={act.addComment.isPending} onCancel={() => setReplyTo(null)}
                  onSubmit={(t) => act.addComment.mutate({ content: t, replyTo: replyTo.target }, { onSuccess: () => setReplyTo(null) })} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.cEmpty}>아직 댓글이 없어요. 글 속 이야기 하나를 골라 첫 댓글로 말을 걸어 보세요.</p>
      )}
      {cq.hasNextPage && (
        <button type="button" className={s.moreComments} disabled={cq.isFetchingNextPage} onClick={() => void cq.fetchNextPage()}>
          {cq.isFetchingNextPage ? '불러오는 중…' : `댓글 ${COMMENT_PAGE_SIZE}개 더 보기`}
        </button>
      )}

      <ConfirmDialog open={pending?.kind === 'delete'} onClose={() => setPending(null)}
        onConfirm={() => { if (pending) act.deleteComment.mutate(pending.c.id, { onSuccess: () => onToast({ title: '댓글을 삭제했어요' }) }) }}
        title="댓글을 삭제할까요?" desc={pending?.hasReplies ? '달린 답글도 함께 사라지고 되돌릴 수 없어요.' : '삭제한 댓글은 되돌릴 수 없어요.'} />
      <ReportDialog open={pending?.kind === 'report'} target="댓글" onClose={() => setPending(null)}
        onConfirm={(why) => { if (pending) report.mutate({ type: 'COMMENT', id: pending.c.id, picked: why, onAlready: () => onToast(ALREADY_REPORTED_TOAST) }, { onSuccess: () => onToast(TOAST.reported) }) }} />
      {/* 00 공통 18 저장 전 취소 (댓글 수정 중 취소) */}
      <ConfirmDialog open={!!discard} onClose={() => setDiscard(null)} onConfirm={() => discard?.()}
        title="아직 저장되지 않았습니다" desc="나가면 고친 내용이 사라져요." confirmLabel="나가기" cancelLabel="계속 수정" />
    </section>
  )
}

function EditBox({ initial, onCancel, onSave }: { initial: string; onCancel: (changed: boolean) => void; onSave: (t: string) => void }) {
  const [t, setT] = useState(initial)
  const dirty = t !== initial
  // 바꾼 것이 있는데 다른 화면으로 가면(상단 메뉴 · 뒤로 가기 등) 저장 전 확인 (00 공통 18, 내 정보 수정 · 모임 · 글쓰기와 같은 방식)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)
  return (
    <>
    <ConfirmDialog open={blocker.state === 'blocked'} onClose={() => blocker.reset?.()} onConfirm={() => blocker.proceed?.()}
      title="아직 저장되지 않았습니다" desc="나가면 고친 내용이 사라져요." confirmLabel="나가기" cancelLabel="계속 수정" />
    <form className={s.editBox} onSubmit={(e) => { e.preventDefault(); if (t.trim()) onSave(t.trim()) }}>
      <textarea autoFocus value={t} maxLength={COMMENT_MAX} onChange={(e) => setT(e.target.value)} aria-label="댓글 수정"
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel(t !== initial) }} />
      <span className={s.commentFoot}>
        <small>{t.length} / {COMMENT_MAX}</small>
        <span className={s.replyBtns}>
          <button type="button" className="btn btn-line btn-sm" onClick={() => onCancel(t !== initial)}>취소</button>
          <button className="btn btn-primary btn-sm" disabled={!t.trim()}>저장</button>
        </span>
      </span>
    </form>
    </>
  )
}

function ReplyBox({ to, busy, onCancel, onSubmit }: { to: string; busy: boolean; onCancel: () => void; onSubmit: (t: string) => void }) {
  const [t, setT] = useState('')
  const send = () => { if (t.trim() && !busy) onSubmit(t.trim()) }
  return (
    <form className={s.replyForm} onSubmit={(e) => { e.preventDefault(); send() }}>
      <span className={s.replyTarget}>↳ {to}님에게 답글</span>
      <textarea autoFocus value={t} maxLength={COMMENT_MAX} onChange={(e) => setT(e.target.value)} placeholder="답글 남기기" aria-label={`${to}님에게 답글`}
        onKeyDown={(e) => { if (e.key === 'Escape' && !t) onCancel(); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send() } }} />
      <span className={s.commentFoot}>
        <small>{t.length} / {COMMENT_MAX}</small>
        <span className={s.replyBtns}>
          <button type="button" className="btn btn-line btn-sm" onClick={onCancel}>취소</button>
          <button className="btn btn-primary btn-sm" disabled={!t.trim() || busy}>등록</button>
        </span>
      </span>
    </form>
  )
}
