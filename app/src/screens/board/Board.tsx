import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import Footer from '../../components/Footer'
import InterestChip from '../../components/InterestChip'
import Pagination from '../../components/Pagination'
import { ChatIcon, ChevronRight, EyeIcon, HeartIcon, PenIcon, PlusIcon, SearchIcon } from '../../components/Icons'
import { ConfirmDialog, ReportDialog, Toast } from '../../components/Feedback'
import { POSTS, categoryOf, toneOf, userOf } from '../../data/mock'
import type { Comment, PostCategory } from '../../data/types'
import s from './Board.module.css'

const CATS: ('전체' | PostCategory)[] = ['전체', '자유', '정보', '질문', '모임 후기']
const PAGE = 5

/** 내가 저장한 글 (목 데이터) */
const SAVED_IDS = ['p3', 'p1', 'p4', 'p2', 'p5', 'p7']
const SAVED_AT: Record<string, string> = { p3: '11월 9일 저장', p1: '11월 8일 저장', p4: '11월 6일 저장', p2: '11월 5일 저장', p5: '11월 3일 저장', p7: '11월 1일 저장' }

/**
 * 커뮤니티 (Desktop) 494:12708 — 2026-11-11 스크린샷 대조: 오른쪽에 "내 활동"(내가 쓴 글·댓글 단 글·저장한 글) 추가,
 * 제목은 나무 팻말, 글쓰기 버튼은 주황(CTA)
 * 저장한 글 560:7370 도 같은 틀을 쓴다 (saved)
 */
