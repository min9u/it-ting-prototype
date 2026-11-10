import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import logo from '../../assets/logo.png'
import roomCutout from '../../assets/room-cutout.png'
import Avatar from '../../components/Avatar'
import InterestChip from '../../components/InterestChip'
import Modal from '../../components/Modal'
import RoomView from '../../components/RoomView'
import { CATEGORIES, toneOf } from '../../data/mock'
import type { Category } from '../../data/types'
import s from './Onboarding.module.css'

const STEPS = [
  { key: 'name', label: '나를 부르는 이름' },
  { key: 'interests', label: '내 관심사 선택' },
  { key: 'intro', label: '자기소개' },
  { key: 'building', label: '방 만들기' },
] as const

const MIN_PICK = 3
const FREE_MAX = 150

/** 관심사 → 땅굴 가구 (랜딩 03 "고른 관심사가 가구가 돼요" 규칙을 목 데이터로) */
const FURNITURE: Record<string, { item: string; desc: string; kind: '가구' | '벽 꾸미기' }> = {
  게임: { item: '오락기', desc: '한 판 하고 가요', kind: '가구' },
  보드게임: { item: '보드게임 선반', desc: '상자가 차곡차곡', kind: '가구' },
  독서: { item: '책장', desc: '읽던 책이 꽂혀 있어요', kind: '가구' },
  음악: { item: '스피커', desc: '은은하게 흘러나와요', kind: '가구' },
  피아노: { item: '업라이트 피아노', desc: '벽에 붙여 두었어요', kind: '가구' },
  그림: { item: '이젤', desc: '그리다 만 그림 한 장', kind: '가구' },
  사진: { item: '카메라 삼각대', desc: '창가를 보고 있어요', kind: '가구' },
  캠핑: { item: '배낭', desc: '언제든 떠날 수 있게', kind: '가구' },
  요리: { item: '작은 주방', desc: '냄비가 보글보글', kind: '가구' },
  운동: { item: '러닝머신', desc: '오늘도 3km', kind: '가구' },
  여행: { item: '여행 가방', desc: '스티커가 덕지덕지', kind: '가구' },
  시티팝: { item: 'LP 포스터', desc: '80년대 바이브', kind: '벽 꾸미기' },
  공연: { item: '공연 티켓 액자', desc: '다녀온 공연들', kind: '벽 꾸미기' },
  테라리움: { item: '유리병 정원', desc: '선반 위 작은 숲', kind: '가구' },
  필름카메라: { item: '필름 사진 줄', desc: '집게로 걸어 둔 사진', kind: '벽 꾸미기' },
  독립서점: { item: '서점 도장 포스터', desc: '모은 도장들', kind: '벽 꾸미기' },
}
const furnitureOf = (tag: string) => FURNITURE[tag] ?? { item: `${tag} 소품`, desc: '취향이 담긴 물건', kind: '벽 꾸미기' as const }
const countOf = (tag: string) => CATEGORIES.flatMap((c) => c.tags).find((t) => t.name === tag)?.count ?? 9999

const DEFAULT_PICKS = ['캠핑', '게임', '독서', '음악', '피아노', '그림', '사진', '운동', '여행', '요리']

/**
 * 설정(계정 설정) / 온보딩 — 메타데이터 기반, 스크린샷 대조 필요
 * name 408:18310 · interests 408:18482 (+ 분야 팝업 408:18656) · intro 408:18828
 * building 408:19036 → 끝나면 가구 매칭 완료 408:21319 · preview 408:19306
 * 텍스트 노드 이름이 자리표시(Title, Lead, Hint…)라 문구는 지어 넣었다.
 */
