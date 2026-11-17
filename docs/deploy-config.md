# 배포 설정 예시 (Nginx · Spring Boot · EC2)

- 날짜: 2026-11-16
- 요청: 실제 서비스 배포에 대비해 서버 설정 예시를 문서로 (프론트엔드 안정성 작업의 일부. 프론트 쪽 변경은 [frontend-hardening.md](frontend-hardening.md))
- **가정**: 백엔드 코드와 서버는 아직 없다. 아래는 SSAFY 팀에서 흔한 구성인 **Spring Boot + Nginx + EC2(Ubuntu)** 를 가정한 예시다. 도메인 `digul.example.com`, Spring 포트 `8080`, 정적 파일 `/var/www/digul/current` 은 모두 예시 값이다. 실제 구성이 정해지면 이 문서를 고친다.
- 근거가 되는 위험 목록: [dev-deploy-risks.md](dev-deploy-risks.md) D1(새로고침 404) · D2(재배포 뒤 청크 404) · D4(캐시) · B4(채팅 실시간) · B5(인증) · B6(CORS·쿠키)

## 0. 한 장 그림

```
브라우저 ──https──▶ Nginx :443 ─┬─ /            정적 파일 (app/dist). 모르는 경로는 index.html (브라우저 라우터)
                                ├─ /assets/*    해시 붙은 JS·CSS·그림·glb. 1년 캐시, 없으면 404 (index.html 로 바꾸지 않음)
                                ├─ /api/*       ──▶ Spring :8080 (REST)
                                └─ /ws          ──▶ Spring :8080 (WebSocket 업그레이드, STOMP)
```

**같은 출처로 맞추는 것이 핵심이다.** 브라우저가 보기에 페이지·API·WebSocket 이 모두 `https://digul.example.com` 이면 CORS 설정이 필요 없고, 쿠키도 `SameSite=Lax` 로 충분하다. 프론트 코드는 상대 경로(`/api`, `/ws`)만 쓴다 (`app/src/lib/env.ts` 기본값).

## 1. Nginx

`/etc/nginx/sites-available/digul` (예시)

```nginx
# WebSocket: 업그레이드 요청일 때만 Connection: upgrade
map $http_upgrade $connection_upgrade {
  default upgrade;
  ''      close;
}

upstream digul_api {
  server 127.0.0.1:8080;
  keepalive 32;
}

server {
  listen 80;
  server_name digul.example.com;
  return 301 https://$host$request_uri;          # 처음부터 HTTPS (wss 도 같이)
}

server {
  listen 443 ssl http2;
  server_name digul.example.com;
  ssl_certificate     /etc/letsencrypt/live/digul.example.com/fullchain.pem;   # certbot
  ssl_certificate_key /etc/letsencrypt/live/digul.example.com/privkey.pem;

  root /var/www/digul/current;                  # 배포할 때마다 releases/<시각> 을 만들고 current 링크만 바꿈 (5장)
  index index.html;

  # ---- 압축 ----
  gzip on;
  gzip_comp_level 6;
  gzip_min_length 1024;
  gzip_vary on;
  gzip_types text/css application/javascript application/json image/svg+xml application/wasm model/gltf-binary;
  # brotli 는 모듈(ngx_brotli)이 있을 때만. 없으면 gzip 만으로 충분
  # brotli on; brotli_comp_level 5; brotli_types text/css application/javascript application/json image/svg+xml application/wasm;
  # (선택) 빌드 때 .gz/.br 을 미리 만들면: gzip_static on; brotli_static on;

  # ---- 확장자 → MIME ----
  # 기본 mime.types 에 glb·wasm 이 없는 배포판이 있음. wasm 이 application/wasm 이 아니면
  # WebAssembly.instantiateStreaming 이 실패해 Draco 해독기가 느린 경로로 감 (app/public/draco/)
  types {
    application/wasm   wasm;
    model/gltf-binary  glb;
    model/gltf+json    gltf;
  }

  # ---- 캐시 ----
  # index.html: 매번 확인 (새 배포의 새 해시 파일 이름을 받게). D4
  location = /index.html {
    add_header Cache-Control "no-cache" always;
    try_files /index.html =404;
  }

  # 해시 붙은 파일: 1년 + immutable. 없는 파일은 404 그대로 (D2)
  # → index.html 을 돌려주면 JS 자리에 HTML 이 와서 "MIME type text/html" 에러가 나고, 프론트의 "한 번만 새로고침"(lib/chunkReload.ts)도 못 알아챔
  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    try_files $uri =404;
  }

  # 해시가 없는 정적 파일 (Draco 해독기 public/draco/, 파비콘 등): 짧게
  location /draco/ {
    add_header Cache-Control "public, max-age=86400" always;
    try_files $uri =404;
  }

  # ---- REST ----
  location /api/ {
    proxy_pass http://digul_api;                 # /api/... 그대로 넘김 (Spring 이 /api 접두사를 씀)
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;   # Spring 이 https 로 알아듣게 (쿠키 Secure, 리다이렉트 주소)
    proxy_read_timeout 30s;
    client_max_body_size 10m;                     # 글 사진 3장 (업로드 방식이 정해지면 맞출 것, B12)
  }

  # ---- WebSocket (STOMP) ----
  location /ws {
    proxy_pass http://digul_api;
    proxy_http_version 1.1;
    proxy_set_header Upgrade    $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # 기본 60초면 조용한 소켓이 끊김. 프론트·서버 하트비트가 10초라 실제로는 오가지만, 넉넉히
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_buffering off;
  }

  # ---- 그 밖의 모든 경로: SPA (브라우저 라우터 새로고침·딥링크, D1) ----
  location / {
    add_header Cache-Control "no-cache" always;
    try_files $uri $uri/ /index.html;
  }

  # ---- (선택) 보안 헤더 ----
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  # CSP 를 걸 때 주의: Draco 는 WebAssembly('wasm-unsafe-eval'), 3D 는 blob: Worker, 제목 서체는 Google Fonts,
  # glb 는 공유 빌드에서만 data: URL. 예) script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self' wss://digul.example.com;
  #     style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:
}
```

