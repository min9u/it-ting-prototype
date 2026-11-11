import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import logo from '../../assets/logo-clear.png'
import MoleDresser, { MolePreview, MoleWithItems, WornChips } from '../../components/MoleDresser'
import { DEFAULT_WORN, MAX_WORN, MOLE_ITEMS, MOLE_PARTS, blockedBy, lockOf } from '../../data/moleItems'
import RoomView from '../../components/RoomView'
import { CATEGORIES, toneOf } from '../../data/mock'
import type { Category } from '../../data/types'
import s from './Onboarding.module.css'

/*
 * 온보딩 (design/figma/onboarding/*.png 시안 기준, 2026-11-10)
 *  2026-11-11 Figma 갱신: 1 "이름 · 두더지 꾸미기"(머리·얼굴·목·손), 4 미리보기는 메인 화면 구도 681:7764
 *  2026-11-11 3D 핸드오프 v1.1·v2: 액세서리 41개, 부위마다 1개 최대 4개, 미리 보기는 3D(mole_showcase + 회전)
 *  1 이름 408:18310 → 2 관심사 "A · 좌측 분류 전환" 408:22173 → 3 자기소개 408:18828
 *  → 4 땅굴 만들기: 3a 방 만드는 중 408:19036 → (3b 없음) → 3c 땅굴 미리보기 408:19306
 * 시안은 본문까지 Do Hyeon 이라 이 화면은 전부 display 서체.
 */

const STEPS = [
  { key: 'name', label: '나를 부르는 이름' },
  { key: 'interests', label: '관심사 선택' },
  { key: 'intro', label: '자기소개' },
  { key: 'building', label: '땅굴 만들기' },
] as const

const NAME_MAX = 12
const MIN_PICK = 3
const MAX_PICK = 10
const ANSWER_MAX = 50

