import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import logo from '../../assets/logo-clear.png'
import MoleDresser, { MolePreview, MoleWithItems, WornChips } from '../../components/MoleDresser'
import { DEFAULT_WORN, MAX_WORN, setMyWorn, MOLE_ITEMS, MOLE_PARTS, blockedBy } from '../../data/moleItems'
import RoomView from '../../components/RoomView'
import { CATEGORIES, toneOf } from '../../data/mock'
import { MAX_PICK, interestCatOf, setMyInterests, subOf } from '../../data/interests'
import { planRoom } from '../../data/roomPlan'
import { setMyWallpaper, tileUrl, wallpaperForCategory, wallpaperForPicks, wallpaperOf } from '../../data/wallpapers'
import type { Category } from '../../data/types'
import s from './Onboarding.module.css'

/*
 * 온보딩 (design/figma/onboarding/*.png 시안 기준, 2026-11-10)
 *  2026-11-11 Figma 갱신: 1 "이름 · 두더지 꾸미기"(머리·얼굴·목·손), 4 미리보기는 메인 화면 구도 681:7764
 *  2026-11-11 3D 핸드오프 v1.1·v2: 액세서리 41개, 부위마다 1개 최대 4개, 미리 보기는 3D(mole_showcase + 회전)
 *  1 이름 408:18310 → 2 관심사 "A · 좌측 분류 전환" 408:22173 → 3 자기소개 408:18828
 *  → 4 땅굴 만들기: 3a 방 만드는 중 408:19036 → (3b 없음) → 3c 땅굴 미리보기 408:19306
 * 시안은 본문까지 Do Hyeon 이라 이 화면은 전부 display 서체.
 *  2026-11-11 3D 핸드오프 v3: 관심사는 interest_catalog.json 의 카테고리 11 · 세부 관심사 65, 최대 10개 (data/interests.ts).
 *  고른 관심사로 가구 배치는 data/roomPlan.ts (미리보기 땅굴과 /burrow 가 같은 계산)
 */

const STEPS = [
  { key: 'name', label: '나를 부르는 이름' },
  { key: 'interests', label: '관심사 선택' },
  { key: 'intro', label: '자기소개' },
  { key: 'building', label: '땅굴 만들기' },
] as const

const NAME_MAX = 12
const MIN_PICK = 3
const ANSWER_MAX = 50

const DEMO = {
  name: '새벽산책',
  worn: DEFAULT_WORN,
  picks: ['시티팝', '필름카메라', '테라리움', '체스', '수채화', 'SF소설', '베이킹', '식물키우기', '캠핑', '고전영화'],
  answers: ['엄마가 해준 김치볶음밥이요. 매운데 자꾸 생각나요.', '창문부터 열고 이불 속에서 한참 뒹굴어요.', '유명한 맛집 주방을 몰래 구경해 볼래요.'],
}

const catName = (c: Category) => c.name.replace(/\s·\s/g, '·')
const countOf = (tag: string) => CATEGORIES.flatMap((c) => c.tags).find((t) => t.name === tag)?.count ?? 9999
const catOf = (tag: string) => CATEGORIES.find((c) => c.tags.some((t) => t.name === tag))

