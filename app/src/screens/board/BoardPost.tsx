import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import Footer from '../../components/Footer'
import InterestChip from '../../components/InterestChip'
import ProfilePopup from '../../components/ProfilePopup'
import { ConfirmDialog, ReportDialog, TOAST, Toast, type ToastSpec } from '../../components/Feedback'
import { CalendarIcon, ChatIcon, ChevronLeft, ChevronRight, HomeIcon } from '../../components/Icons'
import { ME_ID, USERS, toneOf } from '../../data/mock'
import { getMyInterests } from '../../data/interests'
import {
  COMMENT_MAX, COMMENT_PAGE, ago, bigOf, commentCount, dateLabel, isGone, isMine, likesOf, meetupWhen, nickOf,
  type BoardComment,
} from '../../data/boardStore'
import {
  BookmarkIcon, CatPill, GonePage, HeartFill, MoreMenu, POST_DELETED_TOAST, SAVE_TOAST, ShareIcon, UNSAVE_TOAST, Who, affLine,
  useArrivalToast, type MenuItem,
} from './parts'
import s from './Board.module.css'
import { api, isApiError } from '../../api'
import type { BoardPostVM } from '../../api/mappers'
import { patch, useOptimistic, usePostDetail, usePostList } from '../../api/queries'
import { qk } from '../../api/queryClient'
import { reportBody } from '../../api/reports'
import { DetailSkeleton, ErrorState, QueryGate } from '../../components/AsyncState'

type Post = BoardPostVM

const ALREADY: ToastSpec = { title: '이미 신고했어요' }

/**
 * 커뮤니티 – 글 상세 (Desktop) · 확정(시안 B) — Figma 02 F8-04 1~17
 * 대표 사진(폭 전체) → 왼쪽 액션 레일(따라옴) + 가운데 본문 카드(댓글 포함) → 다음 읽을 글 → 푸터
 */
export function BoardPost() {
  const { postId = '' } = useParams()
  const { hash } = useLocation()
  // 서버에서 받기 (api/queries). 로딩 · 오류(다시 시도) · 진짜 없음(404) 을 나눠 그림 → 위험 B1
  const q = usePostDetail(postId)
  // 조회수: 글을 열 때 한 번 (같은 사람 중복은 서버가 거름). 특정 댓글로 오면(#댓글id) 댓글 쪽에서 스크롤하므로 맨 위로 올리지 않음
  useEffect(() => { api.board.view(postId).catch(() => {}); if (!hash) window.scrollTo(0, 0) }, [postId]) // eslint-disable-line react-hooks/exhaustive-deps

  // 404 = 없거나 삭제된 글, 403 POST_HIDDEN = 신고로 가려진 남의 글
  return (
    <QueryGate q={q} skeleton={<DetailSkeleton label="글을 불러오는 중" />}
      notFound={<GonePage message="삭제된 글이에요" />}
      error={(retry, e) => (isApiError(e) && e.code === 'POST_HIDDEN'
        ? <GonePage message="신고로 가려진 글이에요" />
        : <div className={s.wrap}><ErrorState error={e} onRetry={retry} retrying={q.isFetching} title="글을 불러오지 못했어요" /></div>)}>
      {(p) => (p.status === 'deleted' ? <GonePage message="삭제된 글이에요" /> : <PostView key={p.id} p={p} />)}
    </QueryGate>
  )
}

