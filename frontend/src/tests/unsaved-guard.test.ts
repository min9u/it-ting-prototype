/**
 * 저장 전 확인(00 공통 18 "아직 저장되지 않았습니다")이 있는 화면은 다른 화면으로 갈 때(상단 메뉴 · 뒤로 가기)도 막는지.
 * PR #37 Codex 리뷰에서 내 정보 수정 · 두더지 꾸미기가 취소 버튼만 막고 이동은 안 막아 바꾼 내용이 사라졌다
 */
import { describe, expect, it } from 'vitest'

describe('저장 전 확인 화면은 이동도 막음', () => {
  it('UnsavedDialog · "아직 저장되지 않았습니다" 가 있는 화면 파일은 useBlocker 도 씀', async () => {
    const FS = 'node:fs'
    const fs = (await import(/* @vite-ignore */ FS)) as { readFileSync(p: string, e: string): string; readdirSync(p: string, o: { recursive: boolean }): string[] }
    // MyBurrow 의 확인은 내 정보 수정 → 꾸미기로 넘어갈 때만. 바꾼 내용은 MyInfoEdit · DecorPanel 이 들고 있고 거기서 이동을 막음
    const DELEGATES = new Set(['burrow/MyBurrow.tsx'])
    const files = fs.readdirSync('src/screens', { recursive: true }).filter((f) => f.endsWith('.tsx') && !f.endsWith('UnsavedDialog.tsx') && !DELEGATES.has(f))
    const missing: string[] = []
    let checked = 0
    for (const f of files) {
      const src = fs.readFileSync(`src/screens/${f}`, 'utf8')
      if (!/<UnsavedDialog\b|아직 저장되지 않았습니다/.test(src)) continue
      checked++
      if (!/\buseBlocker\(/.test(src)) missing.push(f)
    }
    expect(checked).toBeGreaterThanOrEqual(6)
    expect(missing).toEqual([])
  })
})
