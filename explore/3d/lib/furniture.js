/* ---------- 가구 카탈로그 ---------- */
// 관심 분야(Figma 온보딩의 11개 분야) → 가구 17개. 모든 가구는 뒤쪽 반원 벽을 따라 붙고 방 가운데를 봄.
// 가운데 바닥(러그)은 비워서 두더지가 다닐 수 있게.
//  - build(g): 가구를 자기 원점 기준으로 만듦 (앞면이 +Z, 바닥 y=0)
//  - slot: { a: 벽 위 각도(도, 뒤 가운데 0, 오른쪽 +), d: 앞뒤 깊이(벽에서 띄울 거리 계산용), y: 벽걸이 높이 }
//    slot이 없으면(러그) 방 가운데
//  - tag: 이름표 위치(가구 원점 기준 높이)
//  - foot: 두더지가 못 지나가는 바닥 반경 (벽걸이는 0)
// 필요한 도우미: box, cyl, sph, add, at, clay (페이지/모듈 쪽에 정의돼 있어야 함)
// furnishRoom(root, { interests, wallR, wallAt }) → 놓인 가구 그룹 배열 (group.userData.furniture = 항목, .foot = {x, z, r})
const FURNITURE_CATS = ['게임·놀이', '책·글', '음악', '공예·만들기', '사진', '운동·아웃도어', '차·커피·베이킹', '자연·식물', '우주·과학', '영화·애니', '반려동물'];
function grp(p, x, y, z, ry = 0, s = 1) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s); p.add(g); return g; }

