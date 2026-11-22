import { useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import Footer from '../../components/Footer'
import InterestChip from '../../components/InterestChip'
import { ConfirmDialog, TOAST, type ToastSpec } from '../../components/Feedback'
import { CloseIcon, PlusIcon } from '../../components/Icons'
import {
  BIG_INTERESTS, BOARD_CATS, BODY_MAX, PHOTO_MAX, TAG_MAX, TITLE_MAX, bigOf, createPost, isMine, linkableMeetups, meetupShortDate, needsMeetup,
  updatePost, usePosts, type BoardPhoto, type PostDraft,
} from '../../data/boardStore'
import { findMeetup, useMeetups } from '../../data/meetupStore'
import type { PostCategory, Tone } from '../../data/types'
import { GonePage } from './parts'
import FieldError from '../../components/FieldError'
import { fieldError } from '../../lib/validation'
import s from './Board.module.css'

const POSTED: ToastSpec = { title: '게시글이 등록되었어요', desc: '커뮤니티에서 바로 확인할 수 있어요' }
const EMPTY: PostDraft = { category: '자유', title: '', body: '', interests: [], photos: [] }
const PHOTO_TONES: Tone[] = ['sage', 'clay', 'butter', 'sky', 'lilac', 'rose', 'mint']

/** 커뮤니티 – 글쓰기 (Desktop) — Figma 02 F8-05 1~7 */
export function BoardWrite() {
  return <PostForm mode="write" />
}

/** 커뮤니티 – 글 수정 (Desktop) — Figma 02 F8-06 1~3: 글쓰기와 같은 칸, 값이 채워진 채로 */
export function BoardEdit() {
  const { postId = '' } = useParams()
  const posts = usePosts()
  const p = posts.find((x) => x.id === postId)
  if (!p || p.status === 'deleted') return <GonePage message="삭제된 글이에요" />
  if (!isMine(p)) return <GonePage message="내가 쓴 글만 수정할 수 있어요" />
  if (p.status === 'hidden') return <GonePage message="신고로 가려진 글은 수정할 수 없어요" />
  return <PostForm key={p.id} mode="edit" postId={p.id}
    initial={{ category: p.category, title: p.title, body: p.body, interests: p.interests, photos: p.photos, meetupId: p.meetupId }} />
}

function PostForm({ mode, postId, initial }: { mode: 'write' | 'edit'; postId?: string; initial?: PostDraft }) {
  const nav = useNavigate()
  const start = initial ?? EMPTY
  // 글쓰기는 카테고리를 고르지 않은 채로 시작 (필수 항목)
  const [cat, setCat] = useState<PostCategory | null>(initial ? initial.category : null)
  const [title, setTitle] = useState(start.title)
  const [body, setBody] = useState(start.body)
  const [tags, setTags] = useState<string[]>(start.interests)
  const [photos, setPhotos] = useState<BoardPhoto[]>(start.photos)
  const [meetupId, setMeetupId] = useState(start.meetupId ?? '')
  const [picker, setPicker] = useState(false)
  // 서버가 거절했을 때 칸 밑·폼 아래에 보여 줄 오류 (lib/validation.ts. 지금은 목 저장소라 거의 안 생김)
  const [srvErr, setSrvErr] = useState<unknown>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const done = useRef(false)

  const meetupState = useMeetups() // 모임이 바뀌면(취소 · 시작) 고를 수 있는 모임도 따라 바뀜
  const options = linkableMeetups(cat, meetupState)
  // 연결된 모임이 지금 목록에 없으면(예: 수정 중 마감) 그대로 보여 주고 고를 수 있게 둠
  const current = meetupId ? findMeetup(meetupId, meetupState) : undefined
  const shownOptions = current && !options.includes(current) && !needsMeetup(cat) ? [current, ...options] : options
  // 카테고리를 바꿨는데 고른 모임이 그 카테고리 규칙에 안 맞으면(홍보 ↔ 후기) 비움
  useEffect(() => { if (needsMeetup(cat) && meetupId && !options.some((m) => m.id === meetupId)) setMeetupId('') }, [cat]) // eslint-disable-line react-hooks/exhaustive-deps

  const needMeetup = needsMeetup(cat)
  const ready = !!cat && !!title.trim() && !!body.trim() && (!needMeetup || !!meetupId)
  const dirty = mode === 'write'
    ? !!(cat || title || body || tags.length || photos.length || meetupId)
    : cat !== start.category || title !== start.title || body !== start.body || tags.join() !== start.interests.join() || photos !== start.photos || meetupId !== (start.meetupId ?? '')

  // 00 공통 18 저장 전 취소: 입력한 내용이 있으면 취소 · 뒤로 가기 · 다른 메뉴로 갈 때 확인
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !done.current && currentLocation.pathname !== nextLocation.pathname)
  const leaving = useRef(false)
  useEffect(() => {
    if (!dirty) return
    const f = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', f)
    return () => window.removeEventListener('beforeunload', f)
  }, [dirty])

  const leave = () => nav(mode === 'edit' && postId ? `/board/${postId}` : '/board')

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const room = PHOTO_MAX - photos.length
    const add = [...files].filter((f) => f.type.startsWith('image/')).slice(0, room)
      .map((f, i) => ({ tone: PHOTO_TONES[(photos.length + i) % PHOTO_TONES.length], url: URL.createObjectURL(f) }))
    setPhotos((l) => [...l, ...add])
  }

  const submit = () => {
    if (!ready || !cat) return
    const d: PostDraft = { category: cat, title: title.trim(), body: body.trim(), interests: tags, photos, meetupId: meetupId || undefined }
    setSrvErr(null)
    done.current = true
    try {
      if (mode === 'edit' && postId) {
        updatePost(postId, d)
        nav(`/board/${postId}`, { replace: true, state: { toast: TOAST.edited } })
      } else {
        const id = createPost(d)
        nav(`/board/${id}`, { replace: true, state: { toast: POSTED } })
      }
    } catch (e) {
      done.current = false
      setSrvErr(e)
    }
  }

  return (
    <div className={s.wrap}>
      <div className={s.writeWrap}>
        <p className={s.writeCrumb}><Link to="/board">게시판</Link> / <span>{mode === 'edit' ? '글 수정' : '글쓰기'}</span></p>
        <h1 className={`display ${s.writeTitle}`}>{mode === 'edit' ? '글 수정' : '글쓰기'}</h1>

        <form className={s.writeCard} onSubmit={(e) => { e.preventDefault(); submit() }}>
          {/* 1 카테고리 (필수) */}
          <div className={s.field}>
            <p className={s.fieldHead}><span>카테고리</span><small>필수</small></p>
            <div className={s.chipRow} role="radiogroup" aria-label="카테고리">
              {BOARD_CATS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={cat === c} className={cat === c ? s.pickOn : s.pick} onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>
          </div>

          {/* 2 제목 (필수, 50자) */}
          <div className={s.field}>
            <p className={s.fieldHead}><label htmlFor="w-title">제목</label><small>{title.length} / {TITLE_MAX}</small></p>
            <input id="w-title" className={s.input} value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="제목을 입력해 주세요"
              aria-describedby="w-title-err" aria-invalid={!!fieldError(srvErr, 'title')} />
            <FieldError id="w-title-err" error={srvErr} field="title" />
          </div>

          {/* 3 본문 (필수, 1000자) */}
          <div className={s.field}>
            <p className={s.fieldHead}><label htmlFor="w-body">본문</label><small>{body.length} / {BODY_MAX}</small></p>
            <textarea id="w-body" className={s.textarea} value={body} maxLength={BODY_MAX} onChange={(e) => setBody(e.target.value)} placeholder="나누고 싶은 이야기를 자유롭게 써 주세요"
              aria-describedby="w-body-err" aria-invalid={!!fieldError(srvErr, 'content')} />
            <FieldError id="w-body-err" error={srvErr} field="content" />
          </div>

          {/* 4 관심사 태그 (선택, 대분류 12개 중 최대 5개) */}
          <div className={s.field}>
            <p className={s.fieldHead}><span>관심사 태그</span><small>선택 · 최대 {TAG_MAX}개</small></p>
            <div className={s.chipRow}>
              {tags.map((t) => (
                <button key={t} type="button" className={s.tagSel} onClick={() => setTags((l) => l.filter((x) => x !== t))} aria-label={`${t} 태그 빼기`}>
                  {t} <CloseIcon size={12} />
                </button>
              ))}
              {tags.length < TAG_MAX && (
                <button type="button" className={s.pick} aria-expanded={picker} onClick={() => setPicker((v) => !v)}>+ 태그 추가</button>
              )}
            </div>
            {picker && tags.length < TAG_MAX && (
              <div className={s.tagPicker} role="group" aria-label="관심사 대분류">
                {BIG_INTERESTS.filter((t) => !tags.includes(t)).map((t) => (
                  <button key={t} type="button" onClick={() => { const n = [...tags, t]; setTags(n); if (n.length >= TAG_MAX) setPicker(false) }}>
                    <InterestChip label={`${bigOf(t)?.emoji ?? ''} ${t}`} tone={bigOf(t)?.tone} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 5 이미지 (선택, 최대 3장, 첫 장이 대표 사진) */}
          <div className={s.field}>
            <p className={s.fieldHead}><span>이미지</span><small>선택 · {photos.length} / {PHOTO_MAX} · 첫 장이 대표 사진</small></p>
            <div className={s.photoRow}>
              {photos.map((ph, i) => (
                <span key={i} className={s.photoSlot} style={{ background: `var(--tone-${ph.tone}-bg)` }}>
                  {ph.url && <img src={ph.url} alt={`사진 ${i + 1}`} />}
                  {i === 0 && <em>대표</em>}
                  <button type="button" aria-label={`사진 ${i + 1} 빼기`} onClick={() => setPhotos((l) => l.filter((_, j) => j !== i))}>×</button>
                </span>
              ))}
              {photos.length < PHOTO_MAX && (
                <button type="button" className={s.photoAdd} onClick={() => fileRef.current?.click()}><PlusIcon size={14} /> 사진 추가</button>
              )}
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
            </div>
          </div>

          {/* 6 모임 연결: 모임 홍보 = 필수(모집 중인 내 모임), 모임 후기 = 필수(내가 열었거나 참여 확정된 지난 모임), 자유 = 선택(열었거나 확정된 모임, 취소 제외) */}
          <div className={s.field}>
            <p className={s.fieldHead}><label htmlFor="w-meetup">모임 연결</label><small className={needMeetup ? s.req : undefined}>{needMeetup ? '필수' : '선택'}</small></p>
            <select id="w-meetup" className={s.select} value={meetupId} onChange={(e) => setMeetupId(e.target.value)}>
              <option value="">{cat === '모임 홍보' ? '홍보할 모임을 골라 주세요' : cat === '모임 후기' ? '후기를 쓸 모임을 골라 주세요' : '연결할 모임을 골라 주세요'}</option>
              {shownOptions.map((m) => <option key={m.id} value={m.id}>{m.title} · {meetupShortDate(m)}</option>)}
            </select>
            {cat === '모임 홍보' && options.length === 0 && (
              <p className={s.fieldHint}>모집 중인 내 모임이 없어요. <Link to="/meetups/new">모임 만들기</Link></p>
            )}
            {cat === '모임 후기' && options.length === 0 && (
              <p className={s.fieldHint} role="alert">후기를 쓸 지난 모임이 없어요. 내가 열었거나 참여가 확정된 모임이 끝나면 후기를 쓸 수 있어요. <Link to="/meetups">모임 둘러보기</Link></p>
            )}
          </div>
          {/* 칸에 붙지 않은 서버 오류 (예: 정지된 계정, 잠시 문제) */}
          <FieldError error={srvErr} />
        </form>

        {/* 7 취소 / 등록하기 */}
        <div className={s.writeActions}>
          <button type="button" className="btn btn-line" onClick={leave}>취소</button>
          <button type="button" className="btn btn-primary" disabled={!ready} onClick={submit}>{mode === 'edit' ? '수정 완료' : '등록하기'}</button>
        </div>
      </div>
      <Footer />
      <ConfirmDialog open={blocker.state === 'blocked'}
        onConfirm={() => { leaving.current = true; blocker.proceed?.() }}
        onClose={() => { if (!leaving.current) blocker.reset?.(); leaving.current = false }}
        title="아직 저장되지 않았습니다" desc="나가면 입력한 내용이 사라져요. 임시 저장은 되지 않아요." confirmLabel="나가기" cancelLabel="계속 수정" />
    </div>
  )
}