/** 글 · 댓글 쓰기: 캐시를 먼저 바꾸고(낙관적) 실패하면 되돌림 + 오류 토스트 (api/queries useOptimistic) */
function usePostActions(p: Post, onToast: (t: ToastSpec | null) => void) {
  const run = useOptimistic()
  const key = qk.post(p.id)
  const edit = (f: (o: Post) => Post) => patch<Post>(key, f)
  const mapC = (f: (l: BoardComment[]) => BoardComment[]) => edit((o) => ({ ...o, comments: f(o.comments) }))
  const mapOne = (cid: string, f: (c: BoardComment) => BoardComment) =>
    mapC((l) => l.map((c) => (c.id === cid ? f(c) : { ...c, replies: c.replies.map((r) => (r.id === cid ? f(r) : r)) })))
  const temp = (text: string, mention?: string): BoardComment => ({ id: `tmp-${Date.now()}`, authorId: ME_ID, text, mention, at: Date.now(), likes: 0, status: 'public', reports: 0, replies: [] })
  const all = [qk.posts]
  return {
    like: () => { const on = !p.liked; run.mutate({ call: () => api.board.setLike(p.id, on), patches: [edit((o) => ({ ...o, liked: on }))], invalidate: all, errorTitle: '좋아요를 반영하지 못했어요' }) },
    save: () => {
      const on = !p.savedAt
      onToast(on ? SAVE_TOAST : UNSAVE_TOAST)
      run.mutate({ call: () => api.board.setBookmark(p.id, on), patches: [edit((o) => ({ ...o, savedAt: on ? Date.now() : undefined }))], invalidate: all, errorTitle: on ? '글을 저장하지 못했어요' : '저장을 취소하지 못했어요' }, { onError: () => onToast(null) })
    },
    remove: (then: () => void) => run.mutate({ call: () => api.board.remove(p.id), invalidate: all, errorTitle: '게시물을 삭제하지 못했어요' }, { onSuccess: then }),
    report: (why: string) => run.mutate({
      call: () => { const b = reportBody('POST', p.id, why); return api.board.report(p.id, b.reason, b.detail) },
      patches: [edit((o) => ({ ...o, reportedByMe: true }))], invalidate: all, errorTitle: '신고를 접수하지 못했어요',
    }, { onSuccess: () => onToast(TOAST.reported) }),
    comment: (text: string) => run.mutate({ call: () => api.board.addComment(p.id, { content: text }), patches: [mapC((l) => [...l, temp(text)])], invalidate: all, errorTitle: '댓글을 등록하지 못했어요' }),
    reply: (parentId: string, text: string, mention?: string) => run.mutate({
      call: () => api.board.addComment(p.id, { content: text, parentId, mentionNickname: mention ?? null, mentionMemberId: mention ? Object.values(USERS).find((u) => u.nickname === mention)?.id ?? null : null }),
      patches: [mapC((l) => l.map((c) => (c.id === parentId ? { ...c, replies: [...c.replies, temp(text, mention)] } : c)))], invalidate: all, errorTitle: '답글을 등록하지 못했어요',
    }),
    editComment: (cid: string, text: string) => run.mutate({ call: () => api.board.editComment(p.id, cid, text), patches: [mapOne(cid, (c) => ({ ...c, text, editedAt: Date.now() }))], invalidate: all, errorTitle: '댓글을 고치지 못했어요' }),
    deleteComment: (cid: string) => run.mutate({
      call: () => api.board.deleteComment(p.id, cid), invalidate: all, errorTitle: '댓글을 삭제하지 못했어요',
      patches: [mapC((l) => l.filter((c) => c.id !== cid).map((c) => ({ ...c, replies: c.replies.filter((r) => r.id !== cid) })))],
    }, { onSuccess: () => onToast({ title: '댓글을 삭제했어요' }) }),
    likeComment: (c: BoardComment) => { const on = !c.liked; run.mutate({ call: () => api.board.setCommentLike(p.id, c.id, on), patches: [mapOne(c.id, (x) => ({ ...x, liked: on }))], invalidate: all, errorTitle: '좋아요를 반영하지 못했어요' }) },
    reportComment: (cid: string, why: string) => run.mutate({
      call: () => { const b = reportBody('COMMENT', cid, why); return api.board.reportComment(cid, b.reason, b.detail) },
      patches: [mapOne(cid, (x) => ({ ...x, reportedByMe: true }))], invalidate: all, errorTitle: '신고를 접수하지 못했어요',
    }, { onSuccess: () => onToast(TOAST.reported) }),
  }
}
type PostActions = ReturnType<typeof usePostActions>

