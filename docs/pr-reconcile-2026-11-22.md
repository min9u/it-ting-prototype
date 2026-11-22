# 열린 PR 5개 ↔ API v1 main 대조 (2026-11-22)

- **요청**: 민구님이 API v1로 모든 영역을 다시 연결해(커밋 33개) 내 PR 5개(#18~#22: `fix/f6-f10-mid`, `fix/f6-f10-check`, `feat/new-term-notice`, `perf/first-load`, `fix/term-furniture`)를 그대로 rebase하면 안 될 것 같다 → 코드는 고치지 말고 5개 브랜치의 기능을 항목별로 나눠 ①이미 있음 ②일부만 ③없음 ④명세와 어긋남으로 표로 정리, ②③만 새 브랜치로 다시 얹는 계획
- **기준**: `origin/main` 2ab6f1e. 근거는 코드·커밋을 읽고, 최신 main을 임시 폴더에 풀어 빌드한 결과(첫 화면 JS 582.3KB gzip, `roomScene` 313.5KB), 커밋별 `git merge-tree` 충돌 계산
- **한계**: 커밋별 충돌은 각 커밋을 main에 따로 얹은 계산이라 누적 결과가 아님. 내 브랜치의 테스트를 main 위에서 돌려 보진 않음. 민구님 worktree 병합이 진행 중이라 main이 더 움직일 수 있음

## 항목별 표 (①이미 있음 ②일부만 ③없음 ④명세와 어긋남, 보류)
| # | 브랜치 · 항목 | 판정 | 근거 (main) |
|---|---|---|---|
| 1 | mid · 채팅 사진 첨부(3장·5MB·형식·사진만 보내기) | ① | `screens/chat/Chat.tsx:361-376`, `api/chat/mock.ts:152-164`, `api/community/mock.ts:367-368`. 커밋 eebf9c0·e765c09 |
| 2 | mid · 거절한 요청에 재요청하면 수락 처리 | ① | `data/chat.ts:360-381`(`sendRequest`가 `rejectedFrom`을 수락으로 처리). 커밋 eebf9c0 |
| 3 | mid · 7번째 상태 "모임 취소로 마감" | ① | `api/meetups/types.ts:15`, `data/meetupStore.ts:39,328`(`mcancel`), `MeetupDetail.tsx:36`, `tests/meetup.test.ts:226`. 커밋 63c2936·9bbf816 |
| 4 | mid · 내 모임·찜·캘린더 규칙 고정 테스트 | ① | 같은 규칙이 `tests/meetup.test.ts` "내 모임 분류"에 있음 |
| 5 | mid · 글쓰기 모임 연결(홍보·후기·자유) | ① | `api/community/mock.ts:146-158`이 내 규칙과 같음, `tests/community-api.test.ts:106-117`. 커밋 e765c09 |
| 6 | mid · 차단 기능 제거 | ② | 화면·API는 이미 삭제(`ProfilePopup.tsx:21`, `Settings.tsx:20`, `api/settings/real.ts:5`). `data/account.ts`의 차단 저장소와 `api/chat/queries.ts:254`(`useBlocked`) 연결이 남음 |
| 7 | check · 모임 나가기 버튼(24시간 안엔 꺼짐) | ① | `Chat.tsx:333-335`, `api/chat/mock.ts:73-77,230`. 커밋 eebf9c0 |
| 8 | check · 빈자리 알림 발송(자리가 나면) | ③ | 알림 종류·문구(`api/notifications/mappers.ts:95`)와 시드(`data/notifications.ts:68,89`)뿐, 자리가 날 때 만드는 코드 없음 |
| 9 | check · F8-B5/B6, F9-B2, F10-B4 "확인 완료" 테스트 | ② | 규칙은 main 시험(`community-api`, `notice-types` 등)이 일부 덮음. 내 테스트는 옛 층을 부르는 것 → **다시 쓰지 않기로 함**(2026-11-22 결정) |
| 10 | check · 회원 탈퇴 4건(비밀번호 팝업 확인·Google 10분·내가 연 모임·재가입 안내) | ① | `SettingsLeave.tsx:20-36,99,123-135`, `api/settings/mock.ts:87-89,169-181`(모임 저장소 기준). 커밋 7c4697e·13b4845 |
| 11 | new-term · 새 학기 안내 팝업 | ① | `screens/burrow/NewTermGate.tsx`(App.tsx:49), `api/explore/mock.ts:159-166`, `tests/api-explore.test.ts:229`. 커밋 9770615. 새 학기 이름은 `GET /terms`에서 받음(내 `NEW_TERM_NAME` 하드코딩은 버림) |
| 12 | new-term · 내 정보 수정에서 캠퍼스·층을 바꾸면 땅굴 이사 | ③ | `data/myBurrow.ts:57-64`의 `setMyProfile`은 `ME_HOME`만 바꾸고, `moveMyBurrow`는 새 학기 이사(`api/explore/mock.ts:162`)에서만 부름. 명세 04 `spec:85`, `api/04:63` |
| 13 | perf · `testParam`을 three 밖으로 | ③ | `screens/chat/TeaRoom.tsx:4`가 아직 `three/engine`에서 import |
| 14 | perf · 화면 route lazy | ③ → **안 함** | `App.tsx` 정적 import 18개. Next.js 전환 때 파일 라우트가 자동으로 코드를 나눔 |
| 15 | perf · three 청크 분리와 예산 | ③ → **안 함** | `vite.config.ts`에 청크 설정 없음. Next.js 전환 때 자동 |
| 16 | term · 꾸미기 "소품" 탭 → "가구" 탭 | **보류** | 명세 사본(04ea897)이 KAN-40 머지 전 버전. KAN-40에서 "/"로 묶인 관심사의 단어 고르기(꾸미기 가구 탭)가 확정될 예정. 지금 main은 꾸미기에 두더지 탭만 둠(`DecorPanel.tsx:7-10`, 명세 04 `spec:26`) |
| 17 | term · 남은 화면 문구 3곳(방문자 뷰 안내·목 공지·목 글) | ③ | `VisitBurrow.tsx:189`, `data/serviceNotices.ts:21`, `data/boardStore.ts:189`. 명세 05에는 "소품" 문구 없음 |
| 18 | term · 랜딩 부제 "소설책이, 카세트 워크맨이" | **보류** | 명세 사본(04ea897)이 KAN-40 머지 전 버전. KAN-40에서 랜딩 부제가 확정될 예정. 지금 main은 88d8f2d에서 명세 01 랜딩 03 6번 "책장이, 오락기가"로 맞춰 둠 |

## 진행 (사용자 결정, 2026-11-22)
- 새 브랜치는 모두 최신 origin/main에서 하나씩. 각 브랜치는 tsc · vitest · build · smoke 통과 뒤 push
  | 순서 | 브랜치 | 항목 |
  |---|---|---|
  | A | `fix/profile-edit-move-burrow` | 12 내 정보 수정에서 캠퍼스·층을 바꾸면 땅굴 이사 |
  | C | `feat/meetup-vacancy-notice` | 8 빈자리 알림 발송(목 서버, main의 `addNotice`로 새로 작성) |
  | B | `chore/remove-block-remnants` | 6 차단 잔여 코드 |
  | D | `fix/term-furniture-strings` | 17 "소품" → "가구" 화면 문구 3곳 |
  | perf | `perf/testparam-out-of-three` | 13 `testParam`을 three 밖으로(route lazy · 청크 설정은 Next.js 전환 때 해결되므로 안 함) |
- 안 하는 것: 9(테스트 다시 쓰기), 14·15(route lazy·청크 설정), 16·18(KAN-40 확정 뒤)
- 기존 PR #18~#22(`fix/f6-f10-mid`, `fix/f6-f10-check`, `feat/new-term-notice`, `perf/first-load`, `fix/term-furniture`)는 위 새 브랜치로 대체하고 닫음(닫는 건 사용자)

## 일정(`docs/team-repo-migration.md`)과의 관계
- 순서는 "API v1 맞추기(이 리포) → 정리 → Next.js 전환 → 30개 커밋 재구성". 위 브랜치들은 맞추기·정리 단계 안에서 끝내야 함(전환 시작 뒤 이 리포에 들어간 변경은 두 번 옮겨야 함)
- 14·15(route lazy·청크 설정·`bundle-report`)는 Vite 전용이라 Next.js로 안 옮겨짐 → 하지 않음. 13(`testParam` 분리)은 옮겨짐
- 커밋 목록 대응: 12 → #17(내 땅굴), 8 → #21~25(모임·알림), 17 → #12·#19, 6 → #26(설정)
