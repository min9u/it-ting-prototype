import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from '@/lib/nav'
import Avatar from '../../components/Avatar'
import Footer from '../../components/Footer'
import InterestChip from '../../components/InterestChip'
import { EmptyMole, type ToastSpec } from '../../components/Feedback'
import { ChatIcon, ChevronLeft, ChevronRight, EyeIcon, HeartIcon, PenIcon, SearchIcon, CloseIcon } from '../../components/Icons'
import { CATEGORIES } from '../../data/mock'
import type { PostCategory } from '../../data/types'
import { GONE_ID, type Person } from '../../api/common'
import { useMyPostsSummary, usePostHighlights, type MyPostCardVM, type PhotoVM, type PostCardVM } from '../../api/community'
import { agoBoard, monthDay } from '../../lib/time'
import s from './Board.module.css'

/* ===== 상수 (명세 08 숫자) ===== */
export const BOARD_CATS: PostCategory[] = ['모임 홍보', '모임 후기', '자유']
/** 한 페이지 20개 */
export const PAGE_SIZE = 20
// 글자 수 제한은 lib/validation.ts 한 곳에서 (제목 50 · 본문 1000 · 댓글 300)
export { POST_TITLE_MAX as TITLE_MAX, POST_BODY_MAX as BODY_MAX, COMMENT_MAX } from '../../lib/validation'
import { RULES } from '../../lib/validation'
/** 관심사 태그 5개 · 사진 3장 · 검색어 50자 */
export const TAG_MAX = 5
export const PHOTO_MAX = 3
export const KEYWORD_MAX = RULES.searchKeyword.max
/** 관심사 대분류 12개 이름 (00 공통 5. 커뮤니티 글 태그는 대분류) */
export const BIG_INTERESTS = CATEGORIES.map((c) => c.name)
export const bigOf = (name: string) => CATEGORIES.find((c) => c.name === name)

/* ===== 시간 표기 (00 공통 8) ===== */
export const ago = (t: number) => agoBoard(t)
export const dateLabel = (t: number) => monthDay(t)

/* ===== 완료 토스트 (00 공통 16) ===== */
export const SAVE_TOAST: ToastSpec = { title: '글을 저장했어요', desc: '저장한 글에서 다시 볼 수 있어요', action: { label: '저장한 글', to: '/board/saved' } }
export const UNSAVE_TOAST: ToastSpec = { title: '저장을 취소했어요' }
export const POST_DELETED_TOAST: ToastSpec = { title: '게시물을 삭제했어요', desc: '삭제한 글은 되돌릴 수 없어요' }
export const ALREADY_REPORTED_TOAST: ToastSpec = { title: '이미 신고했어요' }

/** 화면 이동 때 넘긴 완료 토스트 (navigate state.toast) */
export function useArrivalToast() {
  const loc = useLocation()
  return useState<ToastSpec | null>(() => (loc.state as { toast?: ToastSpec } | null)?.toast ?? null)
}

/* ===== 아이콘 (이 화면에서만 씀) ===== */
export function BookmarkIcon({ on, size = 16 }: { on?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <path d="M6 4h12v16l-6-4.5L6 20z" />
    </svg>
  )
}
export function ShareIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 15V4M8 8l4-4 4 4" /><path d="M5 12v7h14v-7" />
    </svg>
  )
}
export function HeartFill({ on, size = 14 }: { on?: boolean; size?: number }) {
  return on
    ? <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="currentColor" /></svg>
    : <HeartIcon size={size} />
}

/* ===== 사람 (00 공통 4 · 15) ===== */
export const isGone = (u: Person) => u.id === GONE_ID
/** 소속: SSAFY 서울 · 16기 · 2층 (반은 쓰지 않음). 탈퇴한 사용자는 빈 값 */
export function affLine(u: Person) {
  if (isGone(u) || !u.campus) return ''
  return `SSAFY ${u.campus} · ${u.gen ?? ''}기 · ${u.floor ?? ''}층`
}

/** 닉네임 버튼: 누르면 프로필 팝업. 탈퇴한 사용자는 눌리지 않음 */
export function Who({ user, onOpen, className, children }: { user: Person; onOpen: (u: Person) => void; className?: string; children?: ReactNode }) {
  if (isGone(user)) return <span className={`${className ?? ''} ${s.gone}`}>{children ?? user.nickname}</span>
  return <button type="button" className={className} onClick={(e) => { e.stopPropagation(); onOpen(user) }}>{children ?? user.nickname}</button>
}

