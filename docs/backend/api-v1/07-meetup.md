# 07 모임 — API v1 맞추기 결과 (2026-11-22)

- 요청: 백엔드 확정 API 명세 v1 · 서비스 명세에 프론트 모임 영역을 맞춘다 ([계획](../api-v1-alignment.md), [영역 작업자 규칙](../api-v1-foundation.md) 2장)
- 기준: [api/07-meetup.md](../team-spec/api/07-meetup.md), [spec/07-meetup.md](../team-spec/spec/07-meetup.md), [spec/README.md](../team-spec/spec/README.md) "이번 범위에 없는 것" (사본 커밋 `04ea897`). **서비스 명세가 Figma · 옛 결정(docs/meetup-spec-review.md M1~M17)보다 앞선다** (사용자 결정)
- 결론: 명세 API 20개를 모두 만들었고(`PENDING` 비움), 모임 화면은 모두 `api/meetups` 의 훅 · 함수로만 읽고 쓴다. 명세에 없는 것(모임 신고 · 마감 임박 · 임시 저장)은 뺐고, 명세에 있는데 없던 것(모임 생성 완료 팝업 · 찜 되돌리기의 빈자리 알림 복구 · 모임 취소로 마감 상태 · 서버 계산 값으로 버튼 켜기)은 넣었다
- 다음: 백엔드가 모임을 구현하면 `VITE_API_REAL_AREAS` 에 `meetups` 를 더해 실제 서버로 확인. 아래 "확인할 것"을 백엔드 · 팀과 정한다

---

## 1. 만든 API (ENDPOINTS 20 / PENDING 0)

| API | 함수 (`real` · `mock`) | 화면에서 부르는 곳 (`meetupCalls` · 훅) |
|---|---|---|
| `GET /meetups` | `list(q)` | `useMeetupList` — 리스트 |
| `POST /meetups` | `create(req)` | `meetupCalls.create(form)` — 만들기 → 생성 완료 팝업 |
| `GET /meetups/{meetupId}` | `get(id)` | `useMeetupDetail` — 상세 · 수정 화면 |
| `PATCH /meetups/{meetupId}` | `update(id, req)` | `meetupCalls.update` — 수정 완료 |
| `POST /meetups/{meetupId}/cancel` | `cancel(id)` | `meetupCalls.cancel` — 모임 취소하기 |
| `DELETE /meetups/{meetupId}` | `remove(id)` | `meetupCalls.remove` — 모임 삭제하기 |
| `PUT · DELETE /meetups/{meetupId}/like` | `like` · `unlike` | `meetupCalls.setLike` · `relike` · `unlike` — 상세 하트, 찜한 모임 하트 · 되돌리기 |
| `PUT · DELETE /meetups/{meetupId}/vacancy-alert` | `enableVacancyAlert` · `disableVacancyAlert` | `meetupCalls.setVacancyAlert` — 찜한 모임 "빈자리 알림 받기" |
| `POST /meetups/{meetupId}/applications` | `apply(id, { message })` | `meetupCalls.apply` — 참여 신청하기 |
| `GET /meetups/{meetupId}/applications` | `applications(id)` | `useMeetupApplications` — 신청 관리 팝업 |
| `POST /meetups/{meetupId}/withdraw-application` | `withdrawApplication` | 상세(신청 대기) · 내 모임 "신청 취소" |
| `POST /meetups/{meetupId}/cancel-participation` | `cancelParticipation` | 상세(참여 확정) "참여 취소". **채팅의 "모임 나가기"도 이것을 부를 것** (`meetupCalls.cancelParticipation`, 채팅 작업자) |
| `POST /meetup-applications/{id}/accept · reject · kick` | `accept` · `reject` · `kick` | 신청 관리 "수락" · 거절 확인 · 내보내기 확인 |
| `GET /me/meetups?tab=` | `mine(tab)` | `useMyMeetups` — 내 모임 탭, 다음 모임 카드(`UPCOMING` 첫 모임) |
| `GET /me/meetups/summary` | `summary()` | `useMyMeetupSummary` — 탭 숫자, 리스트의 내 모임 위젯 · 다가오는 일정 |
| `GET /meetup-calendar` | `calendar({ year, month, scope })` | `useMeetupCalendar` — 캘린더 팝업, 내 모임 미니 캘린더(`MINE`) |

