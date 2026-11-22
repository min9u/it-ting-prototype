import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import logo from '../../assets/logo-clear.png'
import MoleDresser, { MolePreview, MoleWithItems, WornChips } from '../../components/MoleDresser'
import Modal from '../../components/Modal'
import { DEFAULT_WORN, MAX_WORN, setMyWorn, MOLE_ITEMS, MOLE_PARTS, blockedBy } from '../../data/moleItems'
import RoomView from '../../components/RoomView'
import { CATEGORIES, ME_ID, toneOf } from '../../data/mock'
import { MAX_PICK, setMyInterests, subOf } from '../../data/interests'
import { tileUrl, wallpaperOf } from '../../data/wallpapers'
import { ANSWER_MAX, ANSWER_MIN, answerOk, questionOf, questionTag, recommendedQuestions } from '../../data/questions'
import {
  MIN_PICK, MOOD_NAMES, NICK_MAX, defaultFurniture, interestFurnitureCount, isRare, leadCategory, nickTaken, resetMyRoom, setMyProfile,
} from '../../data/myBurrow'
import { NO_SAVED_ROOM, roomLookOf } from '../../data/roomLook'
import type { Category } from '../../data/types'
import QuestionList from './QuestionList'
import s from './Onboarding.module.css'

/*
 * 온보딩 (02 "스켈레톤 기능 명세" F3 기준으로 다시 맞춤, 2026-11-16. docs/spec-f3-f4.md)
 *  헤더(00 공통 12): 로고만, 메뉴·건너뛰기 없음. 진행 단계 4개(나를 부르는 이름 → 내 관심사 선택 → 자기소개 → 땅굴 만들기)
 *  1 이름 · 두더지 꾸미기 → 2 관심사(분야 카드 + 분야 팝업, 최대 10개) → 3 자기소개(질문 목록에서 3개 고르기)
 *  → 3a 땅굴 만드는 중(버튼 없음, 끝나면 자동) → 4 땅굴 미리보기(관심사 재선택 / 관심사 확정)
 * 시안은 본문까지 Do Hyeon 이라 이 화면은 전부 display 서체.
 * 관심사는 2026-11-18 확정본 대분류 12 · 소분류 90 (data/interestTags.ts → data/interests.ts). 가구 배치는 data/roomPlan.ts
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

  const idx = STEPS.findIndex((x) => x.key === step || (x.key === 'building' && step === 'preview'))
  if (idx < 0) return <Navigate to="/onboarding/name" replace />
  const go = (k: string) => { nav(`/onboarding/${k}`); window.scrollTo(0, 0) }
  const nick = name.trim() || '새벽산책'
  const qna = qids.map((id) => ({ q: questionOf(id)?.text ?? '', a: (answers[id] ?? '').trim() }))

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
        {step === 'interests' && (
          <InterestStep picks={picks} setPicks={setPicks} onPrev={() => go('name')} onNext={() => { if (repick) { setRepick(false); go('building') } else go('intro') }} />
        )}
        {step === 'intro' && (
          <IntroStep name={nick} worn={worn} picks={picks} qids={qids} setQids={setQids} answers={answers} setAnswers={setAnswers} onPrev={() => go('interests')} onNext={() => go('building')} />
        )}
        {step === 'building' && <BuildStep name={nick} picks={picks} onDone={() => nav('/onboarding/preview', { replace: true })} />}
        {step === 'preview' && (
          <PreviewStep name={nick} worn={worn} picks={picks} qna={qna}
            onRepick={() => { setRepick(true); go('interests') }}
            onConfirm={() => {
              setMyProfile({ nickname: nick, intro: '', qna: qids.map((id) => ({ qid: id, a: (answers[id] ?? '').trim() })) })
              // 새로 시작: 꾸민 것(가구 선택 · 직접 고른 벽지)을 비움 → 방 모습은 관심사로 계산 (data/roomLook.ts)
              setMyWorn(worn); setMyInterests(picks); resetMyRoom()
            }} />
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
function NameStep(p: { name: string; setName: (v: string) => void; worn: string[]; setWorn: (v: string[]) => void; onNext: () => void }) {
  const [spin, setSpin] = useState(true)
  const trimmed = p.name.trim()
  const taken = nickTaken(trimmed)
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
              <input id="ob-nick" value={p.name} maxLength={NICK_MAX} onChange={(e) => p.setName(e.target.value)} placeholder="다른 두더지에게 보이는 이름" autoComplete="off" aria-invalid={taken} />
              <span className={s.counter}>{p.name.length} / {NICK_MAX}</span>
            </div>
            {taken && <span className={s.error}>이미 쓰고 있는 닉네임이에요. 다른 닉네임을 적어 주세요</span>}
            {!taken && <span className={s.hintLine}>나중에 내 땅굴의 "내 정보 수정"에서 바꿀 수 있어요</span>}
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
        <button className={s.next} disabled={!trimmed || taken} onClick={p.onNext}>다음</button>
      </div>
    </>
  )
}

/* ---------- 2. 내 관심사 선택 (분야 카드 + 분야 팝업) ---------- */
/**
 * 1 "내 관심사 선택하기" + 한 줄 안내 / 2 분야 12개 카드(4칸 × 3줄), 누르면 세부 관심사 팝업 / 3 고른 게 있으면 테두리 + "✓ N개", 없으면 "선택"
 * 4 선택한 관심사(개수 + 고른 순서, 맨 앞 = 대표 관심사 → 땅굴 무드), ×로 바로 해제 / 5 이전 · 다음(3개 이상), 최대 10개
 * 10개 초과: "N · 최대 10개"(10개면 빨간 글씨), 안 고른 분야 카드는 흐리게, 더 고르면 안내 3초
 */