const FURNITURE = [
  /* 기본 */
  { id: 'rug', label: '러그', cat: '기본', foot: 0, build(g) {
    cyl(g, 2.6, 2.6, .04, '#a3bf72', 0, 0, 0, 64);
    cyl(g, 2.05, 2.05, .05, '#efc57e', 0, 0, 0, 64);
  } },
  { id: 'bed', label: '침대', cat: '기본', slot: { a: -66, d: 3.3 }, foot: 1.75, tag: 1.3, build(g) {
    box(g, 2.0, .55, 3.2, '#c27a52', 0, 0, 0, .12);
    box(g, 1.95, .38, 3.0, '#f1e3d1', 0, .5, 0, .14);
    box(g, 2.08, .22, 2.3, '#8fae5c', 0, .82, .38, .1);
    box(g, 1.5, .26, .7, '#f6ead9', 0, .86, -1.1, .13);
    box(g, 2.1, 1.25, .26, '#b86f49', 0, 0, -1.62, .08);
  } },

  /* 게임·놀이 */
  { id: 'arcade', label: '오락기', cat: '게임·놀이', slot: { a: -49, d: 1.0 }, foot: .7, tag: 2.75, build(g) {
    box(g, 1.0, 2.5, .95, '#f0e2c9', 0, 0, 0, .1);
    box(g, .8, .65, .1, '#a9c8a6', 0, 1.55, .47, .06);
    box(g, 1.02, .5, 1.05, '#e9c25f', 0, .85, .05, .06);
    sph(g, .07, '#e07a52', -.18, 1.38, .55); sph(g, .07, '#9fbf74', .05, 1.38, .55);
  } },
  { id: 'wallTv', label: '레트로 TV', cat: '게임·놀이', slot: { a: -34, d: .8, y: 3.75 }, foot: 0, tag: .75, build(g) {
    box(g, 1.6, .18, .8, '#b26d47', 0, -.25, 0, .04);
    box(g, 1.25, 1.0, .75, '#f0e6d4', 0, 0, 0, .14);
    box(g, .9, .7, .05, '#b6c9c8', -.08, .15, .38, .1);
  } },
  /* 책·글 */
  { id: 'bookshelf', label: '책장', cat: '책·글', slot: { a: -34, d: .75 }, foot: .9, tag: 3.25, build(g) {
    box(g, 1.7, 3.0, .7, '#c98559', 0, 0, 0, .06);
    for (const y of [.3, 1.2, 2.1]) box(g, 1.5, .08, .62, '#b26d47', 0, y, .05, .02);
    const bc = ['#8fae5c', '#b9d3df', '#f0d7a8', '#e07a52', '#f4eadd'];
    for (let s = 0; s < 3; s++) for (let i = 0; i < 4; i++) box(g, .16, .62 + (i % 2) * .1, .44, bc[(s + i) % 5], -.5 + i * .2, .38 + s * .9, .05, .03);
  } },
  /* 자연·식물 */
  { id: 'plantStand', label: '화분', cat: '자연·식물', slot: { a: -22, d: .65 }, foot: .45, tag: 2.55, build(g) {
    cyl(g, .25, .3, 1.3, '#d0895f', 0, 0, 0); cyl(g, .3, .24, .4, '#e9d5bd', 0, 1.3, 0);
    for (let i = 0; i < 6; i++) { const m = sph(g, .3, '#7fa95a', Math.cos(i) * .3, 2.0, Math.sin(i) * .2, 1.1, .4, .6); m.rotation.z = Math.cos(i) * .6; }
  } },
  /* 차·커피·베이킹 */
  { id: 'kitchen', label: '부엌 선반', cat: '차·커피·베이킹', slot: { a: 0, d: 1.0 }, foot: 1.35, tag: 2.4, build(g) {
    box(g, 2.6, 1.55, .9, '#f2e2c8', 0, 0, 0, .06);
    box(g, 2.7, .1, 1.0, '#c98559', 0, 1.55, 0, .03);
    cyl(g, .32, .3, .32, '#e8714b', .5, 1.65, .05); box(g, .7, .12, .06, '#e8714b', .5, 1.88, .05, .03);
    box(g, .9, .7, .25, '#c98559', -.6, 1.65, -.2, .04);
    for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) cyl(g, .07, .07, .17, ['#e07a52', '#9fbf74', '#f0d7a8'][i], -.85 + i * .25, 1.73 + k * .3, -.05);
    for (let i = 0; i < 2; i++) box(g, 1.0, .6, .04, '#f8ecda', -.6 + i * 1.2, .35, .46, .05);
  } },
  { id: 'wallShelf', label: '찻병 선반', cat: '차·커피·베이킹', slot: { a: 0, d: .45, y: 3.2 }, foot: 0, tag: .85, build(g) {
    box(g, 1.4, .12, .45, '#b26d47', 0, 0, 0, .03);
    [['#9fbf74', .55], ['#b9d3df', .42], ['#f0d7a8', .65], ['#e9c25f', .5]].forEach(([c, h], i) => cyl(g, .09, .1, h, c, -.45 + i * .3, .12, 0));
  } },
  /* 우주·과학 */
  { id: 'globe', label: '지구본', cat: '우주·과학', slot: { a: 16, d: .8 }, foot: .45, tag: 1.55, build(g) {
    cyl(g, .22, .26, .1, '#b26d47', 0, 0, 0); cyl(g, .03, .03, .5, '#b26d47', 0, .1, 0, 6);
    sph(g, .38, '#7fb0c6', 0, .95, 0); sph(g, .2, '#9fbf74', .15, 1.05, .23, 1, .8, .5);
  } },
  /* 음악 */
  { id: 'piano', label: '피아노', cat: '음악', slot: { a: 33, d: 1.6 }, foot: 1.45, tag: 2.1, build(g) {
    box(g, 2.7, 1.75, .9, '#d0875c', 0, 0, 0, .08);
    box(g, 2.5, .12, .5, '#f8ecda', 0, 1.05, .55, .03);
    box(g, 2.8, .14, 1.0, '#b86f49', 0, 1.75, 0, .04);
    box(g, .2, .9, .2, '#b86f49', -1.1, 0, .65, .04); box(g, .2, .9, .2, '#b86f49', 1.1, 0, .65, .04);
  } },
  { id: 'speaker', label: '스피커', cat: '음악', slot: { a: 52, d: .85 }, foot: .65, tag: 1.95, build(g) {
    box(g, 1.0, 1.75, .8, '#c77149', 0, 0, 0, .14);
    for (const [y, rr] of [[1.25, .25], [.62, .34]]) { const c = add(at(new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, .1, 32), clay('#d8dde0')), 0, y, .42), g); c.rotation.x = Math.PI / 2; const c2 = add(at(new THREE.Mesh(new THREE.CylinderGeometry(rr * .55, rr * .55, .12, 32), clay('#b8c2c7')), 0, y, .44), g); c2.rotation.x = Math.PI / 2; }
  } },
  /* 사진 */
  { id: 'camera', label: '카메라', cat: '사진', slot: { a: 63, d: 1.0 }, foot: .6, tag: 4.15, build(g) {
    for (let i = 0; i < 3; i++) { const a = i * 2.09; const l = add(at(new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, 3.3, 8), clay('#c27a52')), Math.cos(a) * .4, 1.6, Math.sin(a) * .4), g); l.rotation.set(Math.sin(a) * .25, 0, -Math.cos(a) * .25); }
    box(g, .65, .45, .38, '#a9bcc4', 0, 3.15, 0, .07);
    cyl(g, .14, .14, .25, '#7c6d66', 0, 3.37, .25).rotation.x = Math.PI / 2;
  } },
  { id: 'corkboard', label: '사진 보드', cat: '사진', slot: { a: 36, d: .1, y: 2.75 }, foot: 0, tag: .95, build(g) {
    box(g, 1.2, 1.4, .07, '#e5b98a', 0, 0, 0, .03);
    for (let i = 0; i < 5; i++) box(g, .2, .25, .02, ['#f8ecda', '#f0d7a8', '#b9d3df'][i % 3], -.35 + (i % 3) * .33, .3 + Math.floor(i / 3) * .45, .05, .01);
  } },
  /* 공예·만들기 */
  { id: 'easel', label: '이젤', cat: '공예·만들기', slot: { a: 74, d: .9 }, foot: .7, tag: 3.1, build(g) {
    for (const x of [-.45, .45]) { const l = box(g, .1, 3.0, .1, '#c98559', x, 0, 0, .03); l.rotation.z = x > 0 ? -.08 : .08; }
    box(g, 1.25, 1.35, .08, '#f8ecda', 0, 1.6, .12, .03);
    box(g, .9, .5, .02, '#9fbf74', .05, 1.75, .17, .02);
    sph(g, .16, '#f0c868', .25, 2.3, .17, 1, 1, .2);
  } },
  /* 영화·애니 */
  { id: 'projector', label: '영사기', cat: '영화·애니', slot: { a: 86, d: 1.0 }, foot: .6, tag: 1.6, build(g) {
    box(g, .75, .55, .55, '#a9bcc4', 0, 0, 0, .08);
    for (const x of [-.3, .3]) { const t = add(at(new THREE.Mesh(new THREE.TorusGeometry(.26, .1, 10, 24), clay('#e86a42')), x, .95, 0), g); t.rotation.y = Math.PI / 2; }
    cyl(g, .12, .14, .3, '#7c6d66', 0, .15, .4).rotation.x = Math.PI / 2;
  } },
  /* 운동·아웃도어 */
  { id: 'backpack', label: '배낭', cat: '운동·아웃도어', slot: { a: -70, d: .7, y: 1.75 }, foot: 0, tag: 1.6, build(g) {   // 침대 위 벽에 걸어 둠
    box(g, 1.0, 1.15, .62, '#8fae5c', 0, 0, 0, .28); box(g, .7, .45, .2, '#7a9a4c', 0, .25, .36, .1);
    cyl(g, .2, .2, 1.05, '#a86a48', 0, 1.25, 0).rotation.z = Math.PI / 2;
  } },
  /* 반려동물 (원본 렌더엔 없어서 새로) */
  { id: 'petBed', label: '반려동물 방석', cat: '반려동물', slot: { a: -87, d: 1.4 }, foot: .75, tag: .95, build(g) {
    cyl(g, .62, .66, .22, '#e9a07a', 0, 0, 0, 40); cyl(g, .48, .48, .1, '#f6e6d4', 0, .2, 0, 40);
    cyl(g, .2, .16, .14, '#b9d3df', .85, 0, .2, 24); sph(g, .1, '#c98559', .85, .16, .2, 1, .4, 1);
  } },
];