export default function Onboarding() {
  const { step = 'name' } = useParams()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [gen, setGen] = useState('16기')
  const [region, setRegion] = useState('서울')
  const [cls, setCls] = useState('0반')
  const [picks, setPicks] = useState<string[]>(DEFAULT_PICKS)
  const [free, setFree] = useState('따뜻한 조명 아래서 LP를 듣는 시간이 좋아요')
  const [intro, setIntro] = useState('')
  const [qna, setQna] = useState(['', '', ''])

  const idx = STEPS.findIndex((x) => x.key === step || (x.key === 'building' && step === 'preview'))
  if (idx < 0) return <Navigate to="/onboarding/name" replace />
  const go = (k: string) => nav(`/onboarding/${k}`)

  return (
    <div className={s.page}>
      <header className={s.header}>
        <Link to="/"><img src={logo} alt="디굴디굴" className={s.logo} /></Link>
        <Link to="/burrow" className={s.skip}>나중에 할게요</Link>
      </header>
      <nav className={s.progress} aria-label="진행 단계">
        <ol>
          {STEPS.map((x, i) => (
            <li key={x.key} className={i < idx ? s.done : i === idx ? s.now : ''} aria-current={i === idx ? 'step' : undefined}>
              <span>{i < idx ? '✓' : i + 1}</span>{x.label}
            </li>
          ))}
        </ol>
      </nav>
      <main className={s.body}>
        {step === 'name' && (
          <NameStep name={name} setName={setName} gen={gen} setGen={setGen} region={region} setRegion={setRegion} cls={cls} setCls={setCls} onNext={() => go('interests')} />
        )}
        {step === 'interests' && (
          <InterestStep picks={picks} setPicks={setPicks} free={free} setFree={setFree} onPrev={() => go('name')} onNext={() => go('intro')} />
        )}
        {step === 'intro' && (
          <IntroStep name={name || '닉네임'} affiliation={`SSAFY ${gen} · ${region} · ${cls}`} picks={picks} intro={intro} setIntro={setIntro} qna={qna} setQna={setQna} onPrev={() => go('interests')} onNext={() => go('building')} />
        )}
        {step === 'building' && <BuildStep name={name || '닉네임'} picks={picks} onNext={() => go('preview')} />}
        {step === 'preview' && <PreviewStep name={name || '닉네임'} picks={picks} intro={intro} qna={qna} />}
      </main>
    </div>
  )
}

/* ---------- 1. 나를 부르는 이름 ---------- */
function NameStep(p: { name: string; setName: (v: string) => void; gen: string; setGen: (v: string) => void; region: string; setRegion: (v: string) => void; cls: string; setCls: (v: string) => void; onNext: () => void }) {
  const bad = p.name.length > 0 && !/^[가-힣a-zA-Z0-9]{2,10}$/.test(p.name)
  return (
    <>
      <div className={s.intro}>
        <h1 className="display">뭐라고 불러드릴까요?</h1>
        <p>땅굴 문패와 방명록에 보이는 이름이에요.</p>
      </div>
      <div className={s.card}>
        <div className={s.form}>
          <div className="field">
            <label htmlFor="nick">닉네임</label>
            <input id="nick" className="input" value={p.name} maxLength={10} onChange={(e) => p.setName(e.target.value)} placeholder="2–10자, 한글·영문·숫자" />
            <span className={bad ? 'error' : 'hint'}>{bad ? '한글·영문·숫자 2–10자로 적어주세요' : `${p.name.length} / 10`}</span>
          </div>
          <div className="field">
            <span className="field-label">소속</span>
            <div className={s.selects}>
              <select className="input" value={p.gen} onChange={(e) => p.setGen(e.target.value)} aria-label="기수">{['13기', '14기', '15기', '16기'].map((x) => <option key={x}>{x}</option>)}</select>
              <select className="input" value={p.region} onChange={(e) => p.setRegion(e.target.value)} aria-label="지역">{['서울', '대전', '구미', '광주', '부울경'].map((x) => <option key={x}>{x}</option>)}</select>
              <select className="input" value={p.cls} onChange={(e) => p.setCls(e.target.value)} aria-label="반">{['0반', '1반', '2반', '3반', '4반', '5반', '6반'].map((x) => <option key={x}>{x}</option>)}</select>
            </div>
          </div>
        </div>
        <div className={s.avatarPreview}>
          <Avatar size={120} />
          <strong className="display">{p.name || '닉네임'}</strong>
          <span>SSAFY {p.gen} · {p.region} · {p.cls}</span>
        </div>
      </div>
      <div className={s.actions}>
        <span />
        <button className="btn btn-primary" disabled={!p.name || bad} onClick={p.onNext}>다음</button>
      </div>
    </>
  )
}

