import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { detectGraphics } from '../lib/graphicsTier'
import { getLab, labShown, labVersion, resetLab, setLab, setLabShown, subscribeLab, type LabState } from '../lib/lowLab'
import { router } from '../App'

/*
 * 저사양 실험실 패널 (docs/gpu-lowspec-ideas.md "내일 테스트 안내").
 * - 보이는 때: 그래픽 가속이 꺼진 PC(감지), 주소에 ?lowlab, 또는 한 번 열어 둔 적이 있을 때
 * - 아티팩트처럼 주소를 못 바꾸는 곳: 화면 맨 위 띠(48px)를 빠르게 세 번 누르거나 Ctrl+Shift+L
 * - 3D 화면(땅굴·탐색하기·온보딩 미리 보기)에서만 오른쪽 아래 🧪 버튼
 */

type BoolKey = Exclude<keyof LabState, 'force' | 'fps'>
const ITEMS: { k: BoolKey; name: string; where: string; tip: string }[] = [
  { k: 'A', name: 'A 배경 한 번 + 두더지만', where: '탐색하기·땅굴', tip: '움직이지 않는 것은 한 번만 그리고 두더지(떨어지는 가구)만 다시 그림' },
  { k: 'B', name: 'B 스톱모션', where: '모두', tip: '일부러 fps를 낮춤 (점토 인형극 느낌)' },
  { k: 'C', name: 'C 카메라 고정', where: '땅굴', tip: '방 돌리기·확대 끔 → 부분 그리기가 늘 적용' },
  { k: 'I', name: 'I 가끔 숨쉬기', where: '모두', tip: '쉬는 중 4초마다 1.2초만 움직임' },
  { k: 'G', name: 'G 3D 창 작게', where: '모두', tip: '3D를 액자 크기로 (그릴 픽셀 약 절반)' },
  { k: 'H', name: 'H 가볍게 보기 버튼', where: '모두', tip: '왼쪽 위 버튼으로 3D를 멈춤' },
  { k: 'F', name: 'F 단순한 두더지', where: '모두', tip: '가벼운 재질, 액세서리 끔' },
  { k: 'S', name: 'S 방은 선명하게', where: '땅굴', tip: '멈춰 있을 때 방만 고해상도로 한 번 그려 둠. 두더지는 낮은 해상도 (A가 켜져 있어야 함)' },
  { k: 'N', name: 'N 가구는 처음부터 제자리', where: '땅굴', tip: '가구 떨어지는 연출을 끔 (떨어지는 동안 흐렸다가 갑자기 선명해지는 것 없앰). 두더지는 그대로 떨어짐' },
  { k: 'P', name: '땅굴 부분 그리기', where: '땅굴', tip: '이미 있던 것. 비교용으로 끄기' },
  { k: 'D', name: 'D 땅굴을 별도 스레드에서 (시험판)', where: '땅굴', tip: '3D가 느려도 버튼·스크롤은 그대로. 기능은 줄어듦' },
  { k: 'E', name: 'E 2D 두더지 (시험판)', where: '탐색하기', tip: '두더지를 미리 찍은 그림으로. 3D를 매 프레임 안 그림' },
]

const is3dPath = (p: string) => p.startsWith('/burrow') || p.startsWith('/onboarding')