export function BoardList({ saved }: { saved?: boolean } = {}) {
  const [cat, setCat] = useState<(typeof CATS)[number]>('전체')
  const [sort, setSort] = useState<'최신순' | '조회수순' | '인기순'>('최신순')
  const [q, setQ] = useState('')
  const [interest, setInterest] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const list = useMemo(() => {
    const base = saved ? SAVED_IDS.map((id) => POSTS.find((p) => p.id === id)!).filter(Boolean) : POSTS
    let l = base.filter((p) => (cat === '전체' || p.category === cat) && (!interest || p.interest === interest))
    if (q) l = l.filter((p) => p.title.includes(q) || p.body.join(' ').includes(q))
    if (sort === '인기순') l = [...l].sort((a, b) => b.likes - a.likes)
    if (sort === '조회수순') l = [...l].sort((a, b) => b.views - a.views)
    return l
  }, [cat, sort, q, interest, saved])
  const hot = [...POSTS].sort((a, b) => b.views - a.views).slice(0, 5)
  const total = Math.max(1, Math.ceil(list.length / PAGE))

  return (
    <div className={s.wrap}>
      <div className={s.layout}>
        <section className={s.board}>
          <h1 className="page-sign">{saved ? '저장한 글' : '게시판'}</h1>
          <div className={s.filterBar}>
            <div className={s.cats} role="tablist">
              {CATS.map((c) => <button key={c} role="tab" aria-selected={cat === c} className={cat === c ? s.catOn : s.cat} onClick={() => { setCat(c); setPage(1) }}>{c}</button>)}
            </div>
            {interest && <button className={s.clearInterest} onClick={() => setInterest(null)}>#{interest} ✕</button>}
            <select className={s.sort} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="정렬">
              <option>최신순</option><option>조회수순</option><option>인기순</option>
            </select>
          </div>
          <ul className={s.posts}>
            {list.slice((page - 1) * PAGE, page * PAGE).map((p) => (
              <li key={p.id}>
                {/* Figma: Post Item (820×140) + Post Thumb (120×100) */}
                <Link to={`/board/${p.id}`} className={s.post}>
                  {/* 2026-11-11 Figma 494:12708: 말머리 알약 → 제목 → 본문 한 줄 → 닉네임·시간·관심사 칩, 오른쪽 아래 댓글·좋아요 */}
                  <div className={s.postBody}>
                    <span className={`${s.postCatPill} ${s['pc' + CATS.indexOf(p.category)]}`}>{p.category}</span>
                    <strong>{p.title}</strong>
                    <p>{p.body[0]}</p>
                    <span className={s.postMeta}>
                      <span className={s.nick}>{userOf(p.authorId).nickname}</span><span>{p.createdAt}</span><InterestChip label={p.interest} />
                      {saved && <span className={s.savedAt}>· {SAVED_AT[p.id]} <BookmarkIcon /></span>}
                    </span>
                  </div>
                  <div className={s.postRight}>
                    {p.hasPhoto && <div className={s.thumb} style={{ background: `var(--tone-${toneOf(p.interest)}-bg)` }} aria-hidden>{categoryOf(p.interest)?.emoji}</div>}
                    <span className={s.counts}><span><ChatIcon size={13} /> {p.comments.length}</span><span><HeartIcon size={13} /> {p.likes}</span>{sort === '조회수순' && <span><EyeIcon size={13} /> {p.views}</span>}</span>
                  </div>
                </Link>
              </li>
            ))}
            {list.length === 0 && <li className={s.none}>아직 글이 없어요. 첫 글을 남겨보세요.</li>}
          </ul>
          <div className={s.pager}><Pagination page={page} total={total} onChange={setPage} /></div>
        </section>

        <aside className={s.side}>
          <label className={s.search}><SearchIcon size={18} /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder={saved ? '저장한 글에서 검색' : '키워드 검색'} /></label>
          <div className={s.widget}>
            <h2 className="display">이번 주 인기 글</h2>
            <ol className={s.hot}>
              {hot.map((p, i) => <li key={p.id}><span>{i + 1}</span><Link to={`/board/${p.id}`}>{p.title}</Link></li>)}
            </ol>
          </div>
          <div className={s.widget}>
            <h2 className="display">관심사 별로 보기</h2>
            <div className={s.interestGrid}>
              {[...new Set(POSTS.map((p) => p.interest))].map((x) => (
                <button key={x} onClick={() => { setInterest(x); setPage(1) }} className={interest === x ? s.iOn : s.i}><InterestChip label={x} /></button>
              ))}
            </div>
          </div>
          <div className={s.widget}>
            <h2 className="display">내 활동</h2>
            <ul className={s.activity}>
              <li><button><span>내가 쓴 글</span><em>12</em><ChevronRight size={16} /></button></li>
              <li><button><span>댓글 단 글</span><em>34</em><ChevronRight size={16} /></button></li>
              <li><Link to="/board/saved" className={saved ? s.activityOn : undefined}><span>저장한 글</span><em>{SAVED_IDS.length}</em><ChevronRight size={16} /></Link></li>
            </ul>
          </div>
          <Link to="/board/write" className="btn btn-cta btn-block"><PenIcon size={16} /> 글쓰기</Link>
        </aside>
      </div>
      <Footer />
    </div>
  )
}

/**
 * 커뮤니티 – 글 상세 A안 494:13028 (기본) / B안 494:13242 (?v=b)
 * A안: 댓글이 본문 오른쪽 패널(419px)에 붙어 있음. 이전 글 / 다음 글은 본문 아래
 * B안: 댓글이 본문 아래, 이전 글 / 다음 글은 댓글 아래. 투표 중 ("게시글 댓글창 투표 해주세요(왼 오)")
 */
export function BoardPost() {
  const { postId = '' } = useParams()
  const [params] = useSearchParams()
  const variant = params.get('v') === 'b' ? 'b' : 'a'
  const idx = POSTS.findIndex((p) => p.id === postId)
  const p = POSTS[idx]
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [comments, setComments] = useState<Comment[]>(p?.comments ?? [])
  const [draft, setDraft] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialog, setDialog] = useState<'delete' | 'report' | null>(params.get('modal') === 'delete' ? 'delete' : params.get('modal') === 'report' ? 'report' : null)
  const [toast, setToast] = useState<string | null>(null)
  const nav2 = useNavigate()
  if (!p) return <Navigate to="/board" replace />
  const author = userOf(p.authorId)
  const prev = POSTS[idx + 1]
  const next = POSTS[idx - 1]
  const count = comments.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0) + (p.id === 'p1' ? 16 : 0)
  const side = variant === 'a'

  const submit = () => {
    if (!draft.trim()) return
    setComments((l) => [...l, { id: `c${Date.now()}`, authorId: 'me', text: draft.trim(), createdAt: '방금', likes: 0 }])
    setDraft('')
  }

  const nav = (
    <div className={s.prevNext}>
      {prev ? <Link to={`/board/${prev.id}${variant === 'b' ? '?v=b' : ''}`}><span>이전 글</span>{prev.title}</Link> : <span />}
      {next ? <Link to={`/board/${next.id}${variant === 'b' ? '?v=b' : ''}`} className={s.next}><span>다음 글</span>{next.title}</Link> : <span />}
    </div>
  )

  const article = (
    <>
      <span className={s.postCat}>{p.category}</span>
      <h1 className="display">{p.title}</h1>
      <div className={s.byline}>
        <Avatar size={36} />
        <Link to={`/burrow/${author.id}`}><strong>{author.nickname}</strong></Link>
        <span>{p.createdAt}</span><span>·</span><span><EyeIcon size={14} /> {p.views}</span>
        {/* 더보기: 게시물 삭제 610:12231 · 신고 610:12558 확인 팝업 */}
        <span className={s.more}>
          <button aria-label="더보기" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>⋯</button>
          {menuOpen && (
            <span className={s.moreMenu} role="menu">
              <button role="menuitem" onClick={() => { setMenuOpen(false); setDialog('delete') }}>삭제하기</button>
              <button role="menuitem" onClick={() => { setMenuOpen(false); setDialog('report') }}>신고하기</button>
            </span>
          )}
        </span>
      </div>
      <div className={s.content}>
        <p>{p.body[0]}</p>
        {p.hasPhoto && <div className={s.photo} style={{ background: `var(--tone-${toneOf(p.interest)}-bg)` }}>사진 영역 · 글쓴이가 올린 사진</div>}
        {p.body.slice(1).map((b, i) => <p key={i}>{b}</p>)}
      </div>
      <div className={s.reactions}>
        <button className={liked ? s.reactOn : s.react} onClick={() => setLiked((v) => !v)} aria-pressed={liked}><HeartIcon size={16} /> 좋아요 {p.likes + (liked ? 1 : 0)}</button>
        <button className={saved ? s.reactOn : s.react} onClick={() => setSaved((v) => !v)} aria-pressed={saved}>저장</button>
        <button className={s.react}>공유</button>
      </div>
    </>
  )

  const commentSection = (
    <section className={side ? `${s.comments} ${s.commentsSide}` : s.comments} aria-label="댓글">
      <h2 className={`display ${s.cHead}`}><ChatIcon size={18} /> 댓글 <span>{count}</span></h2>
      {comments.length > 0 ? (
        <ul className={s.cList}>
          {comments.map((c) => (
            <li key={c.id}>
              <CommentRow c={c} />
              {c.replies?.map((r) => <div key={r.id} className={s.reply}><CommentRow c={r} /></div>)}
            </li>
          ))}
        </ul>
      ) : (
        <div className={s.cEmpty}>
          <span className={s.cHole} aria-hidden />
          <strong className="display">아직 댓글이 없어요</strong>
          <p>글 속 이야기 하나를 골라 첫 댓글로 말을 걸어보세요.</p>
        </div>
      )}
      <form className={s.commentForm} onSubmit={(e) => { e.preventDefault(); submit() }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() } }}
          placeholder="따뜻한 댓글을 남겨주세요"
          aria-label="댓글 입력"
        />
        <button className="btn btn-primary btn-sm" disabled={!draft.trim()}>등록</button>
      </form>
    </section>
  )

  return (
    <div className={s.wrap}>
      {side ? (
        <div className={s.detailA}>
          <Link to="/board" className={s.backLink}>&lt; 게시판 돌아가기</Link>
          <div className={s.detailCols}>
            <div className={s.mainA}>
              <article className={s.articleCard}>{article}</article>
              {nav}
            </div>
            {commentSection}
          </div>
        </div>
      ) : (
        <article className={s.article}>
          <Link to="/board" className={s.backLink}>&lt; 게시판 돌아가기</Link>
          {article}
          {commentSection}
          {nav}
        </article>
      )}
      <Footer />
      <ConfirmDialog open={dialog === 'delete'} onClose={() => setDialog(null)} onConfirm={() => nav2('/board')}
        title="게시물을 삭제할까요?" desc="게시물에 달린 댓글과 답글도 함께 사라지고 되돌릴 수 없어요." />
      <ReportDialog open={dialog === 'report'} onClose={() => setDialog(null)} onConfirm={() => setToast('신고가 접수되었어요')} />
      <Toast open={!!toast} title={toast ?? ''} desc="검토 후 처리 결과를 알림으로 알려드릴게요" onClose={() => setToast(null)} />
    </div>
  )
}