// 사용자 관심사는 '캠핑', '피아노', '홈카페', '고양이' 같은 태그라서 분야로 바꿈 (분야 이름을 그대로 줘도 됨)
const TAG_RULES = [
  [/게임|보드|퍼즐|놀이/, '게임·놀이'],
  [/독서|책|에세이|소설|글|시집|만화책/, '책·글'],
  [/음악|피아노|기타|노래|악기|밴드|재즈|힙합/, '음악'],
  [/그림|공예|만들기|뜨개|자수|도자|드로잉|DIY/i, '공예·만들기'],
  [/사진|필름|카메라/, '사진'],
  [/캠핑|운동|여행|등산|러닝|자전거|헬스|요가|아웃도어|낚시/, '운동·아웃도어'],
  [/요리|홈카페|커피|차|베이킹|빵|디저트/, '차·커피·베이킹'],
  [/식물|가드닝|꽃|자연|산책/, '자연·식물'],
  [/우주|과학|별|천문/, '우주·과학'],
  [/영화|애니|드라마|덕질/, '영화·애니'],
  [/고양이|강아지|반려|햄스터|펫/, '반려동물'],
];
function interestCats(list) {
  const out = new Set();
  for (const v of list) {
    if (FURNITURE_CATS.includes(v)) { out.add(v); continue; }
    for (const [re, cat] of TAG_RULES) if (re.test(v)) out.add(cat);
  }
  return out;
}
// wallAt(y) = 높이 y에서 벽(안쪽 면)까지 반지름. 가구 앞뒤 깊이와 키를 보고 벽에 닿지 않게 붙임
function furnishRoom(root, opts = {}) {
  const on = new Set(['기본', ...(opts.interests ? interestCats(opts.interests) : FURNITURE_CATS)]);
  const wallAt = opts.wallAt || (() => 6.2), center = opts.center || [0, .6];
  const placed = [];
  for (const f of FURNITURE) {
    if (!on.has(f.cat)) continue;
    const g = new THREE.Group(); g.name = f.id; g.userData.furniture = f; root.add(g);
    if (f.slot) {
      const a = f.slot.a * Math.PI / 180, y = f.slot.y || 0;
      // 벽걸이는 그 높이의 벽, 바닥 가구는 키(대략 3까지) 중 가장 안쪽 벽에 맞춤
      const wall = y ? wallAt(y + .5) : Math.min(wallAt(0), wallAt(2.2)) - .12;
      const r = f.slot.r || (wall - f.slot.d / 2 - .06);
      g.position.set(Math.sin(a) * r, y, -Math.cos(a) * r);
      g.rotation.y = -a;
    } else g.position.set(center[0], 0, center[1]);
    f.build(g);
    g.userData.foot = f.foot ? { x: g.position.x, z: g.position.z, r: f.foot } : null;
    placed.push(g);
  }
  return placed;
}
/* ---------- 가구 카탈로그 끝 ---------- */