export default function Onboarding() {
  const { step = 'name' } = useParams()
  const nav = useNavigate()
  // ?demo 로 들어오면 시안과 같은 예시 값으로 채움 (단계별 화면을 바로 보여 줄 때)
  const [params] = useSearchParams()
  const [demo] = useState(() => params.has('demo'))
  const [name, setName] = useState(demo ? DEMO.name : '')
  const [worn, setWorn] = useState<string[]>(demo ? DEMO.worn : [])
  const [picks, setPicks] = useState<string[]>(demo ? DEMO.picks : [])
  const [qs, setQs] = useState<number[]>([0, 0, 0])       // 칸마다 몇 번째 질문인지 (0 = 기본, 1 = 바꾼 질문)
  const [answers, setAnswers] = useState(demo ? DEMO.answers : ['', '', ''])

  const idx = STEPS.findIndex((x) => x.key === step || (x.key === 'building' && step === 'preview'))
  if (idx < 0) return <Navigate to="/onboarding/name" replace />
  const go = (k: string) => { nav(`/onboarding/${k}`); window.scrollTo(0, 0) }
  const nick = name.trim() || '새벽산책'
  const qna = QUESTION_SLOTS.map((slot, i) => ({ q: slot[qs[i]].q, a: answers[i].trim() }))

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
          <NameStep name={name} setName={setName} worn={worn} setWorn={setWorn} onNext={() => go('interests')} />
        )}
        {step === 'interests' && <InterestStep picks={picks} setPicks={setPicks} onPrev={() => go('name')} onNext={() => go('intro')} />}
        {step === 'intro' && (
          <IntroStep name={nick} worn={worn} picks={picks} qs={qs} setQs={setQs} answers={answers} setAnswers={setAnswers} onPrev={() => go('interests')} onNext={() => go('building')} />
        )}
        {step === 'building' && <BuildStep name={nick} picks={picks} qna={qna} onDone={() => go('preview')} />}
        {step === 'preview' && <PreviewStep name={nick} worn={worn} picks={picks} qna={qna} onRepick={() => go('interests')} />}
      </main>
    </div>
  )
}

