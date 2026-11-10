/* ---------- 가구 카탈로그 ---------- */
// 관심 분야(Figma 온보딩의 11개 분야) → 가구. 자리는 Figma 원본 렌더의 배치를 그대로 씀.
// 고른 분야의 가구만 놓이고, 안 고른 자리는 비워 둠(배치가 흐트러지지 않게).
// 필요한 도우미: box, cyl, sph, add, at, clay (페이지/모듈 쪽에 정의돼 있어야 함)
// furnishRoom(root, { interests }) → 놓인 가구 그룹 배열 (각 group.userData.furniture = 카탈로그 항목)
const FURNITURE_CATS = ['게임·놀이', '책·글', '음악', '공예·만들기', '사진', '운동·아웃도어', '차·커피·베이킹', '자연·식물', '우주·과학', '영화·애니', '반려동물'];
function grp(p, x, y, z, ry = 0, s = 1) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s); p.add(g); return g; }

const FURNITURE = [
  /* 기본: 누구 방에나 있음 */
  { id: 'rug', label: '러그', cat: '기본', build(r) {
    cyl(r, 2.95, 2.95, .04, '#a3bf72', .2, 0, .5, 64);
    cyl(r, 2.35, 2.35, .05, '#efc57e', .2, 0, .5, 64);
  } },
  { id: 'bed', label: '침대', cat: '기본', build(r) {
    const g = grp(r, -4.25, 0, .9, .45);
    box(g, 2.0, .55, 3.2, '#c27a52', 0, 0, 0, .12);
    box(g, 1.95, .38, 3.0, '#f1e3d1', 0, .5, 0, .14);
    box(g, 2.08, .22, 2.3, '#8fae5c', 0, .82, .38, .1);
    box(g, 1.5, .26, .7, '#f6ead9', 0, .86, -1.1, .13);
    box(g, 2.1, 1.25, .26, '#b86f49', 0, 0, -1.62, .08);
  } },
  { id: 'beanbag', label: '빈백', cat: '기본', build(r) {
    sph(r, 1.0, '#93b763', -2.05, .62, 1.6, 1.05, .66, 1);
    sph(r, .5, '#a7c879', -2.0, 1.15, 1.25, 1.1, .5, .9);
  } },
  { id: 'mushroomLamp', label: '버섯 스탠드', cat: '기본', build(r) {
    cyl(r, .08, .1, 2.4, '#f2e6d4', -1.35, 0, -.25); sph(r, .6, '#e8b27a', -1.35, 2.42, -.25, 1, .45, 1); cyl(r, .3, .35, .08, '#efe1cc', -1.35, 0, -.25);
  } },

  /* 게임·놀이 */
  { id: 'arcade', label: '오락기', cat: '게임·놀이', tag: [-4.3, 2.7, -1.55], build(r) {
    const g = grp(r, -4.3, 0, -1.55, .8);
    box(g, 1.0, 2.5, .95, '#f0e2c9', 0, 0, 0, .1);
    box(g, .8, .65, .1, '#a9c8a6', 0, 1.55, .47, .06);
    box(g, 1.02, .5, 1.05, '#e9c25f', 0, .85, .05, .06);
    sph(g, .07, '#e07a52', -.18, 1.38, .55); sph(g, .07, '#9fbf74', .05, 1.38, .55);
  } },
  { id: 'wallTv', label: '레트로 TV', cat: '게임·놀이', tag: [-4.45, 4.3, -2.05], build(r) {
    const g = grp(r, -4.45, 3.55, -2.05, .8);
    box(g, 1.6, .18, .8, '#b26d47', 0, -.25, 0, .04);
    box(g, 1.25, 1.0, .75, '#f0e6d4', 0, 0, 0, .14);
    box(g, .9, .7, .05, '#b6c9c8', -.08, .15, .38, .1);
  } },
  /* 책·글 */
  { id: 'bookshelf', label: '책장', cat: '책·글', tag: [-3.35, 3.2, -2.75], build(r) {
    const g = grp(r, -3.35, 0, -2.75, .62);
    box(g, 1.7, 3.0, .7, '#c98559', 0, 0, 0, .06);
    for (const y of [.3, 1.2, 2.1]) box(g, 1.5, .08, .62, '#b26d47', 0, y, .05, .02);
    const bc = ['#8fae5c', '#b9d3df', '#f0d7a8', '#e07a52', '#f4eadd'];
    for (let s = 0; s < 3; s++) for (let i = 0; i < 4; i++) box(g, .16, .62 + (i % 2) * .1, .44, bc[(s + i) % 5], -.5 + i * .2, .38 + s * .9, .05, .03);
  } },
  /* 음악 */
  { id: 'speaker', label: '스피커', cat: '음악', tag: [1.55, 1.95, -.55], build(r) {
    const g = grp(r, 1.55, 0, -.55, -.15);
    box(g, 1.0, 1.75, .8, '#c77149', 0, 0, 0, .14);
    for (const [y, rr] of [[1.25, .25], [.62, .34]]) { const c = add(at(new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, .1, 32), clay('#d8dde0')), 0, y, .42), g); c.rotation.x = Math.PI / 2; const c2 = add(at(new THREE.Mesh(new THREE.CylinderGeometry(rr * .55, rr * .55, .12, 32), clay('#b8c2c7')), 0, y, .44), g); c2.rotation.x = Math.PI / 2; }
  } },
  { id: 'piano', label: '피아노', cat: '음악', tag: [2.75, 2.1, -3.65], build(r) {
    const g = grp(r, 2.75, 0, -3.65, -.38);
    box(g, 2.7, 1.75, .9, '#d0875c', 0, 0, 0, .08);
    box(g, 2.5, .12, .5, '#f8ecda', 0, 1.05, .55, .03);
    box(g, 2.8, .14, 1.0, '#b86f49', 0, 1.75, 0, .04);
    box(g, .2, .9, .2, '#b86f49', -1.1, 0, .65, .04); box(g, .2, .9, .2, '#b86f49', 1.1, 0, .65, .04);
  } },
  /* 공예·만들기 */
  { id: 'easel', label: '이젤', cat: '공예·만들기', tag: [3.75, 3.75, -2.65], build(r) {
    const g = grp(r, 3.75, 0, -2.65, -.6);
    for (const x of [-.45, .45]) { const l = box(g, .1, 3.0, .1, '#c98559', x, 0, 0, .03); l.rotation.z = x > 0 ? -.08 : .08; }
    box(g, 1.25, 1.35, .08, '#f8ecda', 0, 1.6, .12, .03);
    box(g, .9, .5, .02, '#9fbf74', .05, 1.75, .17, .02);
    sph(g, .16, '#f0c868', .25, 2.3, .17, 1, 1, .2);
  } },
  /* 사진 */
  { id: 'camera', label: '카메라', cat: '사진', tag: [4.75, 4.15, -.6], build(r) {
    const g = grp(r, 4.75, 0, -.6, -.5);
    for (let i = 0; i < 3; i++) { const a = i * 2.09; const l = add(at(new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, 3.3, 8), clay('#c27a52')), Math.cos(a) * .45, 1.6, Math.sin(a) * .45), g); l.rotation.set(Math.sin(a) * .28, 0, -Math.cos(a) * .28); }
    box(g, .65, .45, .38, '#a9bcc4', 0, 3.15, 0, .07);
    cyl(g, .14, .14, .25, '#7c6d66', 0, 3.37, .25).rotation.x = Math.PI / 2;
  } },
  { id: 'corkboard', label: '사진 보드', cat: '사진', tag: [5.05, 2.3, -1.95], build(r) {
    const g = grp(r, 5.05, 2.4, -1.95, -1.0); box(g, 1.2, 1.4, .07, '#e5b98a', 0, 0, 0, .03);
    for (let i = 0; i < 5; i++) box(g, .2, .25, .02, ['#f8ecda', '#f0d7a8', '#b9d3df'][i % 3], -.35 + (i % 3) * .33, .3 + Math.floor(i / 3) * .45, .05, .01);
  } },
  /* 운동·아웃도어 */
  { id: 'treadmill', label: '러닝머신', cat: '운동·아웃도어', tag: [3.05, 2.35, -1.05], build(r) {
    const g = grp(r, 3.05, 0, -1.05, -.35);
    box(g, 1.3, .38, 3.0, '#e86a42', 0, 0, .3, .1);
    box(g, 1.1, .1, 2.6, '#a5aeb2', 0, .38, .35, .04);
    const p1 = box(g, .22, 2.5, .22, '#e86a42', -.55, .2, -1.05, .08); p1.rotation.x = -.18;
    const p2 = box(g, .22, 2.5, .22, '#e86a42', .55, .2, -1.05, .08); p2.rotation.x = -.18;
    box(g, 1.4, .42, .55, '#e86a42', 0, 2.55, -1.35, .12);
  } },
  { id: 'backpack', label: '배낭', cat: '운동·아웃도어', tag: [-3.35, 1.6, 3.35], build(r) {
    const g = grp(r, -3.35, 0, 3.35, .25); box(g, 1.0, 1.15, .62, '#8fae5c', 0, 0, 0, .28); box(g, .7, .45, .2, '#7a9a4c', 0, .25, .36, .1);
    cyl(g, .2, .2, 1.05, '#a86a48', 0, 1.25, 0).rotation.z = Math.PI / 2;
  } },
  { id: 'suitcases', label: '여행가방', cat: '운동·아웃도어', tag: [2.55, 2.0, 1.55], build(r) {
    const g = grp(r, 2.55, 0, 1.55, -.18);
    box(g, 2.0, .85, 1.25, '#e86a42', 0, 0, 0, .1);
    box(g, 1.85, .78, 1.15, '#a9bcc4', 0, .86, -.02, .1);
    for (const y of [.42, 1.28]) box(g, .7, .12, .1, '#8fae5c', 0, y, .64, .04);
    for (const x of [-.95, .95]) for (const y of [0, .86]) box(g, .14, .78, .14, '#f4eadd', x, y + .03, .58, .03);
  } },
  { id: 'campingMat', label: '캠핑 매트', cat: '운동·아웃도어', tag: [4.35, 1.1, 2.7], build(r) {
    const m = cyl(r, .38, .38, 1.15, '#8fae5c', 4.35, .38, 2.7); m.rotation.set(0, .5, Math.PI / 2); m.position.y = .38;
    const s = cyl(r, .39, .39, .25, '#f4eadd', 4.35, .38, 2.7); s.rotation.copy(m.rotation); s.position.y = .38;
    box(r, .85, .55, .6, '#e86a42', 4.85, 0, 1.0, .08, -.4); box(r, .35, .1, .1, '#f8ecda', 4.85, .58, 1.0, .03, -.4);
  } },
  /* 차·커피·베이킹 */
  { id: 'kitchen', label: '부엌 선반', cat: '차·커피·베이킹', tag: [.35, 2.6, -4.6], build(r) {
    const g = grp(r, .35, 0, -4.6);
    box(g, 2.6, 1.55, .9, '#f2e2c8', 0, 0, 0, .06);
    box(g, 2.7, .1, 1.0, '#c98559', 0, 1.55, 0, .03);
    cyl(g, .32, .3, .32, '#e8714b', .5, 1.65, .05); box(g, .7, .12, .06, '#e8714b', .5, 1.88, .05, .03);
    box(g, .9, .7, .25, '#c98559', -.6, 1.65, -.2, .04);
    for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) cyl(g, .07, .07, .17, ['#e07a52', '#9fbf74', '#f0d7a8'][i], -.85 + i * .25, 1.73 + k * .3, -.05);
    for (let i = 0; i < 2; i++) box(g, 1.0, .6, .04, '#f8ecda', -.6 + i * 1.2, .35, .46, .05);
  } },
  { id: 'teaTable', label: '티 테이블', cat: '차·커피·베이킹', tag: [-.35, 1.7, -1.05], build(r) {
    const g = grp(r, -.35, 0, -1.05);
    cyl(g, .07, .1, .85, '#b26d47', 0, 0, 0); cyl(g, .7, .7, .08, '#c98559', 0, .85, 0, 40);
    sph(g, .27, '#b9d3df', -.1, 1.17, 0, 1, .85, 1); cyl(g, .07, .09, .12, '#b9d3df', -.1, 1.38, 0);
    cyl(g, .1, .08, .15, '#e07a52', .38, .93, .2); cyl(g, .1, .08, .15, '#f0d7a8', .3, .93, -.25);
  } },
  { id: 'wallShelf', label: '찻병 선반', cat: '차·커피·베이킹', tag: [4.35, 4.4, -2.4], build(r) {
    const g = grp(r, 4.35, 3.6, -2.4, -.75);
    box(g, 1.2, .12, .45, '#b26d47', 0, 0, 0, .03);
    [['#9fbf74', .55], ['#b9d3df', .42], ['#f0d7a8', .65], ['#e9c25f', .5]].forEach(([c, h], i) => cyl(g, .09, .1, h, c, -.4 + i * .27, .12, 0));
  } },
  /* 자연·식물 */
  { id: 'plantStand', label: '화분', cat: '자연·식물', tag: [-1.3, 2.6, -2.3], build(r) {
    cyl(r, .25, .3, 1.3, '#d0895f', -1.3, 0, -2.3); cyl(r, .3, .24, .4, '#e9d5bd', -1.3, 1.3, -2.3);
    for (let i = 0; i < 6; i++) { const m = sph(r, .3, '#7fa95a', -1.3 + Math.cos(i) * .3, 2.0, -2.3 + Math.sin(i) * .2, 1.1, .4, .6); m.rotation.z = Math.cos(i) * .6; }
  } },
  { id: 'mushrooms', label: '작은 버섯', cat: '자연·식물', build(r) {
    cyl(r, .07, .08, .35, '#f6ead9', -2.75, 1.0, -.65); sph(r, .25, '#e06b4b', -2.75, 1.38, -.65, 1, .5, 1);
  } },
  /* 우주·과학 */
  { id: 'globe', label: '지구본', cat: '우주·과학', tag: [-1.2, 1.55, .55], build(r) {
    cyl(r, .22, .26, .1, '#b26d47', -1.2, 0, .55); cyl(r, .03, .03, .5, '#b26d47', -1.2, .1, .55, 6);
    sph(r, .38, '#7fb0c6', -1.2, .95, .55); sph(r, .2, '#9fbf74', -1.05, 1.05, .78, 1, .8, .5);
  } },
  /* 영화·애니 */
  { id: 'projector', label: '영사기', cat: '영화·애니', tag: [.95, 1.6, 2.15], build(r) {
    const g = grp(r, .95, 0, 2.15, .2);
    box(g, .75, .55, .55, '#a9bcc4', 0, 0, 0, .08);
    for (const x of [-.3, .3]) add(at(new THREE.Mesh(new THREE.TorusGeometry(.26, .1, 10, 24), clay('#e86a42')), x, .95, 0), g);
    cyl(g, .12, .14, .3, '#7c6d66', .5, .15, 0).rotation.z = Math.PI / 2;
  } },
  { id: 'popcorn', label: '팝콘', cat: '영화·애니', build(r) {
    cyl(r, .3, .24, .5, '#e07a52', -.95, 0, 2.0); for (let i = 0; i < 7; i++) sph(r, .12, '#f6ead9', -.95 + Math.cos(i) * .17, .58, 2.0 + Math.sin(i) * .17);
  } },
  /* 반려동물 (원본 렌더엔 없어서 새로: 앞 왼쪽 빈자리에 방석 + 밥그릇) */
  { id: 'petBed', label: '반려동물 방석', cat: '반려동물', tag: [-1.35, 1.0, 3.25], build(r) {
    const g = grp(r, -1.35, 0, 3.25, .15);
    cyl(g, .62, .66, .22, '#e9a07a', 0, 0, 0, 40); cyl(g, .48, .48, .1, '#f6e6d4', 0, .2, 0, 40);
    cyl(g, .2, .16, .14, '#b9d3df', .8, 0, .25, 24); sph(g, .1, '#c98559', .8, .16, .25, 1, .4, 1);
  } },
];

function furnishRoom(root, opts = {}) {
  const on = new Set(['기본', ...(opts.interests || FURNITURE_CATS)]);
  const placed = [];
  for (const f of FURNITURE) {
    if (!on.has(f.cat)) continue;
    const g = new THREE.Group(); g.name = f.id; g.userData.furniture = f; root.add(g); f.build(g); placed.push(g);
  }
  return placed;
}
/* ---------- 가구 카탈로그 끝 ---------- */
