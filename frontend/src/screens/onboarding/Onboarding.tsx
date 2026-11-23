import { useEffect, useMemo, useRef, useState } from 'react'
import { clampText, lengthOf, nicknameCharsMessage } from '../../lib/validation'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from '@/lib/nav'
import logo from '../../assets/logo-clear.png'
import MoleDresser, { MolePreview, MoleWithItems, WornChips } from '../../components/MoleDresser'
import { DEFAULT_WORN, MAX_WORN, MOLE_ITEMS, MOLE_PARTS, blockedBy } from '../../data/moleItems'
import RoomView from '../../components/RoomView'
import { ErrorState, SkeletonLines } from '../../components/AsyncState'
import { ME_ID, toneOf } from '../../data/mock'
import { MAX_PICK, interestCatOf, subOf, toSubIds } from '../../data/interests'
import { placeWords } from '../../data/roomPlanV38'
import { tileUrl, wallpaperOf } from '../../data/wallpapers'
import { ANSWER_MAX, ANSWER_MIN, answerOk, questionOf, questionTag, recommendedQuestions, type Question } from '../../data/questions'
import { MIN_PICK, MOOD_NAMES, NICK_MAX, interestFurnitureCount, leadCategory } from '../../data/myBurrow'
import { NO_SAVED_ROOM, roomLookOf } from '../../data/roomLook'
import type { Category } from '../../data/types'
import { errorText, isApiError, toastApiError } from '../../api'
import { toDtoId } from '../../api/common'
import { useMe } from '../../api/auth'
import {
  ONBOARDING_ERRORS, interestIdsOf, toMoleDto, useCheckNickname, useCompleteOnboarding, useInterestCatalog, useIntroQuestions, type InterestCatalog,
} from '../../api/onboarding'
import QuestionList from './QuestionList'
import s from './Onboarding.module.css'

/*
 * 온보딩 (02 "스켈레톤 기능 명세" F3 기준으로 다시 맞춤, 2026-11-16. docs/spec-f3-f4.md)
 *  헤더(00 공통 12): 로고만, 메뉴·건너뛰기 없음. 진행 단계 4개(나를 부르는 이름 → 내 관심사 선택 → 자기소개 → 땅굴 만들기)
 *  1 이름 · 두더지 꾸미기 → 2 관심사(왼쪽 대분류 + 오른쪽 세부 관심사, 최대 10개) → 3 자기소개(질문 목록에서 3개 고르기)
 *  → 3a 땅굴 만드는 중(버튼 없음, 끝나면 자동) → 4 땅굴 미리보기(관심사 재선택 / 관심사 확정)
 * 시안은 본문까지 Do Hyeon 이라 이 화면은 전부 display 서체.
 * 관심사는 2026-11-18 확정본 대분류 12 · 소분류 90 (data/interestTags.ts → data/interests.ts). 가구 배치는 data/roomPlan.ts
 *
 * API (명세 03 "화면마다 부르는 API", 2026-11-22):
 *  1 "다음" → POST /nicknames/check (겹치면 칸 밑 문구) / 2 GET /interest-categories (칩 숫자 = 고른 사람 수) / 3 GET /intro-questions
 *  3a · 4 미리보기는 API 없이 고른 관심사로 그림 (가구 · 무드는 프론트가 정함), 땅굴 정보 카드의 소속은 GET /me
 *  4 "관심사 확정" → POST /me/onboarding/complete 한 번에 저장. 그 전에는 아무것도 저장하지 않음 (도중에 나가면 다음에 처음부터)
 *  확정에서 NICKNAME_DUPLICATED 면 다른 값은 그대로 두고 온보딩 1 로 돌아가 닉네임만 다시 받음
 */

const STEPS = [
  { key: 'name', label: '나를 부르는 이름' },
  { key: 'interests', label: '내 관심사 선택' },
  { key: 'intro', label: '자기소개' },
  { key: 'building', label: '땅굴 만들기' },
] as const

const DEMO = {
  name: '새벽산책',
  worn: DEFAULT_WORN,
  // 2026-11-18 확정본 이름 (예전 시안: 시티팝 · 필름카메라 · 테라리움 · 체스 · 뜨개질 · 클라이밍 · 요가 · 애니메이션 · 고양이 · 강아지)
  picks: ['JPOP/OST', '필름/컴팩트', '식물/테라리움', '바둑/장기/체스', '자수/뜨개/패브릭', '클라이밍', '헬스/필라테스/요가', '애니메이션', '고양이', '강아지'],
}
const DEMO_ANSWERS = ['마리아 타케우치 「Plastic Love」요. 출근길마다 들어요.', '동네 고양이요. 반은 흔들렸어요.', '유명한 맛집 주방을 몰래 구경해 볼래요.']