function CommentRow({ c }: { c: Comment }) {
  const u = userOf(c.authorId)
  return (
    <div className={s.comment}>
      <Avatar size={32} />
      <div>
        <p className={s.cMeta}><strong>{u.nickname}</strong>{c.isAuthor && <em>글쓴이</em>}<span>{c.createdAt}</span></p>
        <p className={s.cText}>{c.text}</p>
        <p className={s.cActions}><button><HeartIcon size={13} /> {c.likes}</button><button>답글 달기</button></p>
      </div>
    </div>
  )
}

function BookmarkIcon() {
  return <svg width="11" height="13" viewBox="0 0 11 13" aria-label="저장됨"><path d="M1 1h9v11L5.5 9 1 12z" fill="currentColor" /></svg>
}

const DRAFTS = [
  { id: 'd1', title: '보드게임 처음 시작할 때 추천하는 다섯 가지', at: '11월 9일 저장' },
  { id: 'd2', title: '성수동 근처 조용한 카페 정리', at: '11월 4일 저장' },
]
const WRITE_TAGS = ['캠핑', '여행', '러닝', '보드게임', '독서', '요리', '사진']
const TITLE_MAX = 50
const BODY_MAX = 1000   // Figma 메모: 게시판 글자수 제한 1000자로 통일
const PHOTO_MAX = 5
const TAG_MAX = 3