- 파일: `app/src/api/meetups/` — `types.ts`(DTO 명세 그대로) · `real.ts` · `mock.ts` · `mappers.ts` · `queries.ts`(훅 · 캐시 키 · `meetupCalls`) · `errors.ts`(`MEETUP_ERRORS` · `MEETUP_LIMITS`)
- 앱 id ↔ DTO id 는 `meetupCalls` · 훅 안에서만 바꾼다 (화면은 `'m1'` 같은 문자열 id). 신청 id 는 목에서 `'모임id:사람id'` 를 숫자로 바꿔 쓴다
- 캐시 키: `meetupKeys.list · detail · mine · summary · calendar · applications`. 쓰기 뒤에는 `meetupKeys.all` 을 새로 받는다
- 낙관적 업데이트(`useOptimistic`, 실패하면 되돌림 + `MEETUP_ERRORS` 문구 토스트): 찜 · 신청 · 신청 취소 · 참여 취소(상세), 찜 풀기 · 빈자리 알림 · 신청 취소(내 모임), 수락 · 거절 · 내보내기(신청 관리)

### 에러 문구 (`MEETUP_ERRORS`, 화면은 code 로만 분기)
`MEETUP_NOT_FOUND` · `MEETUP_APPLICATION_NOT_FOUND` · `OWN_MEETUP_NOT_ALLOWED` · `FORBIDDEN` · `MEETUP_ALREADY_APPLIED` · `MEETUP_REAPPLY_NOT_ALLOWED` · `MEETUP_NOT_RECRUITING` · `MEETUP_APPLICATION_ALREADY_CONFIRMED` · `MEETUP_PARTICIPATION_CANCEL_NOT_ALLOWED` · `MEETUP_EDIT_NOT_ALLOWED` · `MEETUP_CANCEL_NOT_ALLOWED` · `MEETUP_DELETE_NOT_ALLOWED` · `MEETUP_FULL` · `MEETUP_KICK_NOT_ALLOWED` · `MEETUP_NOT_LIKED` (명세 "에러" 표 모두). 409 뒤에는 `invalidate` 로 상세 · 목록을 다시 받아 버튼이 맞춰진다. 만들기 · 수정의 `INVALID_INPUT` 은 토스트 대신 칸 아래에 `fields` 문구를 보여 준다.

### 목 서버
`data/meetupStore.ts` 를 DB 로 쓰고, 서버가 계산하는 값(모집 상태 · 내 상태 · `can*` · 확정 인원 · 탭 나누기 · 정렬 · 페이지 · 입력 검사 · 에러 code)을 명세대로 만든다. 시각 기준은 목 데이터의 지금(2026-11-03 12:00). 참여 취소는 서버처럼 채팅 저장소의 모임 대화방에서도 뺀다.

## 2. 화면 연결

| 화면 | 바꾼 것 |
|---|---|
| 리스트 (`MeetupList`) | `GET /meetups`. 정렬 코드 `STARTS_SOON · NEWEST · POPULAR · MOST_JOINED`, 개수 6/12/24, 카테고리 쉼표, 날짜 빠른 선택 → `dateFrom · dateTo`. 검색은 입력이 멈춘 뒤 0.3초 |
| 사이드 (`MeetupsShell`) | 내 모임 위젯 · 다가오는 일정 = `summary.upcomingItems`, 다음 모임 = `tab=UPCOMING` 첫 모임, 미니 캘린더 = `meetup-calendar?scope=MINE` |
| 내 모임 (`MyMeetups`) | 탭 숫자 = `summary.counts`, 목록 = `me/meetups?tab=`. 버튼은 `myStatus`, 수정은 `canEdit`, "확인 필요" = `pendingCount` · `unreadCount` · `PENDING` |
| 상세 (`MeetupDetail`) | 행동 카드를 `recruitStatus` · `myStatus` · `can*` 로 고름 (프론트가 시각을 다시 계산하지 않음). 좌석 = `participants`, 겹치는 관심사 = `sharedInterestParticipantCount`, 대화 미리보기 = `chatRoomId` 가 있을 때만 |
| 캘린더 팝업 · 신청 관리 팝업 (`parts.tsx`) | 각각 `meetup-calendar` · `applications` + 수락 · 거절 · 내보내기. 정원이 차면 수락 끔, `canManage` 가 false 면 모두 끔 |
| 만들기 · 수정 (`MeetupNew`) | 만들기 `POST` → 생성 완료 팝업, 수정은 상세를 받아 채우고 `PATCH`, 취소 · 삭제는 `canCancel` · `canDelete` |

`tests/meetup-api.test.ts` 마지막 시험이 `screens/meetups` 가 `data/meetupStore` 에서 타입 · 표기 함수(`hourLabel` · `ddayOf` · `placeLine` · `draftOf` …)만 가져오는지 본다.

