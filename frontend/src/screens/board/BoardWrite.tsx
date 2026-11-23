import { useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams } from '@/lib/nav'
import Footer from '../../components/Footer'
import InterestChip from '../../components/InterestChip'
import { ConfirmDialog, TOAST, type ToastSpec } from '../../components/Feedback'
import { CloseIcon, PlusIcon } from '../../components/Icons'
import FieldError from '../../components/FieldError'
import { DetailSkeleton, ErrorState, QueryGate } from '../../components/AsyncState'
import type { PostCategory } from '../../data/types'
import { errorText, isApiError, toastApiError } from '../../api'
import {
  COMMUNITY_ERRORS, useLinkableMeetups, usePostDetail, useSavePost, useUploadImage, type LinkedMeetupVM, type PhotoVM,
} from '../../api/community'
import { fieldError } from '../../lib/validation'
import { monthDay } from '../../lib/time'
import { BIG_INTERESTS, BOARD_CATS, BODY_MAX, GonePage, PHOTO_MAX, TAG_MAX, TITLE_MAX, bigOf } from './parts'
import s from './Board.module.css'

const POSTED: ToastSpec = { title: '게시글이 등록되었어요', desc: '커뮤니티에서 바로 확인할 수 있어요' }
/** 올릴 수 있는 사진 (api 08 "사진": JPEG · PNG · WebP, 한 장 5MB) */
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const PHOTO_BYTES = 5 * 1024 * 1024

/** 양식 시작 값 */
interface Initial {
  category: PostCategory | null
  title: string
  content: string
  interests: string[]
  images: PhotoVM[]
  meetup: LinkedMeetupVM | null
}
const EMPTY: Initial = { category: null, title: '', content: '', interests: [], images: [], meetup: null }

/** 커뮤니티 – 글쓰기 (Desktop) — 명세 08 글쓰기 1~7. 등록하기 → POST /posts */
export function BoardWrite() {
  return <PostForm mode="write" initial={EMPTY} />
}

/** 커뮤니티 – 글 수정 (Desktop) — 명세 08 글 수정 1~3: GET /posts/{id} 로 채우고 PATCH /posts/{id} (조회수는 올리지 않음) */
export function BoardEdit() {
  const { postId = '' } = useParams()
  const q = usePostDetail(postId)
  return (
    <QueryGate q={q} skeleton={<DetailSkeleton label="글을 불러오는 중" />}
      notFound={(e) => <GonePage message={isApiError(e) && e.code === 'POST_HIDDEN' ? '신고로 가려진 글이에요' : '삭제된 글이에요'} />}
      error={(retry, e) => <div className={s.wrap}><ErrorState error={e} onRetry={retry} retrying={q.isFetching} title="글을 불러오지 못했어요" /></div>}>
      {(p) => !p.mine ? <GonePage message="내가 쓴 글만 수정할 수 있어요" />
        : !p.canEdit ? <GonePage message="신고로 가려진 글은 수정할 수 없어요" />
        : <PostForm key={p.id} mode="edit" postId={p.id}
            initial={{ category: p.category, title: p.title, content: p.content, interests: p.interests, images: p.images, meetup: p.meetup }} />}
    </QueryGate>
  )
}

/** 사진 칸: 올리는 중이면 id 가 아직 없음 */
type Slot = PhotoVM & { key: string; uploading?: boolean }
let slotSeq = 0