const DEMO = {
  name: '새벽산책',
  worn: DEFAULT_WORN,
  picks: ['시티팝', '필름카메라', '테라리움', '체스', '공연', '독립서점', '요리', '반려식물', '캠핑', '홈카페'],
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
function NameStep(p: { name: string; setName: (v: string) => void; worn: string[]; setWorn: (v: string[]) => void; onNext: () => void }) {
  const [spin, setSpin] = useState(true)
  const trimmed = p.name.trim()
  const bad = trimmed.length > 0 && trimmed.length < 2
  // 랜덤: 부위마다 하나씩 (잠긴 것·같이 못 끼는 조합은 빼고)
  const randomize = () => {
    const out: string[] = []
    for (const { part } of MOLE_PARTS) {
      const l = MOLE_ITEMS.filter((i) => i.part === part && !lockOf(i) && !blockedBy(i.id, out))
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
            <MolePreview size={200} worn={p.worn} spin={spin} label={`${trimmed || '내'} 두더지`} />
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
// 관심사 → 가구. keys 는 답변에서 찾을 단어 (있으면 "내 답변"을 근거로 보여 줌)
const FURNITURE: Record<string, { item: string; keys: string[] }> = {
  시티팝: { item: 'LP 플레이어', keys: ['시티팝', 'LP', '레코드'] },
  'LP 수집': { item: 'LP 선반', keys: ['LP', '레코드', '음반'] },
  재즈: { item: '재즈 포스터', keys: ['재즈'] },
  인디밴드: { item: '밴드 포스터', keys: ['밴드', '인디'] },
  공연: { item: '공연 티켓 액자', keys: ['공연', '콘서트', '티켓'] },
  작곡: { item: '작은 신디사이저', keys: ['작곡', '건반'] },
  플레이리스트: { item: '블루투스 스피커', keys: ['노래', '음악', '플레이리스트'] },
  클래식: { item: '축음기', keys: ['클래식'] },
  '뮤직 페스티벌': { item: '페스티벌 손목띠 액자', keys: ['페스티벌'] },
  피아노: { item: '업라이트 피아노', keys: ['피아노'] },
  음악: { item: '스피커', keys: ['음악', '노래'] },
  사진: { item: '카메라 삼각대', keys: ['사진', '카메라'] },
  필름카메라: { item: '필름카메라', keys: ['필름', '카메라'] },
  폴라로이드: { item: '폴라로이드 줄', keys: ['폴라로이드'] },
  '풍경 사진': { item: '풍경 사진 액자', keys: ['풍경'] },
  '인물 사진': { item: '사진 보드', keys: ['인물'] },
  테라리움: { item: '이끼 테라리움', keys: ['이끼', '테라리움'] },
  반려식물: { item: '화분 선반', keys: ['식물', '화분'] },
  텃밭: { item: '상자 텃밭', keys: ['텃밭', '상추'] },
  꽃꽂이: { item: '꽃병', keys: ['꽃'] },
  산책: { item: '산책 지도', keys: ['산책', '걷'] },
  게임: { item: '오락기', keys: ['게임'] },
  보드게임: { item: '보드게임 선반', keys: ['보드게임'] },
  체스: { item: '체스판', keys: ['체스'] },
  '레트로 게임': { item: '레트로 TV', keys: ['레트로', '오락'] },
  방탈출: { item: '자물쇠 상자', keys: ['방탈출'] },
  그림: { item: '이젤', keys: ['그림', '그리'] },
  뜨개질: { item: '털실 바구니', keys: ['뜨개', '털실'] },
  도자기: { item: '물레', keys: ['도자기', '그릇'] },
  레고: { item: '레고 선반', keys: ['레고'] },
  다꾸: { item: '스티커 서랍', keys: ['다꾸', '스티커', '다이어리'] },
  독서: { item: '책장', keys: ['책', '읽'] },
  독립서점: { item: '서점 도장 포스터', keys: ['서점'] },
  필사: { item: '필사 책상', keys: ['필사', '만년필'] },
  'SF 소설': { item: '우주선 북엔드', keys: ['SF', '소설'] },
  에세이: { item: '책 더미', keys: ['에세이'] },
  '별 보기': { item: '별자리 조명', keys: ['별'] },
  '천체 사진': { item: '천체망원경', keys: ['천체', '망원경'] },
  '과학 유튜브': { item: '지구본', keys: ['과학', '유튜브'] },
  요리: { item: '작은 주방', keys: ['요리', '김치볶음밥', '라면', '맛집', '음식'] },
  홈카페: { item: '홈카페 선반', keys: ['카페', '커피'] },
  베이킹: { item: '오븐', keys: ['빵', '베이킹', '쿠키'] },
  핸드드립: { item: '드립 주전자', keys: ['드립', '커피'] },
  전통차: { item: '찻병 선반', keys: ['차', '다도'] },
  운동: { item: '러닝머신', keys: ['운동', '헬스'] },
  캠핑: { item: '캠핑 배낭', keys: ['캠핑', '텐트'] },
  여행: { item: '여행 가방', keys: ['여행', '비행기'] },
  등산: { item: '등산 지팡이', keys: ['등산', '산'] },
  클라이밍: { item: '클라이밍 홀드 벽', keys: ['클라이밍'] },
  러닝: { item: '러닝화 선반', keys: ['러닝', '달리'] },
  영화: { item: '영사기', keys: ['영화'] },
  지브리: { item: '숲 속 포스터', keys: ['지브리'] },
  독립영화: { item: '필름 릴', keys: ['독립영화'] },
  애니메이션: { item: '피규어 선반', keys: ['애니'] },
  강아지: { item: '강아지 방석', keys: ['강아지', '산책'] },
  고양이: { item: '캣타워', keys: ['고양이', '냥'] },
  파충류: { item: '사육장', keys: ['파충류', '도마뱀'] },
}
const furnitureOf = (tag: string) => FURNITURE[tag] ?? { item: `${tag} 소품`, keys: [tag] }

// 분류별 땅굴 무드 (가장 무거운 분류로 정함. 무게는 legacy 의 tasteWeights 와 같은 Σ(1 + 1000/인원))
const MOODS: Record<string, { name: string; desc: string; wall: string; floor: string }> = {
  music: { name: '레코드 가게 무드', desc: '라일락 벽 · 체크 러그', wall: '#e6ddeb', floor: '#9a7aa6' },
  photo: { name: '작은 암실 무드', desc: '민트 벽 · 원목 마루', wall: '#d5e8df', floor: '#b98a5e' },
  nature: { name: '작은 온실 무드', desc: '세이지 벽 · 테라코타 타일', wall: '#cfddc6', floor: '#c98a62' },
  game: { name: '동네 오락실 무드', desc: '하늘색 벽 · 격자 타일', wall: '#d9e6ec', floor: '#6b7fa0' },
  craft: { name: '작업실 무드', desc: '점토색 벽 · 물감 묻은 마루', wall: '#f1dccb', floor: '#b8744c' },
  book: { name: '다락 서재 무드', desc: '버터색 벽 · 짙은 원목', wall: '#f3e6be', floor: '#8a5a3a' },
  space: { name: '별 관측소 무드', desc: '밤하늘 벽 · 별무늬 러그', wall: '#3b4466', floor: '#c9b98a' },
  cafe: { name: '골목 카페 무드', desc: '크림 벽 · 체크 타일', wall: '#f3e6be', floor: '#c98a62' },
  outdoor: { name: '캠핑장 무드', desc: '모래색 벽 · 나무 데크', wall: '#eadfc6', floor: '#8fae5c' },
  movie: { name: '작은 극장 무드', desc: '장밋빛 벽 · 벨벳 러그', wall: '#f2d9d9', floor: '#8a3a3f' },
  pet: { name: '포근한 둥지 무드', desc: '점토색 벽 · 폭신한 러그', wall: '#f1dccb', floor: '#d9a046' },
}

type QnA = { q: string; a: string }

function buildPlan(picks: string[], qna: QnA[]) {
  const weight = new Map<string, number>()
  for (const t of picks) { const c = catOf(t); if (c) weight.set(c.id, (weight.get(c.id) ?? 0) + 1 + 1000 / countOf(t)) }
  const topId = [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'nature'
  const top = CATEGORIES.find((c) => c.id === topId)!
  const inTop = picks.filter((t) => catOf(t)?.id === topId)
  const rarest = [...inTop].sort((a, b) => countOf(a) - countOf(b))[0]
  const rows = picks.map((tag) => {
    const f = furnitureOf(tag)
    const hit = qna.find((x) => x.a && f.keys.some((k) => x.a.includes(k)))
    return { tag, item: f.item, quote: hit?.a, tone: toneOf(tag) }
  })
  // 답변을 근거로 한 줄을 위로 (시안처럼 "내 답변"이 먼저 보이게)
  rows.sort((a, b) => Number(!!b.quote) - Number(!!a.quote))
  return { mood: MOODS[topId] ?? MOODS.nature, top, rarest, topCount: inTop.length, rows }
}

const GEN_STEPS = ['관심사 읽는 중', '무드와 물건 고르는 중', '땅굴에 배치하고 벽 꾸미는 중']

function BuildStep({ name, picks, qna, onDone }: { name: string; picks: string[]; qna: QnA[]; onDone: () => void }) {
  const plan = useMemo(() => buildPlan(picks, qna), [picks, qna])
  const answered = qna.filter((x) => x.a).length
  // 시간표: 0 관심사 읽기 → 1 무드 → 가구가 0.45초마다 한 줄씩 → 2 배치 → 끝나면 미리보기
  const [t, setT] = useState(0)
  const rowsAt = (n: number) => 1.6 + n * 0.45
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
  const shown = Math.max(0, Math.min(plan.rows.length, Math.floor((t - 1.6) / 0.45) + 1))
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
            <span className={s.moodSwatch} style={{ background: `linear-gradient(${plan.mood.wall} 55%, ${plan.mood.floor} 55%)` }} aria-hidden />
            <div><strong>{plan.mood.name}</strong><small>{plan.mood.desc}</small></div>
          </div>
        </div>
      ) : <div className={s.skelRow} aria-hidden />}

      <h2 className={s.secLabel}>가구 <small>{shown < plan.rows.length ? '고르는 중…' : `${plan.rows.length}개 골랐어요`}</small></h2>
      <ul className={s.furnList}>
        {plan.rows.slice(0, shown).map((r) => (
          <li key={r.tag} className={s.furnRow}>
            <div>
              <span className={s.srcTag}>{r.quote ? '내 답변' : '내 관심사'}</span>
              <p>{r.quote ? `"${r.quote}"` : `#${r.tag}`}</p>
            </div>
            <Arrow />
            <div className={s.furnResult}>
              <span className={s.cube} style={{ background: `var(--tone-${r.tone}-bg)`, color: `var(--tone-${r.tone}-fg)` }}><Cube /></span>
              <strong>{r.item}</strong>
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
  return (
    <div className={s.previewStage}>
      <RoomView ownerId="me" interests={picks} worn={worn} focusX={0.403} label={`${name}님의 땅굴 미리보기`}>
        <span className={s.roomBadge}>관심사 가구 {picks.length}개</span>
      </RoomView>
      <aside className={s.previewSide}>
        <section className={s.infoCard}>
          <h2>땅굴 정보</h2>
          <div className={s.profileTop}>
            <MoleWithItems size={64} radius={12} worn={worn} />
            <div><strong>{name}님의 땅굴</strong><span>관심사 가구 {picks.length}개</span></div>
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
          <p>관심사 가구 {picks.length}개로 땅굴을 채웠어요.<br />마음에 들면 이대로 시작해요.</p>
          <div className={s.confirmBtns}>
            <button className={s.outline} onClick={onRepick}>관심사 재선택</button>
            <Link to="/burrow" className={s.next}>관심사 확정</Link>
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