적용: `sudo nginx -t && sudo systemctl reload nginx`

### 프론트 빌드와 맞춰야 하는 것
| 프론트 | Nginx | 안 맞으면 |
|---|---|---|
| 브라우저 라우터 (`VITE_HASH_ROUTER` 비움 또는 `0`) | `location /` 의 `try_files … /index.html` | `/burrow` 새로고침 404 |
| 해시 파일은 `/assets/` | `/assets/` 는 `=404` | 옛 탭이 HTML 을 JS 로 받아 흰 화면 |
| `index.html` 은 매번 새로 | `no-cache` | 새 배포가 안 보임 |
| API·WS 상대 경로 (`/api`, `/ws`) | 같은 server 블록에서 프록시 | CORS 에러, 쿠키 안 실림 |
| `wss://` (https 페이지) | 443 + 업그레이드 헤더 | 혼합 콘텐츠 차단, 101 대신 400 |
| 하위 경로 배포(`/digul/`)면 `vite build --base=/digul/` + 라우터 `basename` | `location /digul/` | 깊은 경로에서 assets 를 엉뚱한 곳에서 찾음 |

## 2. Spring Boot 쪽 (가정, 백엔드 팀과 확인)

### 2-1. CORS
- **같은 출처(위 Nginx)면 CORS 설정이 필요 없다.** 개발 때도 Vite 프록시(`app/.env.local` 에 `DEV_PROXY_TARGET=http://localhost:8080`)를 쓰면 필요 없다.
- 다른 출처(예: 프론트 `digul.example.com`, API `api.digul.example.com`)가 꼭 필요할 때만:
  ```java
  config.setAllowedOrigins(List.of("https://digul.example.com", "http://localhost:5173"));
  config.setAllowCredentials(true);          // 쿠키를 보내려면 true + 출처를 구체적으로 ("*" 금지)
  config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
  config.setAllowedHeaders(List.of("Content-Type", "X-XSRF-TOKEN"));
  ```
  Spring Security 를 쓰면 `http.cors(...)` 를 켜야 위 설정이 필터보다 먼저 적용된다 (자주 막히는 곳).

### 2-2. 쿠키 · 인증
| 상황 | 쿠키 속성 |
|---|---|
| 같은 사이트 (추천 구성) | `HttpOnly; Secure; SameSite=Lax; Path=/` |
| 다른 사이트에서 API 호출 | `HttpOnly; Secure; SameSite=None; Path=/` (`None` 은 `Secure` 필수 = HTTPS 필수) |
- 로컬 개발(`http://localhost`)에서 `Secure` 쿠키는 크롬이 localhost 를 예외로 받아 주지만, IP(`http://127.0.0.1` 외 사설 IP)로 접속하면 안 실린다.
- 쿠키 인증 + 상태를 바꾸는 요청(POST 등)이면 CSRF 를 정한다 (Spring Security `CookieCsrfTokenRepository` → 프론트가 `X-XSRF-TOKEN` 헤더). `SameSite=Lax` 가 대부분 막아 주지만 정책으로 정할 것.
- 프론트 약속 (`app/src/lib/authFlow.ts`): 401 → 갱신 한 번(`POST /api/auth/refresh` 같은 것) → 그래도 401 이면 로그인 화면 + 돌아올 주소. **403 은 "권한 없음"으로 로그인으로 보내지 않는다.** 401·403 의 뜻을 이렇게 맞춘다.
- Nginx 뒤에서 https 를 알아듣게: `server.forward-headers-strategy=framework` (리다이렉트 주소·`Secure` 쿠키 판단).

