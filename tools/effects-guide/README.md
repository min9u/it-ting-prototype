# 이펙트 도감 (팀 공유용 안내 페이지)

관심사 이펙트 23가지(땅굴 11 · 탐색 들판 12)와 아직 만들지 않은 아이디어 16개를 사진과 함께 보여 주는 페이지. 디자이너와 팀원이 이펙트마다 "쓰자 · 고민 · 빼자"를 고르고, 정할 것에 답하고, 새 아이디어를 적은 뒤 **"내 의견 복사"로 팀 채팅에 붙여 넣는** 방식이다.

- 게시: https://claude.ai/artifact/KveYCfeoSQ27jcMzMeD5D9 (2026-11-18, 비공개로 시작. 공유는 페이지의 Share 메뉴)
- 요청 (그대로): "디자이너와 다른 팀원들에게 다양한 이펙트에 대해 설명해주려해. 다 쓸건 아니고 이중에 무엇을 쓸지, 또 더 새롭게 만들 이펙트는 없을지 알려줘야하니까. 팀원들에게 공유할 안내 아티펙트를 만들어줘"
- 내용의 출처: [docs/interest-effects.md](../../docs/interest-effects.md) (1차·2차 아이디어 표, 세 단계, 성능), 사진은 `docs/screenshots/interest-effects/`

## 왜 의견을 서버에 모으지 않나
아티팩트의 공유 저장소(`db`)는 같은 조직 사람이나 Contributor 이상만 쓸 수 있다. 공개 링크로 들어오는 바깥 사람(팀원 대부분)은 읽기만 가능하고, 로그인하지 않으면 아예 못 쓴다. 그래서 고른 것은 각자 브라우저(localStorage `digul-fx-guide.v1`)에만 두고, 글로 복사해서 팀 채팅에 붙이게 했다.

## 고치기
1. 페이지: `effects-guide.html` 한 장 (`<html>/<head>/<body>` 없음, 게시할 때 붙음). 이펙트·아이디어·질문은 맨 아래 `<script>` 의 `FX` · `IDEAS` · `QS` 배열
2. 사진: `python -I tools/effects-guide/crop.py docs/screenshots/interest-effects tools/effects-guide/out/img`
   - `crops.json` = `[이름, 원본 스크린샷, 자를 상자(원본 px), 강조 상자들]`. 자른 그림은 3:2 로 맞춤(미니맵·이펙트 패널만 그대로), 1440×900 원본은 `out/img/full/`(크게 보기용)
3. `effects-guide.html` 을 `out/` 에 복사하고 Artifact publish: `file_path` = `out/effects-guide.html`, `root` = `out`, `files` = 페이지가 쓰는 `img/*.jpg` · `img/full/*.jpg` (경로 그대로). 다른 세션이면 위 주소를 `url` 로 (먼저 read)
- `out/` 은 커밋하지 않음 (.gitignore)

## 바뀔 수 있는 것
- 관심사 분류 확정본(대분류 12 · 소분류 90, 2026-11-18)을 반영한 뒤 "디자이너에게" 장의 입자 표를 새 분류로 고침 (version 2). 사진은 예전 분류(11개) 화면 그대로
- 탐색 카메라 멀리 보기(3D 인계 v3.10)가 들어오면 "탐색을 멀리 볼 때" 질문의 답에 따라 말풍선 규칙을 정함