function Check({ size = 12 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden><path d="M2.2 6.3 4.9 8.9 9.8 3.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

/* ---------- 1. 이름 · 두더지 꾸미기 (408:18310, 2026-11-11 갱신) ---------- */
// 미리 보기 상자 260×328 (.previewBox, 아래 여백 28) 안에 200×200 정사각형이 바닥 쪽 가운데에 있음.
// 3D 캔버스는 상자 전체 + 위로 72px(Figma Overflow Zone)까지 넓힘 → 260×400. 풍선 같은 키 큰 소품이 안 잘림
const PREVIEW_SIZE = 200, PREVIEW_OVERFLOW = 72
const PREVIEW_BLEED = { top: 328 - 28 - PREVIEW_SIZE + PREVIEW_OVERFLOW, right: 30, bottom: 28, left: 30 }
function NameStep(p: { name: string; setName: (v: string) => void; worn: string[]; setWorn: (v: string[]) => void; onNext: () => void }) {
  const [spin, setSpin] = useState(true)
  const trimmed = p.name.trim()
  const bad = trimmed.length > 0 && trimmed.length < 2
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
        <p>실명이나 사진은 받지 않아요</p>
      </div>
      <section className={s.card}>
        <div className={s.form}>
          <div className={s.field}>
            <label htmlFor="ob-nick">닉네임</label>
            <div className={s.inputWrap}>
              <input id="ob-nick" value={p.name} maxLength={NAME_MAX} onChange={(e) => p.setName(e.target.value)} placeholder="땅굴 문패에 적힐 이름" autoComplete="off" />
              <span className={s.counter}>{p.name.length} / {NAME_MAX}</span>
            </div>
            {bad && <span className={s.error}>두 글자 이상 적어 주세요</span>}
          </div>

          <div className={s.field}>
            <div className={s.accHead}>
              <span className={s.label}><span>두더지 꾸미기 <b className={s.wornCount}>{p.worn.length} / {MAX_WORN}</b></span><small>부위마다 하나씩 · 최대 {MAX_WORN}개까지 고를 수 있어요</small></span>
              <button className={s.randomBtn} onClick={randomize}><Dice /> 랜덤으로 꾸미기</button>
            </div>
            <MoleDresser worn={p.worn} onChange={p.setWorn} />
          </div>
        </div>

        <aside className={s.avatarSide} aria-live="polite">
          <span className={s.previewLabel}>미리 보기</span>
          <div className={s.previewBox}>
            <button className={s.spinChip} onClick={() => setSpin((v) => !v)} aria-pressed={spin}>↻ {spin ? '천천히 돌아가요' : '멈췄어요'}</button>
            <MolePreview size={PREVIEW_SIZE} bleed={PREVIEW_BLEED} worn={p.worn} spin={spin} label={`${trimmed || '내'} 두더지`} />
          </div>
          <strong>{trimmed || '닉네임'}</strong>
          {p.worn.length > 0 && <WornChips worn={p.worn} onRemove={(id) => p.setWorn(p.worn.filter((w) => w !== id))} withPart large />}
        </aside>
      </section>
      <div className={s.actions}>
        <span />
        <button className={s.next} disabled={trimmed.length < 2} onClick={p.onNext}>다음</button>
      </div>
    </>
  )
}

/* ---------- 2. 관심사 선택 (A · 좌측 분류 전환) ---------- */
function InterestStep(p: { picks: string[]; setPicks: (f: (l: string[]) => string[]) => void; onPrev: () => void; onNext: () => void }) {
  const [catId, setCatId] = useState(CATEGORIES[0].id)
  const [full, setFull] = useState(false)
  const cat = CATEGORIES.find((c) => c.id === catId)!
  const pickedIn = (c: Category) => c.tags.filter((t) => p.picks.includes(t.name)).length
  const toggle = (t: string) => {
    if (!p.picks.includes(t) && p.picks.length >= MAX_PICK) { setFull(true); return }
    setFull(false)
    p.setPicks((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t]))
  }
  return (
    <>
      <div className={s.intro}>
        <h1>요즘 마음이 가는 것들</h1>
        <p className={s.pickRule}>최소 {MIN_PICK}개 · 최대 {MAX_PICK}개를 골라주세요</p>
      </div>
      <div className={s.pickCols}>
        <nav className={s.catList} aria-label="관심 분야">
          {CATEGORIES.map((c) => {
            const n = pickedIn(c)
            return (
              <button key={c.id} className={c.id === catId ? s.catOn : s.cat} aria-current={c.id === catId ? 'true' : undefined} onClick={() => setCatId(c.id)}>
                {catName(c)}
                {n > 0 ? <em>{n}개</em> : <Chevron />}
              </button>
            )
          })}
        </nav>
        <section className={s.tagPanel} aria-label={`${catName(cat)} 관심사`}>
          <h2>{catName(cat)}</h2>
          <div className={s.tags}>
            {cat.tags.map((t) => {
              const on = p.picks.includes(t.name)
              return (
                <button key={t.name} className={on ? s.tagOn : s.tag} aria-pressed={on} onClick={() => toggle(t.name)}
                  style={{ ['--tag-bg' as string]: `var(--tone-${cat.tone}-bg)`, ['--tag-fg' as string]: `var(--tone-${cat.tone}-fg)` }}>
                  {on && <Check />}{t.name}<small>{t.count.toLocaleString()}</small>
                </button>
              )
            })}
          </div>
          <p className={s.tagNote}>숫자는 같은 관심사를 고른 두더지 수예요. 적을수록 나와 꼭 맞는 이웃을 찾기 쉬워요.</p>
          <div className={s.tray}>
            <p>선택한 관심사 <b>{p.picks.length}</b>{full && <span className={s.error}> · 최대 {MAX_PICK}개까지 고를 수 있어요</span>}</p>
            {p.picks.length === 0 ? <span className={s.trayEmpty}>왼쪽에서 분야를 고르고 마음 가는 걸 눌러 보세요</span> : (
              <div className={s.trayChips}>
                {p.picks.map((t) => (
                  <button key={t} style={{ background: `var(--tone-${toneOf(t)}-bg)`, color: `var(--tone-${toneOf(t)}-fg)` }} onClick={() => toggle(t)} aria-label={`${t} 빼기`}>
                    {t}<span aria-hidden>✕</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
      <div className={s.actions}>
        <span />
        <div className={s.btnRow}>
          <button className={s.prev} onClick={p.onPrev}>이전</button>
          <button className={s.next} disabled={p.picks.length < MIN_PICK} onClick={p.onNext}>다음</button>
        </div>
      </div>
    </>
  )
}

/* ---------- 3. 자기소개: 오직 나를 위한 질문 ---------- */
// 칸마다 [기본 질문, 바꿀 질문]. 다른 두더지와 잘 겹치지 않는 답이 나오도록 고름
const QUESTION_SLOTS = [
  [
    { q: '가장 좋아하는 음식은 뭐예요?', ex: '엄마가 해준 김치볶음밥이요. 매운데 자꾸 생각나요.' },
    { q: '요즘 가장 자주 듣는 노래는?', ex: '출근길마다 같은 시티팝 한 곡만 들어요.' },
  ],
  [
    { q: '주말 아침, 눈 뜨면 가장 먼저 하는 일은?', ex: '창문부터 열고 이불 속에서 한참 뒹굴어요.' },
    { q: '가방 속에 늘 들어 있는 물건은?', ex: '필름카메라랑 반쯤 남은 껌이요.' },
  ],
  [
    { q: '하루 동안 투명 인간이 된다면 뭐 해볼래요?', ex: '유명한 맛집 주방을 몰래 구경해 볼래요.' },
    { q: '비 오는 날 꼭 하고 싶은 일은?', ex: '창가에서 라면 끓여 먹으면서 영화 보기요.' },
  ],
]

function IntroStep(p: { name: string; worn: string[]; picks: string[]; qs: number[]; setQs: (v: number[]) => void; answers: string[]; setAnswers: (v: string[]) => void; onPrev: () => void; onNext: () => void }) {
  return (
    <>
      <div className={s.intro}>
        <h1>오직 나를 위한 질문</h1>
        <p>다른 두더지와 잘 겹치지 않는 질문을 골랐어요. 답 한 줄이 첫 대화의 실마리가 돼요.</p>
      </div>
      <section className={s.card}>
        <div className={s.qForm}>
          {QUESTION_SLOTS.map((slot, i) => {
            const cur = slot[p.qs[i]]
            return (
              <div key={i} className={s.field}>
                <div className={s.qHead}>
                  <label htmlFor={`ob-q${i}`}>Q{i + 1}. {cur.q}</label>
                  <button className={s.swap} disabled={p.qs[i] > 0} onClick={() => { const n = [...p.qs]; n[i] = 1; p.setQs(n); const a = [...p.answers]; a[i] = ''; p.setAnswers(a) }}>
                    {p.qs[i] > 0 ? '질문을 바꿨어요' : '다른 질문으로 바꾸기 (1회)'}
                  </button>
                </div>
                <div className={s.areaWrap}>
                  <textarea id={`ob-q${i}`} maxLength={ANSWER_MAX} value={p.answers[i]} placeholder={`예) ${cur.ex}`}
                    onChange={(e) => { const a = [...p.answers]; a[i] = e.target.value; p.setAnswers(a) }} />
                  <span className={s.counter}>{p.answers[i].length} / {ANSWER_MAX}</span>
                </div>
              </div>
            )
          })}
        </div>
        <aside className={s.cardSide}>
          <p className={s.sideLabel}>내 땅굴에선 이렇게 보여요</p>
          <div className={s.profileCard}>
            <div className={s.profileTop}>
              <MoleWithItems size={52} radius={12} worn={p.worn} />
              <div><strong>{p.name}</strong><span>관심사 {p.picks.length}개</span></div>
            </div>
            <dl className={s.qnaBox}>
              {QUESTION_SLOTS.map((slot, i) => (
                <div key={i}><dt>Q{i + 1}. {slot[p.qs[i]].q}</dt>{p.answers[i].trim() && <dd>{p.answers[i].trim()}</dd>}</div>
              ))}
            </dl>
            <div className={s.chipRow}>
              {p.picks.slice(0, 4).map((t) => <span key={t} className={s.chip} style={{ background: `var(--tone-${toneOf(t)}-bg)`, color: `var(--tone-${toneOf(t)}-fg)` }}>{t}</span>)}
              {p.picks.length > 4 && <span className={s.more}>+{p.picks.length - 4}</span>}
            </div>
          </div>
          <p className={s.sideNote}>방문한 두더지는 이 카드를 보고 말을 걸어요.</p>
        </aside>
      </section>
      <div className={s.actions}>
        <span className={s.footNote}>답변은 나중에 내 땅굴에서 언제든 수정할 수 있어요.</span>
        <div className={s.btnRow}>
          <button className={s.prev} onClick={p.onPrev}>이전</button>
          <button className={s.next} onClick={p.onNext}>다음</button>
        </div>
      </div>
    </>
  )
}

/* ---------- 4a. 땅굴 만들기: 방 만드는 중 ---------- */
// 관심사 → 놓이는 물건은 카탈로그(interest_catalog 의 prop, furniture_catalog 의 이름)에서. 답변에서 찾을 단어 = 관심사·물건 이름 조각
const keysOf = (...names: string[]) => [...new Set(names.flatMap((n) => n.split(/[·\s]+/)).filter((k) => k.length >= 2))]

// 분류별 땅굴 무드 (가장 무거운 분류로 정함. 무게는 legacy 의 tasteWeights 와 같은 Σ(1 + 1000/인원))
// 벽은 v3.5.1 벽지 (data/wallpapers.ts mood_map: 같은 카테고리 → 벽지, 정해지지 않은 카테고리는 01 기본 단색)
const MOODS: Record<string, { name: string }> = {
  music: { name: '레코드 가게 무드' },
  photo: { name: '작은 암실 무드' },
  nature: { name: '작은 온실 무드' },
  game: { name: '동네 오락실 무드' },
  craft: { name: '작업실 무드' },
  book: { name: '다락 서재 무드' },
  science: { name: '별 관측소 무드' },
  tea_coffee: { name: '골목 카페 무드' },
  outdoor: { name: '캠핑장 무드' },
  movie: { name: '작은 극장 무드' },
  pet: { name: '포근한 둥지 무드' },
}

/** 벽지 견본 (타일 그림, 01 기본은 단색) */
const wallSwatch = (id: string, solid?: string) => {
  const u = tileUrl(id, 512)
  return u ? { background: `url(${u}) center / 48px repeat` } : { background: solid }
}

type QnA = { q: string; a: string }

function buildPlan(picks: string[], qna: QnA[]) {
  const weight = new Map<string, number>()
  for (const t of picks) { const c = catOf(t); if (c) weight.set(c.id, (weight.get(c.id) ?? 0) + 1 + 1000 / countOf(t)) }
  const topId = [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'nature'
  const top = CATEGORIES.find((c) => c.id === topId)!
  const inTop = picks.filter((t) => catOf(t)?.id === topId)
  const rarest = [...inTop].sort((a, b) => countOf(a) - countOf(b))[0]
  const room = planRoom(picks)
  // 한 줄 = 카테고리 가구 묶음(그 카테고리를 처음 고른 관심사가 근거) 또는 관심사 소품
  const rows: { key: string; tag: string; item: string; quote?: string; tone: ReturnType<typeof toneOf>; ready: boolean }[] = []
  for (const c of room.categories) {
    const furn = room.items.filter((it) => it.category === c && !it.sub)
    if (!furn.length) continue
    const tag = picks.find((t) => subOf(t)?.category === c)!
    const names = furn.map((it) => it.row.name_ko)
    const hit = qna.find((x) => x.a && keysOf(interestCatOf(c)?.name_ko ?? '', ...names).some((k) => x.a.includes(k)))
    rows.push({ key: `cat:${c}`, tag: interestCatOf(c)?.name_ko ?? tag, item: names.join(' · '), quote: hit?.a, tone: toneOf(tag), ready: furn.every((it) => it.built) })
  }
  for (const t of picks) {
    const sub = subOf(t)
    const props = room.items.filter((it) => it.sub === sub?.id)
    if (!sub || !props.length) continue
    const names = props.map((it) => it.row.name_ko)
    const hit = qna.find((x) => x.a && keysOf(sub.name_ko, ...names).some((k) => x.a.includes(k)))
    rows.push({ key: sub.id, tag: t, item: names.join(' · '), quote: hit?.a, tone: toneOf(t), ready: props.every((it) => it.built) })
  }
  // 답변을 근거로 한 줄을 위로 (시안처럼 "내 답변"이 먼저 보이게)
  rows.sort((a, b) => Number(!!b.quote) - Number(!!a.quote))
  return { mood: MOODS[topId] ?? MOODS.nature, wall: wallpaperOf(wallpaperForCategory(topId)), top, rarest, topCount: inTop.length, rows, count: room.items.length }
}

const GEN_STEPS = ['관심사 읽는 중', '무드와 물건 고르는 중', '땅굴에 배치하고 벽 꾸미는 중']

function BuildStep({ name, picks, qna, onDone }: { name: string; picks: string[]; qna: QnA[]; onDone: () => void }) {
  const plan = useMemo(() => buildPlan(picks, qna), [picks, qna])
  const answered = qna.filter((x) => x.a).length
  // 시간표: 0 관심사 읽기 → 1 무드 → 가구가 0.45초마다 한 줄씩 → 2 배치 → 끝나면 미리보기
  const [t, setT] = useState(0)
  // 한 줄씩 0.45초 (줄이 많으면 전체가 6초 안에 끝나게 빨리)
  const gap = Math.min(0.45, 6 / Math.max(1, plan.rows.length))
  const rowsAt = (n: number) => 1.6 + n * gap
  const end = rowsAt(plan.rows.length) + 1.4
  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    // 모션 줄이기: 다 채운 상태를 바로 보여 주고 잠시 뒤 넘어감
    if (reduce) { setT(end); const id = setTimeout(() => setT(end + 0.9), 2200); return () => clearTimeout(id) }
    const start = performance.now()
    let raf = 0
    const tick = () => { const v = (performance.now() - start) / 1000; setT(v); if (v < end + 0.9) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [end])
  const left = useRef(false)
  useEffect(() => { if (t >= end + 0.9 && !left.current) { left.current = true; onDone() } }, [t, end, onDone])

  const phase = t < 0.8 ? 0 : t < rowsAt(plan.rows.length) ? 1 : t < end ? 2 : 3
  const shown = Math.max(0, Math.min(plan.rows.length, Math.floor((t - 1.6) / gap) + 1))
  const placeholders = Math.min(3, plan.rows.length - shown)

  return (
    <section className={s.buildCard} aria-live="polite">
      <p className={s.eyebrow}>땅굴 만들기</p>
      <h1>{name}님의 땅굴을 꾸미고 있어요</h1>
      <p className={s.buildLead}>고른 관심사와 적어 주신 답변을 읽고, 어울리는 물건을 고르는 중이에요.</p>

      <ol className={s.genList}>
        {GEN_STEPS.map((g, i) => (
          <li key={g} className={i < phase ? s.genDone : i === phase ? s.genNow : s.genTodo}>
            <span className={s.genMark}>{i < phase ? <Check /> : null}</span>
            {g}
            {i === 1 && i === phase && <small>관심사 {picks.length}개 · 답변 {answered}개</small>}
          </li>
        ))}
      </ol>

      <h2 className={s.secLabel}>땅굴 무드</h2>
      {phase >= 1 ? (
        <div className={s.moodRow}>
          <div>
            <span className={s.moodBadge}>가장 큰 취향</span>
            <p>#{plan.rarest} · {catName(plan.top)} 태그 {plan.topCount}개</p>
          </div>
          <Arrow />
          <div className={s.moodResult}>
            <span className={s.moodSwatch} style={wallSwatch(plan.wall.id, plan.wall.solid_color)} aria-hidden />
            <div><strong>{plan.mood.name}</strong><small>벽지 · {plan.wall.name_ko}</small></div>
          </div>
        </div>
      ) : <div className={s.skelRow} aria-hidden />}

      <h2 className={s.secLabel}>가구 <small>{shown < plan.rows.length ? '고르는 중…' : `${plan.count}개 골랐어요`}</small></h2>
      <ul className={s.furnList}>
        {plan.rows.slice(0, shown).map((r) => (
          <li key={r.key} className={s.furnRow}>
            <div>
              <span className={s.srcTag}>{r.quote ? '내 답변' : '내 관심사'}</span>
              <p>{r.quote ? `"${r.quote}"` : `#${r.tag}`}</p>
            </div>
            <Arrow />
            <div className={s.furnResult}>
              <span className={s.cube} style={{ background: `var(--tone-${r.tone}-bg)`, color: `var(--tone-${r.tone}-fg)` }}><Cube /></span>
              <strong>{r.item}</strong>{!r.ready && <small className={s.notReady}>모델 준비 중</small>}
            </div>
          </li>
        ))}
        {Array.from({ length: placeholders }).map((_, i) => <li key={`sk${i}`} className={s.furnSkel} aria-hidden><span /><span /><span /><span /></li>)}
      </ul>
      {phase === 3 && <p className={s.doneNote}>다 됐어요! 땅굴로 데려갈게요…</p>}
    </section>
  )
}

/* ---------- 4. 땅굴 미리보기 (메인 화면 기준, Figma 681:7764) ---------- */
// 방이 화면 전체를 채우고, 오른쪽에 땅굴 정보 카드 + 확정 카드가 떠 있음 (내 땅굴 메인과 같은 구도)
function PreviewStep({ name, worn, picks, qna, onRepick }: { name: string; worn: string[]; picks: string[]; qna: QnA[]; onRepick: () => void }) {
  const room = useMemo(() => planRoom(picks), [picks])
  const wallpaper = useMemo(() => wallpaperForPicks(picks), [picks])
  // 미리보기에 들어오면 바로 내 관심사·꾸미기·벽지로 기록: "관심사 확정" 대신 위 메뉴(땅굴)로 나가도 같은 방이 나오게
  useEffect(() => { setMyInterests(picks); setMyWorn(worn); setMyWallpaper(wallpaper) }, [picks, worn, wallpaper])
  const total = room.items.length, todo = room.items.filter((it) => !it.built).length
  return (
    <div className={s.previewStage}>
      <RoomView ownerId="me" interests={picks} wallpaper={wallpaper} worn={worn} focusX={0.403} label={`${name}님의 땅굴 미리보기`}>
        <span className={s.roomBadge}>관심사 가구 {total}개{todo > 0 && ` · ${todo}개는 3D 모델 준비 중(블록)`}</span>
      </RoomView>
      <aside className={s.previewSide}>
        <section className={s.infoCard}>
          <h2>땅굴 정보</h2>
          <div className={s.profileTop}>
            <MoleWithItems size={64} radius={12} worn={worn} />
            <div><strong>{name}님의 땅굴</strong><span>관심사 가구 {total}개</span></div>
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
            <Link to="/burrow" className={s.next} onClick={() => { setMyWorn(worn); setMyInterests(picks) }}>관심사 확정</Link>
          </div>
          <small>관심사는 나중에 내 정보에서 바꿀 수 있어요.</small>
        </section>
      </aside>
    </div>
  )
}

/* ---------- 작은 아이콘 ---------- */
const Chevron = () => <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
const Arrow = () => <svg className={s.arrow} width="20" height="20" viewBox="0 0 20 20" aria-hidden><path d="M3.5 10h12M11 5.5l4.5 4.5-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
const Cube = () => <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path d="M12 2.8 20 7.2v9.6L12 21.2 4 16.8V7.2Z M4 7.2l8 4.4 8-4.4 M12 11.6v9.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
const Dice = () => <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><rect x="2" y="2" width="12" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.4" /><circle cx="5.5" cy="5.5" r="1" fill="currentColor" /><circle cx="10.5" cy="10.5" r="1" fill="currentColor" /><circle cx="8" cy="8" r="1" fill="currentColor" /></svg>