## 3. 기능 더하고 뺀 것 (서비스 명세 기준)

**뺀 것**
- **모임 신고**: 상세 주최자 카드의 "⋯ › 모임 신고"와 신고 팝업, 목 저장소의 신고 기록 (README "이번 범위에 없는 것"). 옛 결정 M10 은 명세로 뒤집힘
- **마감 임박**: `MeetupCard` 의 기본 상태 "마감 임박(1자리)" 표시 (공용 컴포넌트, 모임 화면만 씀). 찜한 모임의 "N자리 남았어요"는 명세(찜한 모임 2)에 있어 남김
- **모임 만들기 임시 저장**: "그만두기 = 임시 저장 후 이어 쓰기"(M3) → 입력한 내용이 있으면 00 공통 18 "아직 저장되지 않았습니다" 확인 후 버림
- **리스트 카드 하트**: 명세의 모임 카드에 찜 여부가 없고 리스트 명세 5 에도 하트가 없음 → 찜은 상세에서만
- **신청 관리 · 상세의 옛 "남긴 말" 다시 보기**: 상세 응답에 내 신청 메시지가 없어 신청 대기 카드에서 뺌

**넣은 것**
- **모임 생성 완료 팝업** (만들기 → 팝업 → "모임 보러 가기" = 상세, "공유하기" = 링크 복사). 옛 결정 M1(팝업 없이 상세로)은 명세로 뒤집힘
- **찜 되돌리기**가 풀기 전의 빈자리 알림을 다시 켬 (`PUT like` 뒤 `PUT vacancy-alert`)
- **모임 취소로 마감**(`MEETUP_CANCELED`): 신청 대기 중 모임이 취소되면 취소된 모임 카드
- **자동 미승인 규칙**: 정원이 차도 기다리던 신청은 남고, 모집 마감 시각(없으면 시작)에만 자동 미승인 (옛 M7 "정원이 차면 미승인"은 명세로 뒤집힘)
- **찜을 풀면 빈자리 알림도 꺼짐**, 찜하지 않은 모임은 알림을 켤 수 없음(`MEETUP_NOT_LIKED`)
- **카테고리 코드**: `HOBBY · FOOD · STUDY · ETC · GAME · EXERCISE` (옛 제안값 `HOBBY_CULTURE` 등에서 바꿈, `data/meetupCategory.ts`)
- **글자 수**: 명세 값(이름 30 · 소개 1,000 · 준비물 100 · 장소 100 · 상세 주소 100 · 접속 링크 500 · 남길 말 100)을 `MEETUP_LIMITS` 로

## 4. 애매해서 정한 것 (가장 단순하게)

- **지난 · 취소된 모임을 참여자 · 주최자가 열 때** (open-issues): 모집 상태 카드(지난 모임 / 취소된 모임)를 보여 준다. 대화 미리보기는 `chatRoomId` 가 있으면 그대로
- **확정 뒤 참여 취소 · 내보내진 사람이 모집 완료 모임을 열 때**: 모집 완료 카드 (아니면 미신청 화면 + "다시 신청할 수 없어요")
- **"모집 완료"의 안내 문구**: 확정 인원 < 정원이면 "모집 마감 시각이 지났어요", 아니면 "정원이 모두 찼어요" (시각 계산 없이 응답 값으로)
- **신청 취소 · 참여 취소 · 모임 취소 확인 팝업 문구** (open-issues: 명세에 없음): 기존 문구 유지
- **주최자 카드** (명세 항목 없음, open-issues): Figma 대로 두되 신고는 뺌. 겹치는 관심사 칩 대신 `participants[주최자].hasSharedInterest` 로 "나와 겹치는 관심사가 있어요" 한 줄
- **내 모임 위젯 숫자**: `summary.upcomingItems` 개수(최대 5). 탭 숫자는 `counts`
- **모임 대화 미리보기 메시지**: 채팅 API(`GET /chat-rooms/{id}/messages?size=3`)는 채팅 영역이 만든다. 지금은 채팅 목 저장소(`data/chat` `roomOf`)를 `chatRoomId` 로 읽기만 함 → 채팅 작업자가 메시지 훅을 내보내면 바꾼다
- **모임 대화방 id 링크**: 응답의 `chatRoomId` → `/chat/<앱 id>` (목에서는 `g-m1`)
- **생성 완료 팝업의 공유 링크**: 지금 주소의 `/meetups/new` 를 `/meetups/<id>` 로 바꿔 복사
- **표지판 글자 · 지역**: 명세에 없어 프론트가 만든다 (제목 앞 8자, 장소 앞 두 낱말)