function PostView({ p }: { p: Post }) {
  const nav = useNavigate()
  const loc = useLocation()
  const mine = isMine(p)
  const hidden = p.status === 'hidden'
  const [toast, setToast] = useArrivalToast()
  const [dialog, setDialog] = useState<'delete' | 'report' | null>(null)
  const [unfold, setUnfold] = useState(false)
  const [profile, setProfile] = useState<string | null>(null)
  const commentsRef = useRef<HTMLElement>(null)
  const myPicks = getMyInterests(USERS[ME_ID].interests)
  const authorPicks = isGone(p.authorId) ? [] : USERS[p.authorId].interests
  const overlap = mine ? [] : authorPicks.filter((i) => myPicks.includes(i))
  const card = p.meetupCard
  const meetup = card?.meetup
  const main = p.interests[0]
  // 다음 읽을 글: 같은 대분류 인기 글 3개 (목록 API 재사용. 실패하면 이 칸만 안 보임)
  const related = usePostList({ interest: main, sort: 'POPULAR', size: 4 }, !!main)
  const next = useMemo(() => (related.data?.items ?? []).filter((x) => x.id !== p.id).slice(0, 3), [related.data, p.id])
  const act = usePostActions(p, (t) => setToast(t))
  const folded = p.reportedByMe && !unfold && !hidden

  const menu: MenuItem[] = mine
    ? [...(hidden ? [] : [{ label: '수정', onClick: () => nav(`/board/${p.id}/edit`) }]), { label: '삭제', danger: true, onClick: () => setDialog('delete') }]
    : [{ label: '신고', danger: true, onClick: () => (p.reportedByMe ? setToast(ALREADY) : setDialog('report')) }]

  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setToast({ title: '링크를 복사했어요', desc: '붙여 넣어 글을 나눠 보세요' }) }
    catch { setToast({ title: '링크를 복사하지 못했어요', desc: '주소창의 주소를 복사해 주세요' }) }
  }
  const hero = p.photos[0]

  return (
    <div className={s.wrap}>
      {/* 2 대표 사진: 첫 사진을 폭 전체로, 없으면 관심사 일러스트 */}
      <div className={hero ? s.heroPhoto : s.hero} style={hero ? { background: `var(--tone-${hero.tone}-bg)` } : undefined}>
        {hero?.url ? <img src={hero.url} alt="" /> : hero ? <span className={s.heroLabel}>사진 영역 · 글쓴이가 올린 대표 사진</span> : (
          <span className={s.heroArt} aria-hidden><span>{bigOf(main ?? '')?.emoji ?? '🌱'}</span></span>
        )}
      </div>

      <div className={s.detail}>
        {/* 3 액션 레일: 좋아요 · 댓글 · 저장 · 공유. 스크롤해도 따라옴 */}
        <nav className={s.rail} aria-label="글 반응">
          <button type="button" className={p.liked ? s.railOn : undefined} aria-pressed={!!p.liked} onClick={act.like} disabled={hidden}>
            <span><HeartFill on={p.liked} size={18} /></span><em>{likesOf(p)}</em>
          </button>
          <button type="button" onClick={() => commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            <span><ChatIcon size={18} /></span><em>{commentCount(p)}</em>
          </button>
          <button type="button" className={p.savedAt ? s.railOn : undefined} aria-pressed={!!p.savedAt} disabled={hidden}
            onClick={act.save}>
            <span><BookmarkIcon on={!!p.savedAt} size={18} /></span><em>저장</em>
          </button>
          <button type="button" onClick={share} disabled={hidden}><span><ShareIcon /></span><em>공유</em></button>
        </nav>

        <article className={s.paper}>
          {hidden && (
            <p className={s.hiddenNote}>신고로 가려진 글이에요. 다른 사람에게는 보이지 않고, 수정할 수 없어요. 열어 보거나 삭제할 수는 있어요.</p>
          )}
          {/* 4 위치 · 카테고리 */}
          <p className={s.crumb}>
            <Link to="/board"><ChevronLeft size={14} /> 커뮤니티</Link>
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
                <Who id={p.authorId} onOpen={setProfile} className={s.authorAva}><Avatar size={40} empty={isGone(p.authorId)} /></Who>
                <div className={s.authorText}>
                  <p className={s.authorName}>
                    <Who id={p.authorId} onOpen={setProfile} className={s.authorNick} />
                    {overlap.map((i) => <InterestChip key={i} label={`✓ ${i}`} tone={toneOf(i)} shared />)}
                  </p>
                  <p className={s.authorSub}>
                    {[affLine(p.authorId), dateLabel(p.at)].filter(Boolean).join(' · ')}
                    {p.editedAt && <span className={s.edited}>수정됨</span>}
                    {` · 조회 ${p.views}`}
                    {overlap.length > 0 && ` · 나와 겹치는 관심사 ${overlap.length}개`}
                  </p>
                </div>
                {!mine && !isGone(p.authorId) && (
                  <Link to={`/burrow/${p.authorId}`} className={s.visit}><HomeIcon size={15} /> 땅굴 놀러 가기</Link>
                )}
                <MoreMenu items={menu} label="작성자 더보기" />
              </div>
              <div className={s.body}>
                {p.body.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
              </div>
              {p.photos.length > 1 && (
                <div className={s.morePhotos}>
                  {p.photos.slice(1).map((ph, i) => (
                    <span key={i} style={{ background: `var(--tone-${ph.tone}-bg)` }}>{ph.url ? <img src={ph.url} alt={`사진 ${i + 2}`} /> : `사진 ${i + 2}`}</span>
                  ))}
                </div>
              )}
              {/* 8 글에 나온 모임 */}
              {meetup && (
                <div className={s.meetup}>
                  <span className={s.meetupSign}><span>{meetup.sign ?? meetup.title}</span></span>
                  <div className={s.meetupText}>
                    <p className={s.meetupState}>
                      {card?.recruit === 'open' ? <em className={s.recruiting}>● 모집 중</em> : <em className={s.closed}>{card?.recruit === 'cancelled' ? '취소된 모임' : card?.recruit === 'past' ? '끝난 모임' : '모집 마감'}</em>}
                      <span>글에 나온 모임</span>
                    </p>
                    <strong>{meetup.title}</strong>
                    <p className={s.meetupInfo}><span><CalendarIcon size={13} /> {meetupWhen(meetup)}</span><span>👤 {card?.confirmed} / {meetup.capacity}명</span></p>
                  </div>
                  <Link to={`/meetups/${meetup.id}`} className={`btn btn-sm ${s.meetupGo}`}>모임 보기 <ChevronRight size={14} /></Link>
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

      {/* 14 다음 읽을 글: 같은 대분류 인기 글 3개 */}
      {next.length > 0 && main && (
        <section className={s.next} aria-label="다음 읽을 글">
          <header>
            <h2 className="display">{main} 이야기 더 보기</h2>
            <Link to={`/board?interest=${encodeURIComponent(main)}`}>전체 보기</Link>
          </header>
          <ul>
            {next.map((x) => (
              <li key={x.id}>
                <Link to={`/board/${x.id}`} className={s.nextCard}>
                  <span className={s.nextArt} style={{ background: `var(--tone-${x.photos[0]?.tone ?? bigOf(main)?.tone ?? 'sand'}-bg)` }} aria-hidden>
                    {x.photos[0]?.url ? <img src={x.photos[0].url} alt="" /> : bigOf(x.interests[0] ?? '')?.emoji}
                  </span>
                  <span className={s.nextText}>
                    <em>{x.category}</em>
                    <strong>{x.title}</strong>
                    <small>댓글 {commentCount(x)} · 좋아요 {likesOf(x)}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Footer />

      <ProfilePopup user={profile ? USERS[profile] : null} onClose={() => setProfile(null)} />
      <ConfirmDialog open={dialog === 'delete'} onClose={() => setDialog(null)}
        onConfirm={() => act.remove(() => nav('/board', { state: { toast: POST_DELETED_TOAST } }))}
        title="게시물을 삭제할까요?" desc="게시물에 달린 댓글과 답글도 함께 사라지고 되돌릴 수 없어요." />
      <ReportDialog open={dialog === 'report'} target="게시물" onClose={() => setDialog(null)}
        onConfirm={act.report} />
      <Toast open={!!toast} {...(toast ?? { title: '' })} onClose={() => setToast(null)} />
    </div>
  )
}

/* ===== 댓글 (10 · 11 · 13) ===== */
type Pending = { kind: 'delete' | 'report'; c: BoardComment; hasReplies: boolean } | null

function Comments({ p, act, hash, onToast, onOpenUser, ref_ }: {
  p: Post; act: PostActions; hash: string; onToast: (t: ToastSpec) => void; onOpenUser: (id: string) => void; ref_: React.RefObject<HTMLElement | null>
}) {
  const top = p.comments.filter((c) => c.status !== 'deleted')
  // 알림·댓글 단 글에서 특정 댓글로 오면 그 댓글이 보이도록 펼침
  const target = hash ? top.findIndex((c) => c.id === hash || c.replies.some((r) => r.id === hash)) : -1
  const [shown, setShown] = useState(Math.max(COMMENT_PAGE, Math.ceil((target + 1) / COMMENT_PAGE) * COMMENT_PAGE))
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<{ parent: string; mention?: string } | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [peek, setPeek] = useState<string[]>([])
  const [discard, setDiscard] = useState<null | (() => void)>(null)
  const disabled = p.status !== 'public'

  useEffect(() => {
    if (!hash) return
    const el = document.getElementById(hash)
    if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add(s.flash) }
  }, [hash])

  const submit = () => { const t = draft.trim(); if (!t) return; act.comment(t); setDraft('') }

  const row = (c: BoardComment, parent: BoardComment) => {
    const mineC = c.authorId === ME_ID
    if (c.status === 'hidden') return <p className={s.cHidden}>신고로 가려진 댓글이에요</p>
    if (c.reportedByMe && !peek.includes(c.id)) {
      return <p className={s.cHidden}>신고한 댓글이에요 <button type="button" onClick={() => setPeek((l) => [...l, c.id])}>보기</button></p>
    }
    const items: MenuItem[] = mineC
      ? [{ label: '수정', onClick: () => { setEditing(c.id); setReplyTo(null) } }, { label: '삭제', danger: true, onClick: () => setPending({ kind: 'delete', c, hasReplies: c === parent && c.replies.some((r) => r.status !== 'deleted') }) }]
      : [{ label: '신고', danger: true, onClick: () => (c.reportedByMe ? onToast(ALREADY) : setPending({ kind: 'report', c, hasReplies: false })) }]
    return (
      <div className={s.comment}>
        <Who id={c.authorId} onOpen={onOpenUser} className={s.cAva}><Avatar size={32} empty={isGone(c.authorId)} /></Who>
        <div className={s.cMain}>
          <p className={s.cMeta}>
            <Who id={c.authorId} onOpen={onOpenUser} className={s.cNick} />
            {c.authorId === p.authorId && <em>글쓴이</em>}
            <span>{ago(c.at)}</span>
            {c.editedAt && <span className={s.edited}>수정됨</span>}
            {!disabled && <MoreMenu small items={items} label="댓글 더보기" />}
          </p>
          {editing === c.id ? (
            <EditBox initial={c.text} onCancel={(changed) => (changed ? setDiscard(() => () => setEditing(null)) : setEditing(null))}
              onSave={(t) => { act.editComment(c.id, t); setEditing(null) }} />
          ) : (
            <>
              <p className={s.cText}>{c.mention && <span className={s.mention}>@{c.mention} </span>}{c.text}</p>
              <p className={s.cActions}>
                <button type="button" className={c.liked ? s.cLiked : undefined} aria-pressed={!!c.liked} disabled={disabled || c.id.startsWith('tmp-')} onClick={() => act.likeComment(c)}>
                  <HeartFill on={c.liked} size={13} /> {c.likes + (c.liked ? 1 : 0)}
                </button>
                {!disabled && (
                  <button type="button" onClick={() => { setReplyTo({ parent: parent.id, mention: c === parent ? undefined : nickOf(c.authorId) }); setEditing(null) }}>답글</button>
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
      <h2 className={`display ${s.cHead}`}>댓글 <span>{commentCount(p)}</span></h2>
      {!disabled && (
        <form className={s.commentForm} onSubmit={(e) => { e.preventDefault(); submit() }}>
          <Avatar size={32} />
          <div className={s.commentBox}>
            <textarea value={draft} maxLength={COMMENT_MAX} onChange={(e) => setDraft(e.target.value)} placeholder="댓글 남기기" aria-label="댓글 입력"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() } }} />
            <span className={s.commentFoot}>
              <small>{draft.length} / {COMMENT_MAX}</small>
              <button className="btn btn-primary btn-sm" disabled={!draft.trim()}>등록</button>
            </span>
          </div>
        </form>
      )}
      {top.length ? (
        <ul className={s.cList}>
          {top.slice(0, shown).map((c) => (
            <li key={c.id} id={c.id}>
              {row(c, c)}
              {c.replies.filter((r) => r.status !== 'deleted').map((r) => <div key={r.id} id={r.id} className={s.reply}>{row(r, c)}</div>)}
              {replyTo?.parent === c.id && (
                <ReplyBox key={`${c.id}-${replyTo.mention ?? ''}`} to={replyTo.mention ?? nickOf(c.authorId)} onCancel={() => setReplyTo(null)}
                  onSubmit={(t) => { act.reply(c.id, t, replyTo.mention); setReplyTo(null) }} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.cEmpty}>아직 댓글이 없어요. 글 속 이야기 하나를 골라 첫 댓글로 말을 걸어 보세요.</p>
      )}
      {top.length > shown && (
        <button type="button" className={s.moreComments} onClick={() => setShown((n) => n + COMMENT_PAGE)}>
          댓글 {Math.min(COMMENT_PAGE, top.length - shown)}개 더 보기
        </button>
      )}

      <ConfirmDialog open={pending?.kind === 'delete'} onClose={() => setPending(null)}
        onConfirm={() => { if (pending) act.deleteComment(pending.c.id) }}
        title="댓글을 삭제할까요?" desc={pending?.hasReplies ? '달린 답글도 함께 사라지고 되돌릴 수 없어요.' : '삭제한 댓글은 되돌릴 수 없어요.'} />
      <ReportDialog open={pending?.kind === 'report'} target="댓글" onClose={() => setPending(null)}
        onConfirm={(why) => { if (pending) act.reportComment(pending.c.id, why) }} />
      {/* 00 공통 18 저장 전 취소 (댓글 수정 중 취소) */}
      <ConfirmDialog open={!!discard} onClose={() => setDiscard(null)} onConfirm={() => discard?.()}
        title="아직 저장되지 않았습니다" desc="나가면 고친 내용이 사라져요." confirmLabel="나가기" cancelLabel="계속 수정" />
    </section>
  )
}

function EditBox({ initial, onCancel, onSave }: { initial: string; onCancel: (changed: boolean) => void; onSave: (t: string) => void }) {
  const [t, setT] = useState(initial)
  return (
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
  )
}

function ReplyBox({ to, onCancel, onSubmit }: { to: string; onCancel: () => void; onSubmit: (t: string) => void }) {
  const [t, setT] = useState('')
  return (
    <form className={s.replyForm} onSubmit={(e) => { e.preventDefault(); if (t.trim()) onSubmit(t.trim()) }}>
      <span className={s.replyTarget}>↳ {to}님에게 답글</span>
      <textarea autoFocus value={t} maxLength={COMMENT_MAX} onChange={(e) => setT(e.target.value)} placeholder="답글 남기기" aria-label={`${to}님에게 답글`}
        onKeyDown={(e) => { if (e.key === 'Escape' && !t) onCancel(); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (t.trim()) onSubmit(t.trim()) } }} />
      <span className={s.commentFoot}>
        <small>{t.length} / {COMMENT_MAX}</small>
        <span className={s.replyBtns}>
          <button type="button" className="btn btn-line btn-sm" onClick={onCancel}>취소</button>
          <button className="btn btn-primary btn-sm" disabled={!t.trim()}>등록</button>
        </span>
      </span>
    </form>
  )
}