export default function LowLab() {
  const ver = useSyncExternalStore(subscribeLab, labVersion)
  const lab = getLab()
  const [shown, setShown] = useState(() => detectGraphics().tier === 'software' || labShown())
  const [open, setOpen] = useState(false)
  const [path, setPath] = useState(router.state.location.pathname)
  useEffect(() => router.subscribe((st) => setPath(st.location.pathname)), [])

  // 숨은 열기: 맨 위 48px 를 0.7초 안에 세 번 누르기, 또는 Ctrl+Shift+L
  useEffect(() => {
    let taps: number[] = []
    const reveal = () => { setLabShown(true); setShown(true); setOpen(true) }
    const onDown = (e: PointerEvent) => {
      if (e.clientY > 48) return
      const now = performance.now()
      taps = [...taps.filter((t) => now - t < 700), now]
      if (taps.length >= 3) { taps = []; reveal() }
    }
    const onKey = (e: KeyboardEvent) => { if (e.ctrlKey && e.shiftKey && e.code === 'KeyL') { e.preventDefault(); reveal() } }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey) }
  }, [])

  if (!shown || !is3dPath(path)) return null
  const real = detectGraphics()
  const effective = lab.force === 'auto' ? (real.tier === 'software' ? '저사양' : '고사양') : lab.force === 'low' ? '저사양 (강제)' : '고사양 (강제)'
  const lowOn = lab.force === 'low' || (lab.force === 'auto' && real.tier === 'software')

  const box: CSSProperties = {
    position: 'fixed', right: 16, bottom: 16, zIndex: 1000, font: '13px/1.4 Pretendard, system-ui, sans-serif', color: '#3e2a1f',
  }
  if (!open) {
    return (
      <div style={box} data-ver={ver}>
        <button type="button" onClick={() => setOpen(true)} title="저사양 실험실"
          style={{ width: 44, height: 44, borderRadius: 22, border: 0, background: '#3e2a1f', color: '#fbf4ec', fontSize: 20, cursor: 'pointer', boxShadow: '0 4px 14px rgba(60,35,20,.3)' }}>
          🧪
        </button>
      </div>
    )
  }
  return (
    <div style={{ ...box, width: 'min(330px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px)', overflow: 'auto', background: '#fbf4ec', borderRadius: 14, boxShadow: '0 10px 30px rgba(60,35,20,.3)', padding: '12px 14px' }} data-ver={ver}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <strong style={{ fontSize: 15, flex: 1 }}>🧪 저사양 실험실</strong>
        <button type="button" onClick={() => setOpen(false)} style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 16 }} aria-label="접기">✕</button>
      </div>
      <div style={{ fontSize: 12, color: '#7a5f4e', marginBottom: 8 }}>
        감지: {real.tier === 'software' ? '그래픽 가속 꺼짐' : 'GPU'} · 지금: <b>{effective}</b>
        <div style={{ wordBreak: 'break-all' }}>{real.renderer || ''}</div>
      </div>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        모드
        <select value={lab.force} onChange={(e) => setLab({ force: e.target.value as LabState['force'] })} style={{ flex: 1 }}>
          <option value="auto">자동 (감지대로)</option>
          <option value="low">저사양 강제</option>
          <option value="high">고사양 강제</option>
        </select>
      </label>
      {!lowOn && <div style={{ fontSize: 12, background: '#f3e2cc', padding: '6px 8px', borderRadius: 8, marginBottom: 8 }}>아래 선택은 저사양일 때만 적용돼요. GPU PC에서 보려면 "저사양 강제".</div>}
      {ITEMS.map((it) => (
        <label key={it.k} style={{ display: 'flex', gap: 8, padding: '5px 0', borderTop: '1px solid #eadccb', cursor: 'pointer', opacity: lowOn ? 1 : .55 }}>
          <input type="checkbox" checked={lab[it.k]} onChange={(e) => setLab({ [it.k]: e.target.checked } as Partial<LabState>)} />
          <span style={{ flex: 1 }}>
            <span style={{ fontWeight: 600 }}>{it.name}</span> <span style={{ fontSize: 11, color: '#9a7d68' }}>{it.where}</span>
            <span style={{ display: 'block', fontSize: 11.5, color: '#7a5f4e' }}>{it.tip}</span>
            {it.k === 'B' && lab.B && (
              <span style={{ display: 'flex', gap: 4, marginTop: 4 }} onClick={(e) => e.preventDefault()}>
                {[8, 10, 12, 15].map((f) => (
                  <button key={f} type="button" onClick={() => setLab({ fps: f })}
                    style={{ border: '1px solid #c9ad93', borderRadius: 6, padding: '2px 7px', cursor: 'pointer', background: lab.fps === f ? '#3e2a1f' : '#fff', color: lab.fps === f ? '#fbf4ec' : '#3e2a1f' }}>
                    {f}fps
                  </button>
                ))}
              </span>
            )}
          </span>
        </label>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button type="button" onClick={resetLab} style={{ flex: 1, border: '1px solid #c9ad93', borderRadius: 8, padding: '6px', background: '#fff', cursor: 'pointer' }}>추천값으로</button>
        <button type="button" onClick={() => { setLabShown(false); setShown(detectGraphics().tier === 'software'); setOpen(false) }} style={{ flex: 1, border: '1px solid #c9ad93', borderRadius: 8, padding: '6px', background: '#fff', cursor: 'pointer' }}>패널 숨기기</button>
      </div>
      <div style={{ fontSize: 11, color: '#9a7d68', marginTop: 6 }}>바꾸면 3D가 새로 그려져요 (두더지가 다시 떨어짐)</div>
    </div>
  )
}