const catName = (c: Category) => c.name.replace(/\s·\s/g, ' · ')

export default function Onboarding() {
  const { step = 'name' } = useParams()
  const nav = useNavigate()
  // ?demo 로 들어오면 시안과 같은 예시 값으로 채움 (단계별 화면을 바로 보여 줄 때)
  const [params] = useSearchParams()
  const [demo] = useState(() => params.has('demo'))
  const [name, setName] = useState(demo ? DEMO.name : '')
  const [worn, setWorn] = useState<string[]>(demo ? DEMO.worn : [])
  const [picks, setPicks] = useState<string[]>(demo ? DEMO.picks : [])
  const [qids, setQids] = useState<string[]>(() => (demo ? recommendedQuestions(DEMO.picks).map((q) => q.id) : []))
  const [answers, setAnswers] = useState<Record<string, string>>(() => (demo ? Object.fromEntries(recommendedQuestions(DEMO.picks).map((q, i) => [q.id, DEMO_ANSWERS[i]])) : {}))
  // 미리보기에서 "관심사 재선택"으로 돌아왔으면, 다시 고른 뒤 "다음"은 땅굴을 새로 만듦(3a → 4)
  const [repick, setRepick] = useState(false)
  // 닉네임 칸 밑 오류 (닉네임 확인 · 확정에서 받은 것)
  const [nickErr, setNickErr] = useState<string | null>(null)
  // 확정에서 닉네임이 겹쳐 온보딩 1 로 돌아왔으면, 닉네임만 고친 뒤 "다음"은 바로 미리보기로
  const [fixNick, setFixNick] = useState(false)
  const catalog = useInterestCatalog()
  const questions = useIntroQuestions()
  const complete = useCompleteOnboarding()

  const idx = STEPS.findIndex((x) => x.key === step || (x.key === 'building' && step === 'preview'))
  if (idx < 0) return <Navigate to="/onboarding/name" replace />
  const go = (k: string) => { nav(`/onboarding/${k}`); window.scrollTo(0, 0) }
  const nick = name.trim() || '새벽산책'
  const qna = qids.map((id) => ({ q: questionOf(id, questions.data)?.text ?? '', a: (answers[id] ?? '').trim() }))
  // 4 관심사 확정: 정한 값을 한 번에 보냄 (관심사 id 는 받은 관심사 목록으로 잇기 — api/onboarding interestMap)
  const confirm = () => {
    if (!catalog.data) return
    let interestIds
    try { interestIds = interestIdsOf(picks, catalog.data) } catch { toastApiError(null, '관심사를 확인하지 못했어요'); go('interests'); return }
    complete.mutate({
      nickname: name.trim(), mole: toMoleDto(worn), interestIds,
      answers: qids.map((id) => ({ introQuestionId: toDtoId(id), answer: (answers[id] ?? '').trim() })),
    }, {
      onSuccess: () => nav('/burrow', { replace: true }),
      onError: (e) => {
        if (isApiError(e) && e.code === 'NICKNAME_DUPLICATED') { setNickErr(errorText(e, ONBOARDING_ERRORS)); setFixNick(true); go('name'); return }
        if (isApiError(e) && e.code === 'INTEREST_NOT_FOUND') { toastApiError(e, '땅굴을 만들지 못했어요', ONBOARDING_ERRORS); go('interests'); return }
        if (isApiError(e) && e.code === 'INTRO_QUESTION_NOT_FOUND') { toastApiError(e, '땅굴을 만들지 못했어요', ONBOARDING_ERRORS); go('intro'); return }
        toastApiError(e, '땅굴을 만들지 못했어요', ONBOARDING_ERRORS)
      },
    })
  }

  return (
    <div className={s.page}>
      <header className={s.header}>
        <Link to="/" aria-label="디굴디굴 처음으로"><img src={logo} alt="디굴디굴" className={s.logo} /></Link>
      </header>
      <nav className={s.steps} aria-label="진행 단계">
        <ol>
          {STEPS.map((x, i) => (
            <li key={x.key} aria-current={i === idx ? 'step' : undefined}>
              {i > 0 && <span className={s.joint} aria-hidden />}
              <span className={i < idx ? s.stepDone : i === idx ? s.stepNow : s.step}>
                <span className={s.stepNum}>{i < idx ? <Check /> : i + 1}</span><span className={s.stepLabel}>{x.label}</span>
              </span>
            </li>
          ))}
        </ol>
      </nav>
      <main className={step === 'preview' ? s.bodyFull : s.body}>
        {step === 'name' && (
          <NameStep name={name} setName={(v) => { setName(v); setNickErr(null) }} worn={worn} setWorn={setWorn} error={nickErr} setError={setNickErr}
            onNext={() => { if (fixNick) { setFixNick(false); go('preview') } else go('interests') }} />
        )}
        {step === 'interests' && (
          <InterestStep catalog={catalog.data} loading={catalog.isLoading} error={catalog.error} onRetry={() => void catalog.refetch()}
            picks={picks} setPicks={setPicks} onPrev={() => go('name')} onNext={() => { if (repick) { setRepick(false); go('building') } else go('intro') }} />
        )}
        {step === 'intro' && (
          <IntroStep questions={questions.data} loading={questions.isLoading} error={questions.error} onRetry={questions.refetch}
            name={nick} worn={worn} picks={picks} qids={qids} setQids={setQids} answers={answers} setAnswers={setAnswers} onPrev={() => go('interests')} onNext={() => go('building')} />
        )}
        {step === 'building' && <BuildStep name={nick} picks={picks} categories={catalog.data?.categories} onDone={() => nav('/onboarding/preview', { replace: true })} />}
        {step === 'preview' && (
          <PreviewStep name={nick} worn={worn} picks={picks} qna={qna}
            onRepick={() => { setRepick(true); go('interests') }}
            onConfirm={confirm} busy={complete.isPending || !catalog.data} />
        )}
      </main>
    </div>
  )
}