function PostForm({ mode, postId, initial }: { mode: 'write' | 'edit'; postId?: string; initial: Initial }) {
  const nav = useNavigate()
  const [cat, setCat] = useState<PostCategory | null>(initial.category)
  const [title, setTitle] = useState(initial.title)
  const [body, setBody] = useState(initial.content)
  const [tags, setTags] = useState<string[]>(initial.interests)
  const [photos, setPhotos] = useState<Slot[]>(() => initial.images.map((ph) => ({ ...ph, key: `s${++slotSeq}` })))
  const [meetupId, setMeetupId] = useState(initial.meetup?.id ?? '')
  const [picker, setPicker] = useState(false)
  const [photoNote, setPhotoNote] = useState<string | null>(null)
  // 서버가 거절했을 때 칸 밑 · 폼 아래에 보여 줄 오류
  const [srvErr, setSrvErr] = useState<unknown>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  const save = useSavePost()
  const upload = useUploadImage()

  // 6 모임 연결: 카테고리마다 고를 수 있는 모임이 다름 (GET /me/linkable-meetups)
  const linkable = useLinkableMeetups(cat)
  const options = linkable.data ?? []
  // 글 수정: 지금 연결된 모임이 목록에 없을 수 있음(그사이 모집 완료 등) → 카테고리를 안 바꿨으면 그대로 보여 주고 그대로 보냄
  const keepCurrent = mode === 'edit' && !!initial.meetup && cat === initial.category && !options.some((m) => m.id === initial.meetup!.id)
  const shownOptions = keepCurrent ? [initial.meetup!, ...options] : options
  useEffect(() => {
    // 카테고리를 바꿔 고른 모임을 더 고를 수 없게 되면 비움
    if (meetupId && linkable.data && !shownOptions.some((m) => m.id === meetupId)) setMeetupId('')
  }, [cat, linkable.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const needMeetup = cat === '모임 홍보' || cat === '모임 후기'
  const uploading = photos.some((p) => p.uploading)
  const ready = !!cat && !!title.trim() && !!body.trim() && (!needMeetup || !!meetupId) && !uploading && !save.isPending
  const dirty = mode === 'write'
    ? !!(cat || title || body || tags.length || photos.length || meetupId)
    : cat !== initial.category || title !== initial.title || body !== initial.content || tags.join() !== initial.interests.join()
      || photos.map((p) => p.id).join() !== initial.images.map((p) => p.id).join() || meetupId !== (initial.meetup?.id ?? '')

  // 00 공통 18 저장 전 취소: 입력한 내용이 있으면 취소 · 뒤로 가기 · 다른 메뉴로 갈 때 확인 (임시 저장 없음)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !done.current && currentLocation.pathname !== nextLocation.pathname)
  const leaving = useRef(false)
  useEffect(() => {
    if (!dirty) return
    const f = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', f)
    return () => window.removeEventListener('beforeunload', f)
  }, [dirty])

  const leave = () => nav(mode === 'edit' && postId ? `/board/${postId}` : '/board')

  /** 5 사진 추가: 고른 사진을 한 장씩 POST /images 로 올려 id 를 받음 (3장까지) */
  const addFiles = async (files: FileList | null) => {
    if (!files) return
    const room = PHOTO_MAX - photos.length
    const all = [...files]
    const ok = all.filter((f) => PHOTO_TYPES.includes(f.type) && f.size <= PHOTO_BYTES)
    setPhotoNote(ok.length < all.length ? 'JPEG, PNG, WebP 사진만 한 장에 5MB까지 올릴 수 있어요.' : all.length > room ? `사진은 ${PHOTO_MAX}장까지 붙일 수 있어요.` : null)
    const picked = ok.slice(0, room).map((file) => ({ file, key: `s${++slotSeq}` }))
    setPhotos((l) => [...l, ...picked.map(({ key }, i): Slot => ({ key, id: '', tone: (['sage', 'clay', 'butter'] as const)[(l.length + i) % 3], uploading: true }))])
    for (const { file, key } of picked) {
      try {
        const r = await upload.mutateAsync(file)
        setPhotos((l) => l.map((p) => (p.key === key ? { ...p, id: r.id, url: r.url, uploading: false } : p)))
      } catch (e) {
        setPhotos((l) => l.filter((p) => p.key !== key))
        toastApiError(e, '사진을 올리지 못했어요', COMMUNITY_ERRORS)
      }
    }
  }

  const submit = () => {
    if (!ready || !cat) return
    setSrvErr(null)
    done.current = true
    save.mutate({
      id: mode === 'edit' ? postId : undefined,
      value: { category: cat, title: title.trim(), content: body.trim(), interests: tags, imageIds: photos.map((p) => p.id), meetupId: meetupId || null },
    }, {
      onSuccess: (id) => nav(`/board/${id}`, { replace: true, state: { toast: mode === 'edit' ? TOAST.edited : POSTED } }),
      onError: (e) => { done.current = false; setSrvErr(e) },
    })
  }
  /** 칸에 붙지 않은 오류 (모임 연결 불가 · 가려진 글 · 잠시 문제 …). 입력 오류는 칸 밑에 */
  const formMsg = srvErr && !(isApiError(srvErr) && srvErr.code === 'INVALID_INPUT' && srvErr.fields?.length) ? errorText(srvErr, COMMUNITY_ERRORS) : null
  const noReview = cat === '모임 후기' && linkable.isSuccess && options.length === 0

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
            <FieldError error={srvErr} field="interestCategoryIds" />
          </div>

          {/* 5 이미지 (선택, 최대 3장, 첫 장이 대표 사진) */}
          <div className={s.field}>
            <p className={s.fieldHead}><span>이미지</span><small>선택 · {photos.length} / {PHOTO_MAX} · 첫 장이 대표 사진</small></p>
            <div className={s.photoRow}>
              {photos.map((ph, i) => (
                <span key={ph.key} className={s.photoSlot} style={{ background: `var(--tone-${ph.tone}-bg)` }} aria-busy={ph.uploading || undefined}>
                  {ph.url && <img src={ph.url} alt={`사진 ${i + 1}`} />}
                  {ph.uploading && <em>올리는 중</em>}
                  {i === 0 && !ph.uploading && <em>대표</em>}
                  {!ph.uploading && <button type="button" aria-label={`사진 ${i + 1} 빼기`} onClick={() => setPhotos((l) => l.filter((x) => x.key !== ph.key))}>×</button>}
                </span>
              ))}
              {photos.length < PHOTO_MAX && (
                <button type="button" className={s.photoAdd} onClick={() => fileRef.current?.click()}><PlusIcon size={14} /> 사진 추가</button>
              )}
              <input ref={fileRef} type="file" accept={PHOTO_TYPES.join(',')} multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = '' }} />
            </div>
            {photoNote && <p className={s.fieldHint}>{photoNote}</p>}
            <FieldError error={srvErr} field="imageIds" />
          </div>

          {/* 6 모임 연결: 모임 홍보(모집 중인 내 모임) · 모임 후기(내가 열었거나 참여 확정된 지난 모임)는 필수, 자유는 선택 */}
          <div className={s.field}>
            <p className={s.fieldHead}><label htmlFor="w-meetup">모임 연결</label><small className={needMeetup ? s.req : undefined}>{needMeetup ? '필수' : '선택'}</small></p>
            <select id="w-meetup" className={s.select} value={meetupId} onChange={(e) => setMeetupId(e.target.value)} disabled={!cat || linkable.isPending}>
              <option value="">{!cat ? '카테고리를 먼저 골라 주세요' : cat === '모임 홍보' ? '홍보할 모임을 골라 주세요' : cat === '모임 후기' ? '후기를 쓸 모임을 골라 주세요' : '연결할 모임을 골라 주세요'}</option>
              {shownOptions.map((m) => <option key={m.id} value={m.id}>{m.title} · {monthDay(m.startsAt)}</option>)}
            </select>
            {cat === '모임 홍보' && linkable.isSuccess && options.length === 0 && !keepCurrent && (
              <p className={s.fieldHint}>모집 중인 내 모임이 없어요. <Link to="/meetups/new">모임 만들기</Link></p>
            )}
            {noReview && !keepCurrent && (
              <p className={s.fieldHint}>후기를 쓸 수 있는 모임이 없어요. 내가 열었거나 참여가 확정된 지난 모임에만 후기를 쓸 수 있어요.</p>
            )}
            {linkable.isError && <p className={s.fieldHint}>모임 목록을 불러오지 못했어요. <button type="button" onClick={() => void linkable.refetch()}>다시 시도</button></p>}
            <FieldError error={srvErr} field="meetupId" />
          </div>
          {/* 칸에 붙지 않은 서버 오류 (연결할 수 없는 모임, 가려진 글, 잠시 문제 …) */}
          {formMsg && <p className="error" role="alert">{formMsg}</p>}
        </form>

        {/* 7 취소 / 등록하기 */}
        <div className={s.writeActions}>
          <button type="button" className="btn btn-line" onClick={leave}>취소</button>
          <button type="button" className="btn btn-primary" disabled={!ready} onClick={submit}>{save.isPending ? '저장하는 중…' : mode === 'edit' ? '수정 완료' : '등록하기'}</button>
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
