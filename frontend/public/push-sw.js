/*
 * 브라우저 푸시 받기 (설정 › 알림 설정 "브라우저 알림 받기", lib/browserPush.ts 가 실제 서버 모드에서만 등록).
 *
 * 푸시 내용 (명세 09 · 10, KAN-59): 알림 목록의 한 줄과 같은 JSON { id, type, category, actor, target, isRead, createdAt }.
 * 문구와 눌렀을 때 갈 주소는 프론트엔드가 정한다 → 앱의 알림 목록과 같은 규칙을 여기에 옮겨 둠
 * (api/notifications/mappers.ts noticeText · noticeLink. 서비스 워커는 앱 코드를 불러올 수 없는 정적 파일이라 따로 둠).
 * 두 곳이 같은 글 · 주소를 만드는지 src/tests/push-sw.test.ts 가 알림 종류마다 비교한다. 앱 쪽 문구를 바꾸면 여기도 바꿀 것.
 * 새 메시지 알림은 같은 대화방이면 id 가 같아 tag 로 묶어 한 줄로 보인다.
 */
const HOUR = 3600000
const KST = 9 * HOUR
const WEEK = ['일', '월', '화', '수', '목', '금', '토']

const parts = (ms) => {
  const t = new Date(ms + KST)
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes(), w: t.getUTCDay() }
}
const ymdOf = (ms) => { const p = parts(ms); return Date.UTC(p.y, p.m - 1, p.d) }
const josa = (word, a, b) => {
  const ch = word.replace(/[’'")\s]+$/, '').slice(-1)
  const code = ch.charCodeAt(0) - 0xac00
  if (code < 0 || code > 11171) return a
  return code % 28 ? a : b
}
const quote = (title, fallback) => (title ? `‘${title}’` : fallback)
const who = (a) => (!a ? '누군가' : a.isWithdrawn || !a.nickname ? '탈퇴한 사용자' : `${a.nickname}님`)
const hourText = (ms) => { const { h, mi } = parts(ms); return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시${mi ? ` ${mi}분` : ''}` }
function startsText(startsAt, at) {
  const left = startsAt - at
  if (left <= 0) return '모임이 시작됐어요'
  if (left <= 2 * HOUR) return `${Math.max(1, Math.round(left / HOUR))}시간 뒤에 시작해요`
  const days = Math.round((ymdOf(startsAt) - ymdOf(at)) / (24 * HOUR))
  const p = parts(startsAt)
  const day = days === 0 ? '오늘' : days === 1 ? '내일' : days === 2 ? '모레' : `${p.m}월 ${p.d}일 (${WEEK[p.w]})`
  return `${day} ${hourText(startsAt)}에 시작해요`
}

function noticeText(d) {
  const t = d.target ? d.target.title : null
  const by = who(d.actor)
  const subj = `${by}${josa(by, '이', '가')}`
  switch (d.type) {
    case 'MEETUP_APPLICATION_RECEIVED': return { title: `${quote(t, '내 모임')}에 새 참여 신청이 왔어요`, sub: `${subj} 참여를 신청했어요` }
    case 'MEETUP_APPLICATION_ACCEPTED': return { title: '참여 신청이 수락됐어요', sub: t ? `‘${t}’에 함께해요` : '삭제된 모임이에요' }
    case 'MEETUP_APPLICATION_REJECTED': return { title: '참여가 승인되지 않았어요', sub: quote(t, '삭제된 모임이에요') }
    case 'MEETUP_PARTICIPATION_CANCELED': return { title: `${quote(t, '내 모임')} 참여자가 참여를 취소했어요`, sub: `${subj} 참여를 취소했어요` }
    case 'MEETUP_KICKED': return { title: `${quote(t, '모임')} 참여가 취소됐어요`, sub: '모임에서 내보내졌어요' }
    case 'MEETUP_UPDATED': return { title: `${quote(t, '신청한 모임')} 정보가 바뀌었어요`, sub: t ? '바뀐 내용을 확인해 보세요' : '삭제된 모임이에요' }
    case 'MEETUP_CANCELED': return { title: `${quote(t, '신청한 모임')}${t ? ' 모임' : ''}이 취소됐어요`, sub: '모임이 열리지 않아요' }
    case 'MEETUP_DELETED': return { title: '신청한 모임이 삭제됐어요', sub: quote(t, '신청이 함께 정리됐어요') }
    case 'MEETUP_VACANCY_OPENED': return { title: `${quote(t, '빈자리 알림을 켠 모임')}에 빈자리가 생겼어요`, sub: t ? '빈자리 알림을 켠 모임이에요' : '삭제된 모임이에요' }
    case 'MEETUP_START_REMINDER': {
      const name = quote(t, '참여하는 모임')
      const starts = d.target && d.target.startsAt ? startsText(Date.parse(d.target.startsAt), Date.parse(d.createdAt)) : '삭제된 모임이에요'
      return { title: `${name}${josa(name, '이', '가')} 곧 시작돼요`, sub: starts }
    }
    case 'CHAT_MESSAGE_RECEIVED': return { title: '새 메시지가 도착했어요', sub: t ? `‘${t}’ 대화방 · ${by}` : `${subj} 메시지를 보냈어요` }
    case 'CHAT_REQUEST_RECEIVED': return { title: '대화 요청이 왔어요', sub: `${subj} 대화를 요청했어요` }
    case 'CHAT_REQUEST_ACCEPTED': return { title: `${subj} 대화 요청을 수락했어요`, sub: '1:1 대화방이 열렸어요' }
    case 'POST_COMMENTED': return { title: '내 글에 댓글이 달렸어요', sub: `${quote(t, '삭제된 글')} · ${by}` }
    case 'POST_LIKED': return { title: '내 글에 좋아요가 눌렸어요', sub: `${quote(t, '삭제된 글')} · ${by}` }
    case 'COMMENT_REPLIED': return { title: '내 댓글에 답글이 달렸어요', sub: `${quote(t, '삭제된 글')} · ${by}` }
    case 'COMMENT_LIKED': return { title: '내 댓글에 좋아요가 눌렸어요', sub: `${quote(t, '삭제된 글')} · ${by}` }
    case 'POST_HIDDEN': return { title: '내 글이 신고로 가려졌어요', sub: quote(t, '삭제된 글') }
    case 'COMMENT_HIDDEN': return { title: '내 댓글이 신고로 가려졌어요', sub: quote(t, '삭제된 글') }
    case 'GUESTBOOK_ENTRY_CREATED': return { title: '내 땅굴 방명록에 새 글이 남겨졌어요', sub: `${subj} 글을 남겼어요` }
    case 'GUESTBOOK_ENTRY_HIDDEN': return { title: '내가 쓴 방명록 글이 신고로 가려졌어요', sub: '글을 남겼던 땅굴에서 확인해 보세요' }
    case 'NOTICE_PUBLISHED': return { title: '새 공지가 올라왔어요', sub: t || '내려간 공지예요' }
    default: return { title: '새 알림이 있어요', sub: '' }
  }
}

function noticeLink(type, target) {
  const tg = target || {}
  const id = tg.id == null ? '' : String(tg.id)
  if (tg.type === 'GUESTBOOK') return '/burrow?modal=guestbook'
  if (tg.type === 'CHAT_REQUEST') return '/chat/requests'
  if (!id) return '/notifications'
  const e = encodeURIComponent(id)
  switch (tg.type) {
    case 'MEETUP': return type === 'MEETUP_APPLICATION_RECEIVED' ? `/meetups/me?tab=hosting&manage=${e}` : `/meetups/${e}`
    case 'CHAT_ROOM': return `/chat/${e}`
    case 'POST': return `/board/${e}`
    case 'BURROW': return `/burrow/${e}`
    case 'NOTICE': return `/settings/notices/${e}`
    default: return '/notifications'
  }
}

/** 푸시 한 건 → 보여 줄 알림 (테스트도 이 함수를 씀) */
function pushView(data) {
  if (!data || typeof data !== 'object' || !data.type) return { title: '디굴디굴', body: '새 알림이 있어요', url: '/notifications', tag: undefined }
  const { title, sub } = noticeText(data)
  return { title, body: sub, url: noticeLink(data.type, data.target), tag: data.id == null ? undefined : `notice-${data.id}` }
}
self.pushView = pushView

self.addEventListener('push', (event) => {
  let data = null
  try { data = event.data ? event.data.json() : null } catch { data = null }
  const v = pushView(data)
  event.waitUntil(self.registration.showNotification(v.title, { body: v.body, tag: v.tag, renotify: !!v.tag, data: { url: v.url } }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus() } }
    return self.clients.openWindow(url)
  }))
})
