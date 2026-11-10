import { useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import Footer from '../../components/Footer'
import InterestChip from '../../components/InterestChip'
import Pagination from '../../components/Pagination'
import { ChatIcon, EyeIcon, HeartIcon, PenIcon, SearchIcon } from '../../components/Icons'
import { CATEGORIES, POSTS, toneOf, userOf } from '../../data/mock'
import type { Comment, PostCategory } from '../../data/types'
import s from './Board.module.css'

const CATS: ('전체' | PostCategory)[] = ['전체', '자유', '정보', '질문', '모임 후기']
const PAGE = 5

/** 커뮤니티 (Desktop) 494:12708 — 메타데이터 기반, 스크린샷 대조 필요 */
export function BoardList() {
  const [cat, setCat] = useState<(typeof CATS)[number]>('전체')
  const [sort, setSort] = useState<'최신순' | '인기순'>('최신순')
  const [q, setQ] = useState('')
  const [interest, setInterest] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const list = useMemo(() => {
    let l = POSTS.filter((p) => (cat === '전체' || p.category === cat) && (!interest || p.interest === interest))
    if (q) l = l.filter((p) => p.title.includes(q) || p.body.join(' ').includes(q))
    if (sort === '인기순') l = [...l].sort((a, b) => b.likes - a.likes)
    return l
  }, [cat, sort, q, interest])
  const hot = [...POSTS].sort((a, b) => b.views - a.views).slice(0, 5)
  const total = Math.max(1, Math.ceil(list.length / PAGE))

  return (
    <div className={s.wrap}>
      <div className={s.layout}>
        <section className={s.board}>
          <h1 className="display">게시판</h1>
          <div className={s.filterBar}>
            <div className={s.cats} role="tablist">
              {CATS.map((c) => <button key={c} role="tab" aria-selected={cat === c} className={cat === c ? s.catOn : s.cat} onClick={() => { setCat(c); setPage(1) }}>{c}</button>)}
            </div>
            {interest && <button className={s.clearInterest} onClick={() => setInterest(null)}>#{interest} ✕</button>}
            <select className={s.sort} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="정렬">
              <option>최신순</option><option>인기순</option>
            </select>
          </div>
          <ul className={s.posts}>
            {list.slice((page - 1) * PAGE, page * PAGE).map((p) => (
              <li key={p.id}>
                {/* Figma: Post Item (820×140) + Post Thumb (120×100) */}
                <Link to={`/board/${p.id}`} className={s.post}>
                  <div className={s.postBody}>
                    <span className={s.postCat}>{p.category} · <InterestChip label={p.interest} /></span>
                    <strong>{p.title}</strong>
                    <p>{p.body[0]}</p>
                    <span className={s.postMeta}>
                      <span>{userOf(p.authorId).nickname}</span><span>{p.createdAt}</span>
                      <span><EyeIcon size={14} /> {p.views}</span><span><HeartIcon size={14} /> {p.likes}</span><span><ChatIcon size={14} /> {p.comments.length}</span>
                    </span>
                  </div>
                  {p.hasPhoto && <div className={s.thumb} style={{ background: `var(--tone-${toneOf(p.interest)}-bg)` }} aria-hidden>{CATEGORIES.find((c) => c.tags.some((t) => t.name === p.interest))?.emoji}</div>}
                </Link>
              </li>
            ))}
            {list.length === 0 && <li className={s.none}>아직 글이 없어요. 첫 글을 남겨보세요.</li>}
          </ul>
          <div className={s.pager}><Pagination page={page} total={total} onChange={setPage} /></div>
        </section>

        <aside className={s.side}>
          <label className={s.search}><SearchIcon size={18} /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="키워드 검색" /></label>
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
          {/* TODO: 글쓰기 페이지 디자인 없음 (라벨 메모) */}
          <button className="btn btn-primary btn-block"><PenIcon size={16} /> 글쓰기</button>
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