/* ---------- 2. 관심 분야 고르기 + 분야 팝업 ---------- */
function InterestStep(p: { picks: string[]; setPicks: (f: (l: string[]) => string[]) => void; free: string; setFree: (v: string) => void; onPrev: () => void; onNext: () => void }) {
  const [openCat, setOpenCat] = useState<Category | null>(null)
  const toggle = (t: string) => p.setPicks((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t]))
  const pickedIn = (c: Category) => c.tags.filter((t) => p.picks.includes(t.name)).length
  return (
    <>
      <div className={s.intro}>
        <p className={s.eyebrow}>2 / 3 · 관심사</p>
        <h1 className="display">요즘 마음이 가는 것들</h1>
        <p>먼저 큰 분야를 골라보세요. 분야를 누르면 그 안에서 좋아하는 걸 고를 수 있어요.</p>
      </div>
      <div className={`${s.card} ${s.col}`}>
        <p className={s.pickCount}><strong>{p.picks.length}개 골랐어요</strong> · {MIN_PICK}개 이상이면 충분해요</p>
        <div className={s.catGrid}>
          {CATEGORIES.map((c) => {
            const n = pickedIn(c)
            return (
              <button key={c.id} className={n ? s.catTileOn : s.catTile} onClick={() => setOpenCat(c)} style={{ ['--tile-bg' as string]: `var(--tone-${c.tone}-bg)`, ['--tile-fg' as string]: `var(--tone-${c.tone}-fg)` }}>
                <span className={s.catIcon} aria-hidden>{c.emoji}</span>
                <span className="display">{c.name}</span>
                {n > 0 && <em>{n}</em>}
              </button>
            )
          })}
        </div>
        <hr className={s.divider} />
        <div className={s.tray}>
          <p className={s.trayHead}>내가 고른 취향 <span>{p.picks.length}</span><small>× 를 누르면 뺄 수 있어요</small></p>
          <div className={s.trayChips}>
            {p.picks.map((t) => (
              <button key={t} className={s.picked} style={{ background: `var(--tone-${toneOf(t)}-bg)`, color: `var(--tone-${toneOf(t)}-fg)` }} onClick={() => toggle(t)} aria-label={`${t} 빼기`}>{t} ×</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="free">태그에 없는 취향을 자유롭게 적어 주세요</label>
          <textarea id="free" className="textarea" maxLength={FREE_MAX} value={p.free} onChange={(e) => p.setFree(e.target.value)} />
          <span className="hint">{p.free.length} / {FREE_MAX} · 나중에 내 땅굴에서 언제든 바꿀 수 있어요.</span>
        </div>
      </div>
      <div className={s.actions}>
        <button className="btn btn-ghost" onClick={p.onPrev}>이전</button>
        <span className={s.ready}>{p.picks.length >= MIN_PICK ? `✓ 관심사 ${p.picks.length}개 선택 완료 · 취향에 맞는 땅굴 소품이 만들어져요` : `최소 ${MIN_PICK}개 선택`}</span>
        <button className="btn btn-primary" disabled={p.picks.length < MIN_PICK} onClick={p.onNext}>다음</button>
      </div>

      <Modal open={!!openCat} onClose={() => setOpenCat(null)} width={560} labelledBy="cat-title">
        {openCat && (
          <div className={s.catModal}>
            <span className={s.catIconLg} style={{ background: `var(--tone-${openCat.tone}-bg)` }} aria-hidden>{openCat.emoji}</span>
            <h2 id="cat-title" className="display">{openCat.name}</h2>
            <p className={s.catLead}>마음 가는 걸 모두 골라주세요. 여러 개 골라도 좋아요.</p>
            <p className={s.catNote}>태그 옆 숫자는 같은 취향을 고른 사람 수예요</p>
            {[
              { title: '많이 고르는 취향', tags: openCat.tags.filter((t) => t.count >= 1000) },
              { title: '아는 사람끼리 통하는 취향', tags: openCat.tags.filter((t) => t.count < 1000) },
            ].filter((g) => g.tags.length).map((g) => (
              <section key={g.title} className={s.tagGroup}>
                <h3>{g.title}</h3>
                <div className={s.tagChips}>
                  {g.tags.map((t) => {
                    const on = p.picks.includes(t.name)
                    return (
                      <button key={t.name} className={on ? s.tagOn : s.tag} onClick={() => toggle(t.name)} aria-pressed={on}>
                        {on && '✓ '}{t.name} <small>{t.count.toLocaleString()}</small>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
            <div className={s.catFoot}>
              <span>{openCat.name}에서 <strong>{pickedIn(openCat)}개</strong> 골랐어요</span>
              <button className="btn btn-primary" onClick={() => setOpenCat(null)}>다 골랐어요</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

/* ---------- 3. 자기소개 ---------- */
const QUESTIONS = ['Q1. 쉬는 날에는 주로 무엇을 하나요?', 'Q2. 어떤 사람과 친해지고 싶나요?', 'Q3. 내 방에 놀러 온 사람들에게 한마디!']
function IntroStep(p: { name: string; affiliation: string; picks: string[]; intro: string; setIntro: (v: string) => void; qna: string[]; setQna: (v: string[]) => void; onPrev: () => void; onNext: () => void }) {
  return (
    <>
      <div className={s.intro}>
        <h1 className="display">나를 조금 소개해 볼까요?</h1>
        <p>비워 둬도 괜찮아요. 땅굴에 놀러 온 두더지가 먼저 읽는 글이에요.</p>
      </div>
      <div className={s.card}>
        <div className={s.form}>
          <div className="field">
            <label htmlFor="intro">자기소개 <span className="hint">선택</span></label>
            <textarea id="intro" className="textarea" maxLength={150} value={p.intro} onChange={(e) => p.setIntro(e.target.value)} placeholder="좋아하는 것, 요즘 빠져 있는 것을 편하게 적어주세요" />
            <span className="hint">{p.intro.length} / 150</span>
          </div>
          {QUESTIONS.map((q, i) => (
            <div className="field" key={q}>
              <label htmlFor={`q${i}`}>{q}</label>
              <input id={`q${i}`} className="input" maxLength={60} value={p.qna[i]} onChange={(e) => { const n = [...p.qna]; n[i] = e.target.value; p.setQna(n) }} placeholder="한 줄이면 충분해요" />
            </div>
          ))}
          <p className="hint">말 걸기 어려운 분도 이 답을 보고 먼저 인사할 수 있어요.</p>
        </div>
        <div className={s.profilePreview}>
          <p className={s.previewLabel}>이렇게 보여요</p>
          <div className={s.miniPanel}>
            <div className={s.miniProfile}><Avatar size={52} /><div><strong className="display">{p.name}</strong><span>{p.affiliation}</span></div></div>
            <div className={s.miniIntro}><strong>자기소개</strong><p>{p.intro || '아직 작성한 자기소개가 없어요.'}</p></div>
            <p className={s.miniLabel}>관심사 {p.picks.length}</p>
            <div className={s.trayChips}>{p.picks.slice(0, 8).map((t) => <InterestChip key={t} label={t} />)}{p.picks.length > 8 && <span className="hint">+{p.picks.length - 8}</span>}</div>
          </div>
        </div>
      </div>
      <div className={s.actions}>
        <button className="btn btn-ghost" onClick={p.onPrev}>이전</button>
        <span />
        <button className="btn btn-primary" onClick={p.onNext}>땅굴 만들기</button>
      </div>
    </>
  )
}

/* ---------- 3a 방 만드는 중 → 3b 가구 매칭 완료 ---------- */
const GEN_STEPS = ['관심사 읽는 중', '무드와 물건 고르는 중', '방에 배치하고 벽 꾸미는 중']
function BuildStep({ name, picks, onNext }: { name: string; picks: string[]; onNext: () => void }) {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    if (phase >= GEN_STEPS.length) return
    const t = setTimeout(() => setPhase((x) => x + 1), 900)
    return () => clearTimeout(t)
  }, [phase])
  const done = phase >= GEN_STEPS.length
  const rare = useMemo(() => [...picks].sort((a, b) => countOf(a) - countOf(b)).slice(0, 5), [picks])
  const matches = picks.map((t) => ({ tag: t, ...furnitureOf(t) }))
  const furniture = matches.filter((m) => m.kind === '가구')
  const wall = matches.filter((m) => m.kind === '벽 꾸미기')
  const mood = rare[0] ? `${rare[0]} 무드` : '포근한 흙 무드'

  return (
    <div className={s.buildCols}>
      <div className={`${s.card} ${s.col} ${s.genCard}`}>
        <div>
          <p className={s.eyebrow}>{done ? '완성!' : '방 만드는 중'}</p>
          <h1 className="display">{done ? `${name}님의 땅굴이 생겼어요` : '고른 관심사로 땅굴을 파고 있어요'}</h1>
          <p className={s.lead}>{done ? '관심사마다 어울리는 가구를 골라 놓았어요. 드문 취향일수록 눈에 띄는 자리에 두었어요.' : '잠깐만 기다려 주세요. 관심사 하나하나를 가구로 바꾸는 중이에요.'}</p>
        </div>
        <ol className={s.genSteps}>
          {GEN_STEPS.map((g, i) => (
            <li key={g} className={i < phase ? s.genDone : i === phase ? s.genNow : ''}><span>{i < phase ? '✓' : i === phase ? '…' : ''}</span>{g}</li>
          ))}
        </ol>
        {done && (
          <div className={s.matchList}>
            <h3>방 무드</h3>
            <MatchRow kind="무드" source={`가장 드문 취향 "${rare[0] ?? '-'}"`} item={mood} desc="벽지·조명·바닥 색을 정했어요" />
            <h3>가구 <span>{furniture.length}</span></h3>
            {furniture.map((m) => <MatchRow key={m.tag} kind="가구" source={m.tag} item={m.item} desc={m.desc} />)}
            <h3>벽 꾸미기 <span>{wall.length}</span></h3>
            {wall.length === 0 && <p className="hint">벽에 걸 만한 취향이 없어서 시계를 걸어 두었어요.</p>}
            {wall.map((m) => <MatchRow key={m.tag} kind="벽" source={m.tag} item={m.item} desc={m.desc} />)}
            <p className={s.storage}><em>보관함</em>자리가 모자란 소품은 보관함에 넣어 두었어요. 땅굴 꾸미기에서 꺼낼 수 있어요.</p>
          </div>
        )}
        <div className={s.actions}>
          <span className="hint">{done ? '마음에 안 들면 땅굴 꾸미기에서 언제든 바꿀 수 있어요.' : '보통 3초 안에 끝나요.'}</span>
          <button className="btn btn-primary" disabled={!done} onClick={onNext}>{done ? '땅굴 미리보기' : '만드는 중…'}</button>
        </div>
      </div>
      <aside className={`${s.card} ${s.col} ${s.roomPreview}`}>
        <p className={s.previewLabel}>내 땅굴</p>
        <div className={s.roomImg}><img src={roomCutout} alt="만들어진 땅굴 미리보기" className={done ? s.roomIn : s.roomLoading} /></div>
        <div>
          <strong className="display">{name}이의 땅굴</strong>
          <p className="hint">가구 {furniture.length} · 벽 꾸미기 {wall.length} · {mood}</p>
        </div>
        <div className={s.trayChips}>{rare.map((t) => <InterestChip key={t} label={t} size="lg" />)}</div>
        <p className="hint">드문 취향 순서예요. 같은 취향을 가진 두더지에게 먼저 소개돼요.</p>
      </aside>
    </div>
  )
}

function MatchRow({ kind, source, item, desc }: { kind: string; source: string; item: string; desc: string }) {
  return (
    <div className={s.match}>
      <div><span className={s.kind}>{kind}</span><p className={s.source}>{source}</p></div>
      <span className={s.arrow} aria-hidden>→</span>
      <div><strong>{item}</strong><p className="hint">{desc}</p></div>
    </div>
  )
}

/* ---------- 3c 땅굴 미리보기 ---------- */
function PreviewStep({ name, picks, intro, qna }: { name: string; picks: string[]; intro: string; qna: string[] }) {
  return (
    <div className={s.previewWrap}>
      <div className={s.previewScene}>
        <RoomView ownerId="me" focusX={0.4} label="내 땅굴 미리보기">
          <span className={s.roomTitle}>{name}이의 땅굴</span>
        </RoomView>
        <aside className={s.previewSide}>
          <h2 className="display">질문·답변 <small>(읽기 전용)</small></h2>
          {intro && <p className={s.miniIntro}>{intro}</p>}
          <dl className={s.qnaList}>
            {QUESTIONS.map((q, i) => <div key={q}><dt>{q}</dt><dd>{qna[i] || '—'}</dd></div>)}
          </dl>
          <p className={s.miniLabel}>관심사 {picks.length}</p>
          <div className={s.trayChips}>{picks.map((t) => <InterestChip key={t} label={t} />)}</div>
          <Link to="/burrow" className="btn btn-primary btn-block">만나러 가기</Link>
        </aside>
      </div>
    </div>
  )
}