/* ===== 더보기(⋯) 메뉴 ===== */
export interface MenuItem { label: string; danger?: boolean; onClick: () => void }
export function MoreMenu({ items, label = '더보기', small }: { items: MenuItem[]; label?: string; small?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', off); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc) }
  }, [open])
  if (!items.length) return null
  return (
    <span className={s.more} ref={ref} onClick={(e) => e.stopPropagation()}>
      <button type="button" className={small ? s.moreBtnSm : s.moreBtn} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>⋯</button>
      {open && (
        <span className={s.moreMenu} role="menu">
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" className={it.danger ? s.menuDanger : undefined} onClick={() => { setOpen(false); it.onClick() }}>{it.label}</button>
          ))}
        </span>
      )}
    </span>
  )
}

/* ===== 카테고리 ===== */
const CAT_CLASS: Record<PostCategory, string> = { '모임 홍보': s.catPromo, '모임 후기': s.catReview, 자유: s.catFree }
export function CatPill({ cat }: { cat: PostCategory }) {
  return <span className={`${s.catPill} ${CAT_CLASS[cat]}`}>{cat}</span>
}
export function CatTabs({ value, onChange }: { value: '전체' | PostCategory; onChange: (c: '전체' | PostCategory) => void }) {
  return (
    <div className={s.tabs} role="tablist" aria-label="카테고리">
      {(['전체', ...BOARD_CATS] as const).map((c) => (
        <button key={c} type="button" role="tab" aria-selected={value === c} className={value === c ? s.tabOn : s.tab} onClick={() => onChange(c)}>{c}</button>
      ))}
    </div>
  )
}

/* ===== 글 카드 (08 커뮤니티 7, 저장한 글·내가 쓴 글·댓글 단 글 3) ===== */
/** 사진 칸 (주소가 있으면 그림, 없으면 색 칸 + 관심사 그림) */
export function Photo({ ph, interest, className, alt = '' }: { ph: PhotoVM; interest?: string; className?: string; alt?: string }) {
  return (
    <span className={className ?? s.thumb} style={{ background: `var(--tone-${ph.tone}-bg)` }} aria-hidden={alt ? undefined : true}>
      {ph.url ? <img src={ph.url} alt={alt} /> : <span>{bigOf(interest ?? '')?.emoji ?? '🌱'}</span>}
    </span>
  )
}

export function PostCard({ p, savedAt, right, below, onOpenUser }: {
  p: PostCardVM
  /** 저장한 글: "11월 9일 저장" */
  savedAt?: number | null
  /** 오른쪽 아래 끝 (저장 아이콘이나 더보기) */
  right: ReactNode
  /** 카드 아래 (댓글 단 글의 내 댓글 한 줄) */
  below?: ReactNode
  onOpenUser: (u: Person) => void
}) {
  const nav = useNavigate()
  const go = () => nav(`/board/${p.id}`)
  // 내가 신고한 글은 가려지기 전까지 나에게만 접힌 채로 (08 신고 팝업 3)
  const folded = p.reportedByMe && !p.hidden
  return (
    <li>
      <article className={s.card} role="link" tabIndex={0} aria-label={folded ? '신고한 게시물' : p.title}
        onClick={go} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) go() }}>
        <div className={s.cardMain}>
          <span className={s.cardTop}>
            <CatPill cat={p.category} />
            {p.hidden && <span className={s.hiddenBadge}>가려진 글</span>}
          </span>
          {folded ? (
            <p className={s.foldedLine}>신고한 게시물이에요. 누르면 열어 볼 수 있어요.</p>
          ) : (
            <>
              <strong className={s.cardTitle}>{p.title}</strong>
              <p className={s.cardBody}>{p.preview}</p>
            </>
          )}
          <span className={s.cardMeta}>
            <Who user={p.author} onOpen={onOpenUser} className={s.cardWho}>
              <Avatar size={20} empty={isGone(p.author)} /><span>{p.author.nickname}</span>
            </Who>
            {p.interests.map((t) => <InterestChip key={t} label={t} tone={bigOf(t)?.tone} />)}
            <span className={s.time}>{ago(p.createdAt)}</span>
            {savedAt != null && <span className={s.savedAt}>· {dateLabel(savedAt)} 저장</span>}
          </span>
          {below}
        </div>
        <div className={s.cardSide}>
          {!folded && p.thumb && <Photo ph={p.thumb} interest={p.interests[0]} />}
          <span className={s.counts}>
            <span title="댓글"><ChatIcon size={14} /> {p.comments}</span>
            <span title="좋아요"><HeartIcon size={14} /> {p.likes}</span>
            <span title="조회수"><EyeIcon size={14} /> {p.views}</span>
            {right}
          </span>
        </div>
      </article>
    </li>
  )
}

/** 카드 안 저장 아이콘: 누르면 저장을 켜고 끄며 상세로 가지 않음 */
export function SaveToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={on ? s.saveOn : s.save} aria-pressed={on} aria-label={on ? '저장 취소' : '저장'}
      onClick={(e) => { e.stopPropagation(); onToggle() }} onKeyDown={(e) => e.stopPropagation()}>
      <BookmarkIcon on={on} size={15} />
    </button>
  )
}

