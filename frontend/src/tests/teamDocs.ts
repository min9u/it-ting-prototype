/**
 * 백엔드 팀 명세 폴더 (테스트가 명세 글을 읽어 프론트와 비교할 때 씀)
 * - 팀 리포(it-ting-team/it-ting): 원본이 ../docs (docs/api · docs/spec)
 * - 프로토타입 리포: 사본이 ../docs/backend/team-spec
 * vitest 는 frontend/ 에서 돌므로 frontend 기준 상대 경로. 앞의 것이 있으면 그것을 씀
 */
const FS = 'node:fs' // 브라우저 타입에 node 가 없어서 문자열로 불러옴 (rules.test 와 같은 방식)
const fs = (await import(/* @vite-ignore */ FS)) as { existsSync(p: string): boolean }

export const TEAM_DOCS =
  ['../docs', '../docs/backend/team-spec'].find((d) => fs.existsSync(`${d}/api`) && fs.existsSync(`${d}/spec`)) ?? '../docs/backend/team-spec'
