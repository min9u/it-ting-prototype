#!/usr/bin/env node
// import.mjs --log 로 남긴 JSON → 마크다운 표 (docs/team-import-rehearsal.md 에 붙임). "담는 것"은 plan.json 의 desc
// 사용: node tools/team-import/report.mjs <log.json>
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const log = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const plan = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'plan.json'), 'utf8'))
const ok = (x) => (x == null ? '-' : x.ok ? '통과' : '실패')
const rows = log.commits.map((c) => {
  const ch = c.checks
  const desc = plan.commits[c.n - 1]?.desc ?? ''
  const extra = [...(c.stubs ?? []).map((s) => `임시 ${s}`), ...(c.team ?? []).map((t) => `팀 ${t}`)].join(', ')
  const checks = ch
    ? [
        `tsc ${ok(ch.tsc)}`,
        `lint ${ch.lint ? `오류 ${ch.lint.errors} 경고 ${ch.lint.warnings}` : '-'}`,
        `test ${ch.test ? (ch.test.none ? '없음' : `${ch.test.files}파일 ${ch.test.passed}개`) : '-'}`,
        `build ${ok(ch.build)}`,
        ...(ch.labsOff ? [`labs-off ${ok(ch.labsOff)}`] : []),
      ].join(' · ')
    : '검사 안 함'
  return `| ${c.n} | \`${c.title}\` | ${desc} | ${c.files}${extra ? ` (${extra})` : ''} | ${checks} | ${c.sec ?? '-'}s | ${c.signed ?? '-'} |`
})
console.log('| # | 제목 | 담는 것 | 파일 | 검사 (커밋 전) | 시간 | 서명 |')
console.log('|---|---|---|---|---|---|---|')
console.log(rows.join('\n'))
console.log(`\n원본 ${log.source} · Node ${log.node} · 시작 ${log.started} · 끝 ${log.finished ?? '-'} · 합계 ${log.totalSec ? Math.round(log.totalSec / 60) + '분' : '-'}`)
if (log.finalDiff) console.log(`\nfrontend/ 비교:\n${log.finalDiff.length ? log.finalDiff.map((d) => `- ${d}`).join('\n') : '- 모두 같음'}`)