/**
 * 커뮤니티 – 글쓰기 (Desktop) 559:7299 — 2026-11-11 추가, 스크린샷 대조함
 * 말머리 4종, 제목 50자, 내용 1000자, 사진 5장(첫 장이 대표), 관심사 태그 최대 3개, 오른쪽 임시저장한 글
 */
export function BoardWrite() {
  const nav = useNavigate()
  const [cat, setCat] = useState<PostCategory>('모임 후기')
  const [title, setTitle] = useState('첫 캠핑 모임 다녀왔어요!')
  const [body, setBody] = useState('지난 주말 가평으로 첫 캠핑 모임을 다녀왔어요. 다섯 명 중 세 명이 캠핑이 처음이라 텐트 치는 데만 한 시간이 걸렸지만, 다 같이 헤매는 게 오히려 재밌었어요.\n\n밤에는 불 앞에 둘러앉아서 각자 땅굴에 둔 가구 이야기를 했는데, 처음 만난 사이인데도 이야기가 끊이지 않더라고요.')
  const [photos, setPhotos] = useState(['sage', 'clay'])
  const [tags, setTags] = useState(['캠핑', '여행'])
  const [toast, setToast] = useState<string | null>(null)
  const toggleTag = (t: string) => setTags((l) => (l.includes(t) ? l.filter((x) => x !== t) : l.length >= TAG_MAX ? l : [...l, t]))

  return (
    <div className={s.wrap}>
      <div className={s.writeLayout}>
        <section className={s.writeMain}>
          <Link to="/board" className={s.backLink}>&lt; 게시판 돌아가기</Link>
          <h1 className={`display ${s.writeTitle}`}>글쓰기</h1>

          <p className={s.writeLabel}>말머리</p>
          <div className={s.cats}>
            {(['자유', '정보', '질문', '모임 후기'] as PostCategory[]).map((c) => (
              <button key={c} className={cat === c ? s.catOn : s.cat} onClick={() => setCat(c)} aria-pressed={cat === c}>{c}</button>
            ))}
          </div>

          <label className={s.writeLabel} htmlFor="w-title">제목</label>
          <div className={s.writeBox}>
            <input id="w-title" value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="제목을 입력해 주세요" />
            <span>{title.length} / {TITLE_MAX}</span>
          </div>

          <label className={s.writeLabel} htmlFor="w-body">내용</label>
          <div className={`${s.writeBox} ${s.writeArea}`}>
            <textarea id="w-body" value={body} maxLength={BODY_MAX} onChange={(e) => setBody(e.target.value)} placeholder="관심사 이야기를 편하게 나눠 주세요" />
            <span>{body.length} / {BODY_MAX}</span>
          </div>

          <p className={s.writeLabel}>사진 <em>{photos.length} / {PHOTO_MAX}</em> <small>첫 번째 사진이 대표 사진이 돼요</small></p>
          <div className={s.photos}>
            {photos.map((tone, i) => (
              <div key={i} className={s.photoSlot} style={{ background: `var(--tone-${tone}-bg)` }}>
                <span aria-hidden>⛺</span>
                {i === 0 && <em>대표</em>}
                <button aria-label={`사진 ${i + 1} 빼기`} onClick={() => setPhotos((l) => l.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            {photos.length < PHOTO_MAX && (
              <button className={s.photoAdd} onClick={() => setPhotos((l) => [...l, ['butter', 'sky', 'mint'][l.length % 3]])}><PlusIcon size={16} /><span>사진 추가</span></button>
            )}
          </div>

          <p className={s.writeLabel}>관심사 태그 <small>최대 {TAG_MAX}개</small></p>
          <div className={s.cats}>
            {WRITE_TAGS.map((t) => {
              const on = tags.includes(t)
              return (
                <button key={t} className={on ? s.tagPickOn : s.tagPick} onClick={() => toggleTag(t)} aria-pressed={on}
                  style={on ? undefined : { background: `var(--tone-${toneOf(t)}-bg)`, color: `var(--tone-${toneOf(t)}-fg)` }}>
                  {on && '✓ '}{t}
                </button>
              )
            })}
          </div>

          <div className={s.writeActions}>
            <button className="btn btn-line" onClick={() => nav('/board')}>취소</button>
            <button className="btn btn-line" onClick={() => setToast('임시저장했어요')}>임시저장</button>
            <button className="btn btn-cta" disabled={!title.trim() || !body.trim()} onClick={() => nav('/board/p1')}>등록하기</button>
          </div>
        </section>

        <aside className={s.side}>
          <div className={s.widget}>
            <h2 className="display">임시저장한 글 <span className={s.accentNum}>{DRAFTS.length}</span></h2>
            <ul className={s.drafts}>
              {DRAFTS.map((d) => (
                <li key={d.id}><button onClick={() => setTitle(d.title)}><span><strong>{d.title}</strong><small>{d.at}</small></span><ChevronRight size={16} /></button></li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
      <Footer />
      <Toast open={!!toast} title={toast ?? ''} onClose={() => setToast(null)} />
    </div>
  )
}

export function BoardSaved() {
  return <BoardList saved />
}
