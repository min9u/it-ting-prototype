/*
 * 브라우저 푸시 받기 (설정 › 알림 설정 "브라우저 알림 받기", lib/browserPush.ts 가 실제 서버 모드에서만 등록).
 * 푸시 내용의 모양은 명세에 없어(10 "구현 단계로 넘기는 것") { title, body, url } JSON 으로 가정. 글이면 본문으로 씀
 */
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data ? event.data.text() : '' } }
  const title = data.title || '디굴디굴'
  event.waitUntil(self.registration.showNotification(title, { body: data.body || '', data: { url: data.url || '/' } }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus() } }
    return self.clients.openWindow(url)
  }))
})