function Check({ size = 12 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden><path d="M2.2 6.3 4.9 8.9 9.8 3.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

/* ---------- 1. 나를 부르는 이름 · 두더지 꾸미기 ---------- */
// 미리 보기 상자 260×328 (.previewBox, 아래 여백 28) 안에 200×200 정사각형이 바닥 쪽 가운데에 있음.
// 3D 캔버스는 상자 전체 + 위로 72px(Figma Overflow Zone)까지 넓힘 → 260×400. 풍선 같은 키 큰 소품이 안 잘림
const PREVIEW_SIZE = 200, PREVIEW_OVERFLOW = 72
const PREVIEW_BLEED = { top: 328 - 28 - PREVIEW_SIZE + PREVIEW_OVERFLOW, right: 30, bottom: 28, left: 30 }
/**
 * 1 제목·안내 / 2 닉네임: 필수, 최대 12자 "n / 12", 겹치면 오류 문구 / 3 두더지 꾸미기: 머리·얼굴·목·손 하나씩("없음" 가능), 43개 모두 바로 고를 수 있음(관심사 연결 없음, 액세서리 v1.2)
 * 4 랜덤으로 꾸미기 / 5 미리보기(천천히 돌려 봄) / 6 고른 아이템(부위와 함께, ×로 해제) / 7 다음: 닉네임을 입력하면 활성
 */
function NameStep(p: { name: string; setName: (v: string) => void; worn: string[]; setWorn: (v: string[]) => void; error: string | null; setError: (v: string | null) => void; onNext: () => void }) {
  const [spin, setSpin] = useState(true)
  const trimmed = p.name.trim()
  // 겹치는지는 서버가 정함: "다음"에서 POST /nicknames/check (성공하면 5분 동안 맡아 둠)
  const check = useCheckNickname()
  const charMsg = nicknameCharsMessage(p.name)
  const taken = !!p.error
  const next = () => check.mutate(trimmed, {
    onSuccess: () => { p.setError(null); p.onNext() },
    onError: (e) => {
      if (isApiError(e) && (e.code === 'NICKNAME_DUPLICATED' || e.code === 'INVALID_INPUT')) p.setError(errorText(e, ONBOARDING_ERRORS))
      else toastApiError(e, '닉네임을 확인하지 못했어요', ONBOARDING_ERRORS)
    },
  })
  // 랜덤: 부위마다 하나씩 (같이 못 끼는 조합은 빼고. 레벨 잠금 없음)
  const randomize = () => {
    const out: string[] = []
    for (const { part } of MOLE_PARTS) {
      const l = MOLE_ITEMS.filter((i) => i.part === part && !blockedBy(i.id, out))
      if (l.length) out.push(l[Math.floor(Math.random() * l.length)].id)
    }
    p.setWorn(out.slice(0, MAX_WORN))
  }

  return (
    <>
      <div className={s.intro}>
        <h1>닉네임을 입력하세요</h1>
        <p>실명은 받지 않아요</p>
      </div>
      <section className={s.card}>
        <div className={s.form}>
          <div className={s.field}>
            <label htmlFor="ob-nick">닉네임</label>
            <div className={s.inputWrap}>
              <input id="ob-nick" value={p.name} maxLength={NICK_MAX} onChange={(e) => p.setName(e.target.value)} placeholder="다른 두더지에게 보이는 이름" autoComplete="off" aria-invalid={taken || !!charMsg} />
              <span className={s.counter}>{p.name.length} / {NICK_MAX}</span>
            </div>
            {taken && <span className={s.error} role="alert">{p.error}</span>}
            {!taken && charMsg && <span className={s.error} role="alert">{charMsg}</span>}
            {!taken && !charMsg && <span className={s.hintLine}>나중에 내 땅굴의 &quot;내 정보 수정&quot;에서 바꿀 수 있어요</span>}
          </div>

          <div className={s.field}>
            <div className={s.accHead}>
              <span className={s.label}><span>두더지 꾸미기</span><small>부위마다 하나씩 · 꾸민 두더지는 다른 땅굴에 놀러 갈 때 보이는 모습이에요</small></span>
              <button className={s.randomBtn} onClick={randomize}><Dice /> 랜덤으로 꾸미기</button>
            </div>
            <MoleDresser worn={p.worn} onChange={p.setWorn} />
            <p className={s.partNote}>ⓘ 부위마다 하나씩 고를 수 있어요</p>
          </div>
        </div>

        <aside className={s.avatarSide} aria-live="polite">
          <span className={s.previewLabel}>미리 보기</span>
          <div className={s.previewBox}>
            <button className={s.spinChip} onClick={() => setSpin((v) => !v)} aria-pressed={spin}><span aria-hidden>↻</span> {spin ? '천천히 돌아가요' : '멈췄어요'}</button>
            <MolePreview size={PREVIEW_SIZE} bleed={PREVIEW_BLEED} worn={p.worn} spin={spin} label={`${trimmed || '내'} 두더지`} />
          </div>
          <strong>{trimmed || '닉네임'}</strong>
          {p.worn.length > 0 && <WornChips worn={p.worn} onRemove={(id) => p.setWorn(p.worn.filter((w) => w !== id))} withPart large />}
        </aside>
      </section>
      <div className={s.actions}>
        <span />
        <button className={s.next} disabled={!trimmed || taken || !!charMsg || check.isPending} onClick={next}>{check.isPending ? '확인 중…' : '다음'}</button>
      </div>
    </>
  )
}

/* ---------- 2. 내 관심사 선택 (왼쪽 대분류 · 오른쪽 세부 관심사) ---------- */
/**
 * 03 온보딩 2 (Figma 551:7406 · 740:3730)
 * 1 "내 관심사 선택하기" + 한 줄 안내 / 2 왼쪽 대분류 12개(보는 분류 강조, 고른 게 있으면 "N개" 배지) / 3 오른쪽 세부 관심사 칩 + 인원수, 누르면 체크 + 테두리, 다시 누르면 해제
 * 4 선택한 관심사(개수 · 고른 순서, 맨 앞 = 대표 관심사 → 땅굴 무드), ×로 바로 해제 / 5 이전 · 다음(3개 이상), 최대 10개
 * 10개 채우면: "N · 최대 10개"의 "최대 10개"가 빨간 글씨, 안 고른 칩은 흐리게, 더 고르려 하면 안내 3초
 * 다른 대분류로 바꿔도 고른 내용은 그대로(상위 상태)
 */
function InterestStep(p: { catalog?: InterestCatalog; loading: boolean; error: unknown; onRetry: () => void; picks: string[]; setPicks: (f: (l: string[]) => string[]) => void; onPrev: () => void; onNext: () => void }) {
  // 관심사 목록은 GET /interest-categories (대분류 12 · 세부 90 + 고른 사람 수)
  const CATEGORIES = p.catalog?.categories ?? []
  // 처음 보는 분류: 고른 게 있으면 맨 앞 관심사의 분류(재선택으로 돌아왔을 때), 없으면 맨 위
  const [catId, setCatId] = useState(() => subOf(p.picks[0] ?? '')?.category ?? '')
  const [over, setOver] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const full = p.picks.length >= MAX_PICK
  const toggle = (t: string) => {
    if (p.picks.includes(t)) { setOver(false); p.setPicks((l) => l.filter((x) => x !== t)); return }
    if (full) { setOver(true); clearTimeout(timer.current); timer.current = window.setTimeout(() => setOver(false), 3000); return }
    p.setPicks((l) => [...l, t])
  }
  const cat = CATEGORIES.find((c) => c.id === catId) ?? CATEGORIES[0]
  return (
    <>
      <div className={s.intro}>
        <h1>내 관심사 선택하기</h1>
        <p>최소 {MIN_PICK}개 · 최대 {MAX_PICK}개를 골라주세요</p>
      </div>
      {!cat ? (
        <section className={s.card} style={{ padding: 32, display: 'block' }}>
          {p.loading ? <div role="status" aria-busy="true" aria-label="관심사를 불러오는 중"><SkeletonLines lines={6} /></div>
            : <ErrorState error={p.error} onRetry={p.onRetry} title="관심사 목록을 불러오지 못했어요" />}
        </section>
      ) : (
      <section className={s.pickCols}>
        <nav className={s.catList} aria-label="관심 분야">
          {CATEGORIES.map((c) => {
            const n = c.tags.filter((t) => p.picks.includes(t.name)).length
            const on = c.id === cat.id
            return (
              <button key={c.id} className={on ? s.catOn : s.cat} onClick={() => setCatId(c.id)} aria-current={on ? 'true' : undefined}
                aria-label={`${catName(c)}${n ? `, ${n}개 고름` : ''}`}>
                <span>{catName(c)}</span>
                {n > 0 ? <em>{n}개</em> : <Chevron />}
              </button>
            )
          })}
        </nav>
        <div className={s.tagPanel}>
          <h2>{catName(cat)}</h2>
          <div className={s.tags}>
            {cat.tags.map((t) => {
              const on = p.picks.includes(t.name)
              return (
                <button key={t.name} className={on ? s.tagOn : full ? `${s.tag} ${s.tagDim}` : s.tag} aria-pressed={on} onClick={() => toggle(t.name)}
                  style={{ ['--tag-bg' as string]: `var(--tone-${cat.tone}-bg)`, ['--tag-fg' as string]: `var(--tone-${cat.tone}-fg)` }}>
                  {on && <Check size={11} />}{t.name}<small>{t.count.toLocaleString('ko-KR')}</small>
                </button>
              )
            })}
          </div>
          <div className={s.tray}>
            <p>선택한 관심사 <b>{p.picks.length}</b> <span className={full ? s.limitOn : s.limit}>· 최대 {MAX_PICK}개</span>
              {p.picks.length > 0 && <span className={s.trayLead}>맨 앞 관심사가 땅굴 분위기를 정해요</span>}</p>
            {p.picks.length === 0 ? <span className={s.trayEmpty}>마음 가는 관심사를 골라 보세요</span> : (
              <div className={s.trayChips}>
                {p.picks.map((t, i) => (
                  <button key={t} style={{ background: `var(--tone-${toneOf(t)}-bg)`, color: `var(--tone-${toneOf(t)}-fg)` }} onClick={() => toggle(t)} aria-label={`${t} 빼기`}>
                    {i === 0 && <em className={s.leadMark}>대표</em>}{t}<span aria-hidden>✕</span>
                  </button>
                ))}
              </div>
            )}
            {over && <p className={s.overToast} role="status">관심사는 최대 {MAX_PICK}개까지 고를 수 있어요. 다른 관심사를 빼고 골라 주세요.</p>}
          </div>
        </div>
      </section>
      )}
      <div className={s.actions}>
        <span className={s.footNote}>나중에 언제든 바꿀 수 있어요.</span>
        <div className={s.btnRow}>
          <button className={s.prev} onClick={p.onPrev}>이전</button>
          <button className={s.next} disabled={p.picks.length < MIN_PICK} onClick={p.onNext}>다음</button>
        </div>
      </div>
    </>
  )
}

/* ---------- 3. 자기소개 · 질문 목록에서 고르기 ---------- */
/**
 * 1 "나에 대해서 알려주세요" / 2 질문 목록(추천·관심사·TMI), 3개까지, 고른 질문은 "골랐어요"
 * 3 고른 질문 3개 모두 필수, 답변 10~50자 "n / 50"(50자 넘으면 막음), "목록에서 다시 고르기"로 바꿈. 이전 단계로 가도 유지(상위 상태)
 * 4 미리보기: 내 땅굴 내 정보 카드 모습 / 5 다음: 3개 모두 10자 이상이면 활성 → 3a. 나중에 내 땅굴에서 수정할 수 있다는 안내
 */
function IntroStep(p: { questions?: Question[]; loading: boolean; error: unknown; onRetry: () => void; name: string; worn: string[]; picks: string[]; qids: string[]; setQids: (v: string[]) => void; answers: Record<string, string>; setAnswers: (v: Record<string, string>) => void; onPrev: () => void; onNext: () => void }) {
  const listRef = useRef<HTMLDivElement>(null)
  // 질문 목록은 GET /intro-questions. 추천은 서버가 주지 않고 이 목록과 고른 관심사로 고름
  const list = p.questions ?? []
  const qOf = (id: string) => questionOf(id, list)
  const toggle = (id: string) => {
    if (p.qids.includes(id)) p.setQids(p.qids.filter((x) => x !== id))
    else if (p.qids.length < 3) p.setQids([...p.qids, id])
  }
  const ready = p.qids.length === 3 && p.qids.every((id) => answerOk(p.answers[id] ?? ''))
  return (
    <>
      <div className={s.intro}>
        <h1>나에 대해서 알려주세요</h1>
        <p>질문 목록에서 답하고 싶은 질문 3개를 골라 답해요.</p>
      </div>
      <section className={s.card}>
        <div className={s.qForm}>
          <div ref={listRef}>
            {p.questions ? (
              <QuestionList questions={list} picks={p.picks} selected={p.qids} max={3} onToggle={(q) => toggle(q.id)}
                note={`${p.qids.length} / 3 골랐어요 · 추천: 관심사 질문 2개 + TMI 질문 1개`} />
            ) : p.loading ? <div role="status" aria-busy="true" aria-label="질문을 불러오는 중"><SkeletonLines lines={5} /></div>
              : <ErrorState compact error={p.error} onRetry={p.onRetry} title="질문 목록을 불러오지 못했어요" />}
          </div>
          {p.qids.map((id, i) => {
            const q = qOf(id)
            if (!q) return null
            const a = p.answers[id] ?? ''
            const short = a.trim().length > 0 && a.trim().length < ANSWER_MIN
            return (
              <div key={id} className={s.field}>
                <div className={s.qHead}>
                  <label htmlFor={`ob-q${i}`}>Q{i + 1}. [{questionTag(q)}] {q.text}</label>
                  <button className={s.swap} onClick={() => { toggle(id); listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}>목록에서 다시 고르기</button>
                </div>
                <div className={s.areaWrap}>
                  <textarea id={`ob-q${i}`} value={a} placeholder={`예) ${q.ex}`}
                    onChange={(e) => p.setAnswers({ ...p.answers, [id]: clampText(e.target.value, ANSWER_MAX) })} />
                  <span className={s.counter}>{lengthOf(a)} / {ANSWER_MAX}</span>
                </div>
                {short && <span className={s.error}>{ANSWER_MIN}자 이상 적어 주세요</span>}
              </div>
            )
          })}
          {p.qids.length < 3 && <p className={s.qEmpty}>위 목록에서 질문을 {3 - p.qids.length}개 더 골라 주세요.</p>}
        </div>
        <aside className={s.cardSide}>
         <div className={s.sideSticky}>
          <p className={s.sideLabel}>내 땅굴에선 이렇게 보여요</p>
          <div className={s.profileCard}>
            <div className={s.profileTop}>
              <MoleWithItems size={52} radius={12} worn={p.worn} />
              <div><strong>{p.name}</strong><span>관심사 {p.picks.length}개</span></div>
            </div>
            <dl className={s.qnaBox}>
              {p.qids.map((id, i) => (
                <div key={id}><dt>Q{i + 1}. {qOf(id)?.text}</dt>{(p.answers[id] ?? '').trim() && <dd>{(p.answers[id] ?? '').trim()}</dd>}</div>
              ))}
              {p.qids.length === 0 && <div><dt>고른 질문이 여기에 보여요</dt></div>}
            </dl>
            <div className={s.chipRow}>
              {p.picks.slice(0, 4).map((t) => <span key={t} className={s.chip} style={{ background: `var(--tone-${toneOf(t)}-bg)`, color: `var(--tone-${toneOf(t)}-fg)` }}>{t}</span>)}
              {p.picks.length > 4 && <span className={s.more}>+{p.picks.length - 4}</span>}
            </div>
          </div>
          <p className={s.sideNote}>방문한 두더지는 이 카드를 보고 말을 걸어요.</p>
         </div>
        </aside>
      </section>
      <div className={s.actions}>
        <span className={s.footNote}>답변은 나중에 내 땅굴에서 언제든 수정할 수 있어요.</span>
        <div className={s.btnRow}>
          <button className={s.prev} onClick={p.onPrev}>이전</button>
          <button className={s.next} disabled={!ready} onClick={p.onNext}>다음</button>
        </div>
      </div>
    </>
  )
}

/* ---------- 3a. 땅굴 만드는 중 ---------- */
/** 벽지 견본 (타일 그림, 01 기본은 단색) */
const wallSwatch = (id: string, solid?: string) => {
  const u = tileUrl(id, 512)
  return u ? { background: `url(${u}) center / 48px repeat` } : { background: solid }
}

const GEN_STEPS = ['관심사 읽는 중', '무드와 물건 고르는 중', '땅굴에 배치하고 벽 꾸미는 중']

/**
 * 1 "○○님의 땅굴을 꾸미고 있어요" + 안내 / 2 체크리스트(완료 체크 · 진행 로딩 · 대기 흐리게)
 * 3 땅굴 무드: 대표 관심사(맨 앞)가 속한 대분류로 정한 무드 + 근거 관심사 태그 (대표 관심사가 달라질 때만 바뀜)
 * 4 가구 매칭: 고른 관심사 → 추천 가구(기본 가구) 카드를 차례로, 아직 안 채운 자리는 빈 카드. 다 되면 자동으로 온보딩 4 (버튼 없음)
 */
function BuildStep({ name, picks, categories, onDone }: { name: string; picks: string[]; categories?: Category[]; onDone: () => void }) {
  const lead = leadCategory(picks) ?? 'pet_plant'
  // 무드 · 가구는 API 없이 프론트가 고른 관심사로 정함 (명세 03 "가구와 땅굴 무드"). 대분류 이름만 받은 목록에서 (없으면 앱 표)
  const leadCat = categories?.find((c) => c.id === lead) ?? (interestCatOf(lead) ? { name: interestCatOf(lead)!.name_ko } as Category : undefined)
  const inLead = picks.filter((t) => subOf(t)?.category === lead)
  // 내 땅굴·남이 보는 내 땅굴과 같은 계산 (온보딩이라 꾸민 것은 없음)
  const wall = wallpaperOf(roomLookOf(ME_ID, picks, NO_SAVED_ROOM).wallpaper)
  // v3.8: 소분류("/"로 쪼갠 첫 단어)마다 모델 하나 (data/interestWords · roomPlanV38 placeWords, 방 3D 와 같은 계산)
  const rows = useMemo(() => placeWords(toSubIds(picks)).placed.map((x) => ({ tag: subOf(x.sub)?.name_ko ?? x.sub, name: x.word.name })), [picks])
  const [t, setT] = useState(0)
  const gap = Math.min(0.45, 6 / Math.max(1, rows.length))
  const rowsAt = (n: number) => 1.6 + n * gap
  const end = rowsAt(rows.length) + 1.4
  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setT(end); const id = setTimeout(() => setT(end + 0.9), 2200); return () => clearTimeout(id) }
    const start = performance.now()
    let raf = 0
    const tick = () => { const v = (performance.now() - start) / 1000; setT(v); if (v < end + 0.9) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [end])
  const left = useRef(false)
  useEffect(() => { if (t >= end + 0.9 && !left.current) { left.current = true; onDone() } }, [t, end, onDone])

  const phase = t < 0.8 ? 0 : t < rowsAt(rows.length) ? 1 : t < end ? 2 : 3
  const shown = Math.max(0, Math.min(rows.length, Math.floor((t - 1.6) / gap) + 1))

  return (
    <section className={s.buildCard} aria-live="polite">
      <p className={s.eyebrow}>땅굴 만들기</p>
      <h1>{name}님의 땅굴을 꾸미고 있어요</h1>
      <p className={s.buildLead}>고른 관심사를 읽고, 어울리는 물건을 고르는 중이에요.</p>

      <ol className={s.genList}>
        {GEN_STEPS.map((g, i) => (
          <li key={g} className={i < phase ? s.genDone : i === phase ? s.genNow : s.genTodo}>
            <span className={s.genMark}>{i < phase ? <Check /> : null}</span>
            {g}
            {i === 1 && i === phase && <small>관심사 {picks.length}개</small>}
          </li>
        ))}
      </ol>

      <h2 className={s.secLabel}>땅굴 무드</h2>
      {phase >= 1 ? (
        <div className={s.moodRow}>
          <div>
            <span className={s.moodBadge}>대표 관심사</span>
            <p>#{picks[0]} · {leadCat ? catName(leadCat) : ''} 태그 {inLead.length}개</p>
          </div>
          <Arrow />
          <div className={s.moodResult}>
            <span className={s.moodSwatch} style={wallSwatch(wall.id, wall.solid_color)} aria-hidden />
            <div><strong>{MOOD_NAMES[lead] ?? MOOD_NAMES.pet_plant}</strong><small>벽지 · {wall.name_ko}</small></div>
          </div>
        </div>
      ) : <div className={s.skelRow} aria-hidden />}

      <h2 className={s.secLabel}>가구 <small>{shown < rows.length ? '고르는 중…' : `${rows.length}개 골랐어요`}</small></h2>
      <ul className={s.furnList}>
        {rows.map((r, i) => i < shown ? (
          <li key={r.tag} className={s.furnRow}>
            <div>
              <span className={s.srcTag}>내 관심사</span>
              <p>#{r.tag}</p>
            </div>
            <Arrow />
            <div className={s.furnResult}>
              <span className={s.cube} style={{ background: `var(--tone-${toneOf(r.tag)}-bg)`, color: `var(--tone-${toneOf(r.tag)}-fg)` }}><Cube /></span>
              <strong>{r.name}</strong>
            </div>
          </li>
        ) : <li key={r.tag} className={s.furnSkel} aria-hidden><span /><span /><span /><span /></li>)}
      </ul>
      {phase === 3 && <p className={s.doneNote}>다 됐어요! 땅굴을 보여 드릴게요…</p>}
    </section>
  )
}

/* ---------- 4. 땅굴 미리보기 ---------- */
/**
 * 1 내 땅굴 화면과 같은 모습, 왼쪽 위 "관심사 가구 N개" / 2 땅굴 정보 카드(닉네임의 땅굴, 관심사 가구 수, 질문 3개와 답변, 관심사 태그)
 * 3 "관심사 가구 N개로 땅굴을 채웠어요. 마음에 들면 이대로 시작해요." / 4 관심사 재선택 → 온보딩 2(고른 관심사 유지, 다시 고르면 3a → 4)
 * 5 관심사 확정 → 온보딩을 마치고 내 땅굴 / 6 관심사는 나중에 내 정보에서 바꿀 수 있다는 안내
 */
function PreviewStep({ name, worn, picks, qna, onRepick, onConfirm, busy }: { name: string; worn: string[]; picks: string[]; qna: { q: string; a: string }[]; onRepick: () => void; onConfirm: () => void; busy: boolean }) {
  // 내 땅굴과 같은 방 모습 (data/roomLook.ts, 온보딩이라 꾸민 것은 없음)
  const look = useMemo(() => roomLookOf(ME_ID, picks, NO_SAVED_ROOM), [picks])
  const total = interestFurnitureCount(picks)
  // 캠퍼스 · 기수 · 층은 화면에서 고른 값이 아니라 SSAFY 인증 때 저장한 값 → GET /me (명세 03 "화면마다 부르는 API")
  const me = useMe()
  const aff = me.data ? `SSAFY ${me.data.gen}기 · ${me.data.campus} · ${me.data.floor}층` : ''
  // "관심사 확정" 전에는 아무것도 저장하지 않음 (명세 03: 도중에 나가면 저장되지 않음. 예전에는 미리보기에서 바로 기록했음)
  return (
    <div className={s.previewStage}>
      <RoomView ownerId={ME_ID} interests={picks} wallpaper={look.wallpaper} style={look.style} worn={worn} focusX={0.403} label={`${name}님의 땅굴 미리보기`}>
        <span className={s.roomBadge}>관심사 가구 {total}개</span>
      </RoomView>
      <aside className={s.previewSide}>
        <section className={s.infoCard}>
          <h2>땅굴 정보</h2>
          <div className={s.profileTop}>
            <MoleWithItems size={64} radius={12} worn={worn} />
            <div><strong>{name}님의 땅굴</strong><small className={s.aff}>{aff}</small><span>관심사 가구 {total}개</span></div>
          </div>
          <dl className={s.qnaFull}>
            {qna.map((x, i) => <div key={i}><dt>Q{i + 1}. {x.q}</dt><dd>{x.a || '아직 답하지 않았어요'}</dd></div>)}
          </dl>
          <p className={s.sideLabel}>관심사 <span>{picks.length}</span></p>
          <div className={s.chipRow}>
            {picks.map((t) => <span key={t} className={s.chip} style={{ background: `var(--tone-${toneOf(t)}-bg)`, color: `var(--tone-${toneOf(t)}-fg)` }}>{t}</span>)}
          </div>
        </section>
        <section className={s.confirmCard}>
          <p>관심사 가구 {total}개로 땅굴을 채웠어요.<br />마음에 들면 이대로 시작해요.</p>
          <div className={s.confirmBtns}>
            <button className={s.outline} onClick={onRepick}>관심사 재선택</button>
            <button className={s.next} onClick={onConfirm} disabled={busy} aria-busy={busy}>{busy ? '땅굴을 만드는 중…' : '관심사 확정'}</button>
          </div>
          <small>관심사는 나중에 내 정보에서 바꿀 수 있어요.</small>
        </section>
      </aside>
    </div>
  )
}

/* ---------- 작은 아이콘 ---------- */
const Arrow = () => <svg className={s.arrow} width="20" height="20" viewBox="0 0 20 20" aria-hidden><path d="M3.5 10h12M11 5.5l4.5 4.5-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
const Cube = () => <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path d="M12 2.8 20 7.2v9.6L12 21.2 4 16.8V7.2Z M4 7.2l8 4.4 8-4.4 M12 11.6v9.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
const Chevron = () => <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M5 2.5 9.5 7 5 11.5" fill="none" stroke="#b49a86" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
const Dice = () => <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><rect x="2" y="2" width="12" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.4" /><circle cx="5.5" cy="5.5" r="1" fill="currentColor" /><circle cx="10.5" cy="10.5" r="1" fill="currentColor" /><circle cx="8" cy="8" r="1" fill="currentColor" /></svg>