## 5. 백엔드 · 팀에 물어볼 것

1. **리스트 카드에 `isLiked` 가 없다.** Figma 카드에는 하트가 있었다. 리스트에서 찜을 하려면 카드에 `isLiked` 가 필요하다 (지금은 하트를 뺐다)
2. **상세에 내 신청 메시지가 없다.** 신청 대기 카드에서 "주최자에게 남긴 말"을 다시 보여 주던 자리를 뺐다. 필요하면 `myApplication.message` 같은 칸
3. **상세에 주최자의 관심사(겹치는 것)가 없다.** 주최자 카드의 "겹치는 관심사" 칩을 그리려면 `host` 에 관심사 태그가 필요 (지금은 `hasSharedInterest` 한 줄)
4. **신청 관리 팝업을 알림(F9 "모임 참여 요청")에서도 여는지** (명세 "신청 관리 1"과 "들어오는 곳"이 다름, open-issues). 지금은 알림 → 내 모임 › 내가 연 모임 + 팝업
5. **취소된 모임의 대화방 id**: 취소 뒤에도 `chatRoomId` 를 주는지 (명세상 대화방은 남으므로 준다고 봄)
6. **`PATCH` 의 "바뀐 값 없음"**: 프론트는 바뀐 게 없으면 "수정 완료"를 끈다
7. **카테고리 순서**: 명세 표 순서(취미/문화 · 식사/카페 · 스터디/프로젝트 · 기타 · 게임 · 운동)를 화면 순서로 씀

## 6. 공용 파일 · 다른 영역

- **고친 공용 파일**: `components/MeetupCard.tsx` (기본 상태의 "마감 임박" 한 줄만 뺌, 쓰는 곳은 모임 화면뿐)
- **고치지 않고 보고만**: `lib/validation.ts` `RULES` 의 모임 글자 수(소개 300 · 준비물 40 · 장소 60 · 상세 주소 40)가 명세와 다르다 → 모임 화면은 `MEETUP_LIMITS` 를 씀. 공통 작업자가 `RULES` 를 명세 값으로 맞추면 좋다
- `components/Feedback.tsx` `TOAST.applied` 의 링크 `/meetups/me?modal=pending` 은 내 모임이 옛 주소로 받아 신청 대기 탭을 연다 (그대로 둠)
- **다른 영역이 가져다 쓰는 것** (모두 그대로 동작): 커뮤니티 `MeetupCardDto` · `toMeetupCard` · `MeetupCardVM`(`liked` 는 늘 false) · 목 `meetupCard(m)` — 모양은 명세 모임 카드로 바뀜. 채팅 · 알림 목 저장소가 읽는 `data/meetupStore` 의 `findMeetup` · `myOf` · `membersOf` · `canQuit` · `quit` · `isPast` · `applicantsOf` · `useMeetups` · `getMeetupState` 이름은 그대로
- 커뮤니티 작업자 메모: 08 명세의 "글의 모임 카드" 모양이 07 모임 카드와 다르면 커뮤니티 폴더에 따로 두는 게 규칙이다

## 7. 확인한 것

- `npx tsc -b --noEmit` · `npm test`(34 파일, 471 통과 · 87 todo — 모임 todo 0) · `npm run build` 통과
- 새 시험 `tests/meetup-api.test.ts` 33개: 목록 거르기 · 정렬 · 모집 완료 뒤로 · 400, 상세의 내 상태 · `can*`, 신청 · 신청 취소 · 참여 취소 · 다시 신청 불가 · 24시간, 찜 · 빈자리 알림, 신청 관리 수락 · 정원 · 거절 · 내보내기, 만들기 · 수정 · 취소 · 삭제 규칙과 입력 오류, 내 모임 탭 · 요약 · 캘린더, 매퍼, 화면이 저장소를 직접 부르지 않음
- 고친 시험: `meetup.test.ts`(자동 미승인 규칙, 신고 없음, 찜 풀면 알림 꺼짐, 모임 취소로 마감), `meetup-category.test.ts`(확정 코드)
- 개발 서버(5415) 스모크 `--only=meetups` 20화면 OK (콘솔 에러 · 실패 요청 없음). 헤드리스 크롬으로 신청 → 신청 취소, 찜 → 해제 → 되돌리기, 신청 관리 수락, 모임 만들기 → 완료 팝업 → 상세(주최자 · 삭제), 모임 취소 → 내 모임 지난 모임 흐름 확인