/** 댓글 단 글: 카드 아래 내 가장 최근 댓글 한 줄 + "외 N개" (누르면 글 상세의 그 댓글 자리로) */
export function MyCommentLine({ p }: { p: MyPostCardVM }) {
  const nav = useNavigate()
  const c = p.myLatestComment
  if (!c) return null
  return (
    <button type="button" className={s.myComment} onClick={(e) => { e.stopPropagation(); nav(`/board/${p.id}#${c.id}`) }}>
      <em>내 댓글</em><span>{c.content}</span>{p.myCommentCount > 1 && <small>외 {p.myCommentCount - 1}개</small>}
    </button>
  )
}

/* ===== 오른쪽 위젯 (GET /posts/highlights · /me/posts/summary) ===== */
export function HotWidget() {
  const q = usePostHighlights()
  const hot = q.data?.top ?? []
  return (
    <section className={s.widget} aria-label="이번 주 인기 글" aria-busy={q.isPending}>
      <h2 className="display">🔥 이번 주 인기 글</h2>
      {hot.length ? (
        <ol className={s.hot}>
          {hot.map((p) => <li key={p.id}><span>{p.rank}</span><Link to={`/board/${p.id}`}>{p.title}</Link></li>)}
        </ol>
      ) : q.isPending ? null : <p className={s.widgetEmpty}>{q.isError ? '인기 글을 불러오지 못했어요.' : '이번 주에 좋아요를 받은 글이 아직 없어요.'}</p>}
    </section>
  )
}

export function InterestWidget({ value, onPick }: { value?: string | null; onPick: (t: string | null) => void }) {
  const q = usePostHighlights()
  const list = q.data?.interests ?? []
  return (
    <section className={s.widget} aria-label="많이 이야기하는 관심사" aria-busy={q.isPending}>
      <h2 className="display">많이 이야기하는 관심사</h2>
      {list.length ? (
        <div className={s.interestGrid}>
          {list.map((t) => (
            <button key={t} type="button" aria-pressed={value === t} className={value === t ? s.iOn : s.i} onClick={() => onPick(value === t ? null : t)}>
              <InterestChip label={t} tone={bigOf(t)?.tone} />
            </button>
          ))}
        </div>
      ) : q.isPending ? null : <p className={s.widgetEmpty}>{q.isError ? '관심사를 불러오지 못했어요.' : '이번 주에 올라온 글이 아직 없어요.'}</p>}
    </section>
  )
}

export function GuideBanner() {
  return (
    <section className={s.banner} aria-label="커뮤니티 이용 안내">
      <Avatar size={40} />
      <p>모임에서 있었던 일, 궁금한 것, 소소한 이야기 다 좋아요. 마음에 드는 글쓴이가 있으면 땅굴에도 놀러 가 보세요.</p>
    </section>
  )
}

export type ActivityKind = 'mine' | 'commented' | 'saved'
export const ACTIVITY_LABEL: Record<ActivityKind, string> = { mine: '내가 쓴 글', commented: '댓글 단 글', saved: '저장한 글' }
export function ActivityWidget({ active }: { active?: ActivityKind }) {
  const n = useMyPostsSummary().data
  return (
    <section className={s.widget} aria-label="내 활동">
      <h2 className="display">내 활동</h2>
      <ul className={s.activity}>
        {(['mine', 'commented', 'saved'] as const).map((k) => (
          <li key={k}>
            <Link to={`/board/${k}`} className={active === k ? s.activityOn : undefined} aria-current={active === k ? 'page' : undefined}>
              <span>{ACTIVITY_LABEL[k]}</span><em>{n ? n[k] : '·'}</em><ChevronRight size={16} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className={s.search}>
      <SearchIcon size={18} />
      <input value={value} maxLength={KEYWORD_MAX} onChange={(e) => onChange(e.target.value)} placeholder="선택된 카테고리 내 검색" aria-label="커뮤니티 글 검색" />
      {value && <button type="button" className={s.searchClear} onClick={() => onChange('')} aria-label="검색어 지우기"><CloseIcon size={14} /></button>}
    </label>
  )
}

export function WriteButton({ block }: { block?: boolean }) {
  return <Link to="/board/write" className={`btn btn-cta ${block ? 'btn-block' : ''} ${s.writeBtn}`}><PenIcon size={16} /> 글쓰기</Link>
}

/* ===== 대상 없음 (00 공통 21) ===== */
export function GonePage({ message }: { message: string }) {
  return (
    <div className={s.wrap}>
      <div className={s.gonePage}>
        <EmptyMole message={message}>
          <Link to="/board" className="btn btn-primary btn-sm"><ChevronLeft size={16} /> 게시판으로</Link>
        </EmptyMole>
      </div>
      <Footer />
    </div>
  )
}