### 2-3. WebSocket · STOMP (프론트 `app/src/realtime/`, 자세한 약속은 frontend-hardening.md 1-4)
```java
@Configuration @EnableWebSocketMessageBroker
public class WsConfig implements WebSocketMessageBrokerConfigurer {
  public void registerStompEndpoints(StompEndpointRegistry r) {
    r.addEndpoint("/ws").setAllowedOriginPatterns("https://digul.example.com", "http://localhost:5173");
    // .withSockJS() 를 켜면 순수 WebSocket 주소가 /ws/websocket 이 됨 → 프론트 VITE_WS_URL=/ws/websocket
  }
  public void configureMessageBroker(MessageBrokerRegistry r) {
    r.enableSimpleBroker("/topic", "/queue")
     .setHeartbeatValue(new long[]{10000, 10000})     // 프론트도 10초 (realtime/protocol.ts TIMING.heartbeat)
     .setTaskScheduler(heartbeatScheduler());         // 하트비트를 쓰려면 스케줄러 필요
    r.setApplicationDestinationPrefixes("/app");
    r.setUserDestinationPrefix("/user");
  }
}
```
- 인증: 핸드셰이크에 쿠키가 실린다 (같은 출처). `HandshakeInterceptor` 또는 CONNECT 프레임을 보는 `ChannelInterceptor` 에서 사용자를 정하고, **SUBSCRIBE 때 그 방의 참여자인지 검사**한다 (`/topic/chat/rooms/{id}` 를 아무나 구독하면 남의 대화를 볼 수 있음).
- 세션이 만료되면 서버가 `ERROR` 프레임(`message: 401 Unauthorized`)을 보내거나 닫힘 코드 `4401` 로 끊는다 → 프론트는 다시 연결하지 않고 로그인으로 보낸다.
- 보내기 멱등: 같은 `clientMessageId` 가 다시 오면 새로 저장하지 않고 저장된 메시지를 다시 방송 (`chat_message` 에 `client_message_id` + UQ(chat_room_id, sender_id, client_message_id)).

### 2-4. 시간대 · JSON
- 서버 시간대와 JSON 날짜는 [dev-deploy-risks.md](dev-deploy-risks.md) B2 대로: 순간은 ISO 8601 + 오프셋, 기준 `Asia/Seoul`. EC2 기본 시간대는 UTC 라 `LocalDateTime` 을 그대로 내보내면 9시간 어긋난다.
- ID 는 JSON 에서 문자열 (B7). 큰 BIGINT 가 자바스크립트 숫자 범위를 넘을 수 있다.

## 3. 프론트 환경 변수 (빌드할 때 들어감)
`app/.env.production` (커밋해도 되는 값만. `VITE_` 값은 JS 에 그대로 박혀 누구나 볼 수 있음)
```
VITE_HASH_ROUTER=0
VITE_API_BASE=/api
VITE_WS_URL=/ws
VITE_REALTIME=stomp
```
- 목록과 뜻: `app/.env.example`, 읽는 곳: `app/src/lib/env.ts` 하나.
- `"0"`·`"false"` 는 거짓으로 읽는다 (예전에는 `VITE_HASH_ROUTER=0` 도 참이었음, D3).

## 4. 배포 절차 (예시)
```bash
cd app
npm ci                       # package-lock 그대로 (npm install 금지)
npm run build                # tsc -b && vite build → app/dist
REL=/var/www/digul/releases/$(date +%Y%m%d%H%M%S)
mkdir -p $REL && cp -r dist/. $REL/
# 옛 탭을 위해 직전 배포 두 번의 assets 를 새 릴리스에 같이 둠 (해시 이름이 달라서 겹치지 않음)
for old in $(ls -1dt /var/www/digul/releases/* | sed -n '2,3p'); do cp -rn $old/assets/. $REL/assets/; done
ln -sfn $REL /var/www/digul/current     # 링크 교체 = 한 번에 바뀜 (index.html 만 먼저 바뀌는 순간이 없음)
sudo nginx -t && sudo systemctl reload nginx
ls -1dt /var/www/digul/releases/* | tail -n +6 | xargs rm -rf   # 최근 5개만 남김
```
- 옛 assets 를 남기는 까닭: 열려 있던 탭이 옛 해시 파일을 찾을 때 404 가 나지 않게 (D2). 그래도 404 가 나면 프론트가 한 번만 새로고침한다.
- 팀 공유 아티팩트 배포는 이 절차와 다르다 (`CLAUDE.md` "팀 공유용 앱 배포").

## 5. 배포 뒤 확인
```bash
curl -sI https://digul.example.com/ | grep -i cache-control              # no-cache
curl -sI https://digul.example.com/burrow/yerin | head -1                # 200 (index.html)
curl -sI https://digul.example.com/assets/index-<해시>.js | grep -i cache  # max-age=31536000, immutable
curl -sI https://digul.example.com/assets/없는파일.js | head -1            # 404 (200 이면 안 됨)
curl -sI https://digul.example.com/draco/draco_decoder.wasm | grep -i content-type   # application/wasm
curl -s  https://digul.example.com/api/health                             # Spring 이 응답
```
- WebSocket: 브라우저 개발자 도구 Network → WS 에서 `101 Switching Protocols`, 프레임 탭에 `CONNECTED` 와 10초마다 빈 줄(하트비트). 1분 넘게 아무것도 안 해도 끊기지 않아야 한다.
- 새로고침·딥링크: `/burrow/explore`, `/chat/r-yerin` 을 주소창에 바로 넣고 열기.
- 재배포 중 열린 탭: 배포 전에 앱을 열어 두고, 배포 뒤 땅굴로 들어가 3D 가 뜨는지 (또는 한 번 새로고침되는지).