function InterestStep(p: { picks: string[]; setPicks: (f: (l: string[]) => string[]) => void; onPrev: () => void; onNext: () => void }) {
  const [openCat, setOpenCat] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const full = p.picks.length >= MAX_PICK
  const toggle = (t: string) => {
    if (p.picks.includes(t)) { setOver(false); p.setPicks((l) => l.filter((x) => x !== t)); return }
    if (full) { setOver(true); clearTimeout(timer.current); timer.current = window.setTimeout(() => setOver(false), 3000); return }
    p.setPicks((l) => [...l, t])
  }
  const cat = CATEGORIES.find((c) => c.id === openCat)
  return (
    <>
      <div className={s.intro}>
        <h1>내 관심사 선택하기</h1>
        <p>카테고리를 누르면 세부 관심사를 선택할 수 있어요</p>
      </div>
      <section className={s.catBoard}>
        <div className={s.catGrid}>
          {CATEGORIES.map((c) => {
            const mine = c.tags.filter((t) => p.picks.includes(t.name))
            const ex = (mine.length ? mine.map((t) => t.name) : c.tags.slice(0, 2).map((t) => t.name)).slice(0, 3).join(' · ')
            return (
              <button key={c.id} className={mine.length ? s.catCardOn : full ? `${s.catCard} ${s.catCardDim}` : s.catCard} onClick={() => setOpenCat(c.id)} aria-label={`${catName(c)} 관심사 고르기${mine.length ? `, ${mine.length}개 고름` : ''}`}>
                <span className={s.catIcon} style={{ background: `var(--tone-${c.tone}-bg)` }} aria-hidden>{c.emoji}</span>
                <span className={mine.length ? s.catBadgeOn : s.catBadge}>{mine.length ? <><Check size={10} /> {mine.length}개</> : '선택'}</span>
                <strong>{catName(c)}</strong>
                <small>{ex}</small>
              </button>
            )
          })}
        </div>
        <div className={s.tray}>
          <p>선택한 관심사 <b>{p.picks.length}</b> <span className={full ? s.limitOn : s.limit}>· 최대 {MAX_PICK}개</span>
            {p.picks.length > 0 && <span className={s.trayLead}>맨 앞 관심사가 땅굴 분위기를 정해요</span>}</p>
          {p.picks.length === 0 ? <span className={s.trayEmpty}>분야 카드를 눌러 마음 가는 관심사를 골라 보세요</span> : (
            <div className={s.trayChips}>
              {p.picks.map((t, i) => (
                <button key={t} style={{ background: `var(--tone-${toneOf(t)}-bg)`, color: `var(--tone-${toneOf(t)}-fg)` }} onClick={() => toggle(t)} aria-label={`${t} 빼기`}>
                  {i === 0 && <em className={s.leadMark}>대표</em>}{t}<span aria-hidden>✕</span>
                </button>
              ))}
            </div>
          )}
          {over && !cat && <p className={s.overToast} role="status">관심사는 최대 {MAX_PICK}개까지 고를 수 있어요. 다른 관심사를 빼고 골라 주세요.</p>}
        </div>
      </section>
      <div className={s.actions}>
        <span className={s.footNote}>나중에 언제든 바꿀 수 있어요.</span>
        <div className={s.btnRow}>
          <button className={s.prev} onClick={p.onPrev}>이전</button>
          <button className={s.next} disabled={p.picks.length < MIN_PICK} onClick={p.onNext}>다음</button>
        </div>
      </div>

      {/* 분야 팝업: 닫기 · 바깥 · ESC · 고르기 완료 모두 고른 내용 유지 (팝업에서 누르는 즉시 반영) */}
      <Modal open={!!cat} onClose={() => setOpenCat(null)} width={600} labelledBy="cat-pop-title">
        {cat && (
          <div className={s.catPop}>
            <div className={s.catPopHead}>
              <span className={s.catIcon} style={{ background: `var(--tone-${cat.tone}-bg)` }} aria-hidden>{cat.emoji}</span>
              <div>
                <h2 id="cat-pop-title">{catName(cat)}</h2>
                <p>마음 가는 걸 모두 골라주세요. 여러 개 골라도 좋아요.</p>
              </div>
            </div>
            {([['많이 고르는 취향', cat.tags.filter((t) => !isRare(t.count))], ['아는 사람끼리 통하는 취향', cat.tags.filter((t) => isRare(t.count))]] as const).map(([label, list]) => list.length > 0 && (
              <div key={label} className={s.catGroup}>
                <p>{label === '많이 고르는 취향' ? '✦' : '⁂'} {label}</p>
                <div className={s.catTags}>
                  {list.map((t) => {
                    const on = p.picks.includes(t.name)
                    return (
                      <button key={t.name} className={on ? s.popTagOn : full ? `${s.popTag} ${s.popTagDim}` : s.popTag} aria-pressed={on} onClick={() => toggle(t.name)}
                        style={{ ['--tag-bg' as string]: `var(--tone-${cat.tone}-bg)`, ['--tag-fg' as string]: `var(--tone-${cat.tone}-fg)` }}>
                        {on && <Check size={10} />}{t.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {over && <p className={s.popOver} role="status">관심사는 최대 {MAX_PICK}개까지 고를 수 있어요. 다른 관심사를 빼고 골라 주세요.</p>}
            <div className={s.catPopFoot}>
              <span>{catName(cat)}에서 <b>{cat.tags.filter((t) => p.picks.includes(t.name)).length}개</b> 골랐어요</span>
              <button className={s.resetBtn} onClick={() => p.setPicks((l) => l.filter((x) => !cat.tags.some((t) => t.name === x)))}>선택 초기화</button>
              <button className={s.next} onClick={() => setOpenCat(null)}>고르기 완료</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

/* ---------- 3. 자기소개 · 질문 목록에서 고르기 ---------- */
/**
 * 1 "나에 대해서 알려주세요" / 2 질문 목록(추천·관심사·TMI), 3개까지, 고른 질문은 "골랐어요"
 * 3 고른 질문 3개 모두 필수, 답변 10~50자 "n / 50"(50자 넘으면 막음), "목록에서 다시 고르기"로 바꿈. 이전 단계로 가도 유지(상위 상태)
 * 4 미리보기: 내 땅굴 내 정보 카드 모습 / 5 다음: 3개 모두 10자 이상이면 활성 → 3a. 나중에 내 땅굴에서 수정할 수 있다는 안내
 */
function IntroStep(p: { name: string; worn: string[]; picks: string[]; qids: string[]; setQids: (v: string[]) => void; answers: Record<string, string>; setAnswers: (v: Record<string, string>) => void; onPrev: () => void; onNext: () => void }) {
  const listRef = useRef<HTMLDivElement>(null)
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
            <QuestionList picks={p.picks} selected={p.qids} max={3} onToggle={(q) => toggle(q.id)}
              note={`${p.qids.length} / 3 골랐어요 · 추천: 관심사 질문 2개 + TMI 질문 1개`} />
          </div>
          {p.qids.map((id, i) => {
            const q = questionOf(id)!
            const a = p.answers[id] ?? ''
            const short = a.trim().length > 0 && a.trim().length < ANSWER_MIN
            return (
              <div key={id} className={s.field}>
                <div className={s.qHead}>
                  <label htmlFor={`ob-q${i}`}>Q{i + 1}. [{questionTag(q)}] {q.text}</label>
                  <button className={s.swap} onClick={() => { toggle(id); listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}>목록에서 다시 고르기</button>
                </div>
                <div className={s.areaWrap}>
                  <textarea id={`ob-q${i}`} maxLength={ANSWER_MAX} value={a} placeholder={`예) ${q.ex}`}
                    onChange={(e) => p.setAnswers({ ...p.answers, [id]: e.target.value.slice(0, ANSWER_MAX) })} />
                  <span className={s.counter}>{a.length} / {ANSWER_MAX}</span>
                </div>
                {short && <span className={s.error}>{ANSWER_MIN}자 이상 적어 주세요</span>}
              </div>
            )
          })}
          {p.qids.length < 3 && <p className={s.qEmpty}>위 목록에서 질문을 {3 - p.qids.length}개 더 골라 주세요.</p>}
        </div>
        <aside className={s.cardSide}>
          <p className={s.sideLabel}>내 땅굴에선 이렇게 보여요</p>
          <div className={s.profileCard}>
            <div className={s.profileTop}>
              <MoleWithItems size={52} radius={12} worn={p.worn} />
              <div><strong>{p.name}</strong><span>관심사 {p.picks.length}개</span></div>
            </div>
            <dl className={s.qnaBox}>
              {p.qids.map((id, i) => (
                <div key={id}><dt>Q{i + 1}. {questionOf(id)?.text}</dt>{(p.answers[id] ?? '').trim() && <dd>{(p.answers[id] ?? '').trim()}</dd>}</div>
              ))}
              {p.qids.length === 0 && <div><dt>고른 질문이 여기에 보여요</dt></div>}
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
function BuildStep({ name, picks, onDone }: { name: string; picks: string[]; onDone: () => void }) {
  const lead = leadCategory(picks) ?? 'pet_plant'
  const leadCat = CATEGORIES.find((c) => c.id === lead)
  const inLead = picks.filter((t) => subOf(t)?.category === lead)
  // 내 땅굴·남이 보는 내 땅굴과 같은 계산 (온보딩이라 꾸민 것은 없음)
  const wall = wallpaperOf(roomLookOf(ME_ID, picks, NO_SAVED_ROOM).wallpaper)
  const rows = useMemo(() => picks.map((t) => ({ tag: t, row: defaultFurniture(subOf(t)?.id ?? '') })).filter((x) => x.row), [picks])
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
              <strong>{r.row!.name_ko}</strong>
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
function PreviewStep({ name, worn, picks, qna, onRepick, onConfirm }: { name: string; worn: string[]; picks: string[]; qna: { q: string; a: string }[]; onRepick: () => void; onConfirm: () => void }) {
  // 내 땅굴과 같은 방 모습 (data/roomLook.ts, 온보딩이라 꾸민 것은 없음)
  const look = useMemo(() => roomLookOf(ME_ID, picks, NO_SAVED_ROOM), [picks])
  const total = interestFurnitureCount(picks)
  // 미리보기에 들어오면 바로 내 관심사·꾸미기로 기록: "관심사 확정" 대신 위 로고 등으로 나가도 같은 방이 나오게 (예전 동작 유지).
  // 벽지는 관심사로 계산되므로 따로 저장하지 않음
  useEffect(() => { setMyInterests(picks); setMyWorn(worn) }, [picks, worn])
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
            <Link to="/burrow" className={s.next} onClick={onConfirm}>관심사 확정</Link>
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
const Dice = () => <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><rect x="2" y="2" width="12" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.4" /><circle cx="5.5" cy="5.5" r="1" fill="currentColor" /><circle cx="10.5" cy="10.5" r="1" fill="currentColor" /><circle cx="8" cy="8" r="1" fill="currentColor" /></svg>
