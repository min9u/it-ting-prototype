// @ts-nocheck — 자동 생성 파일. 직접 고치지 말 것.
// 원본: explore/3d/lib/mole-felt-cfg.js, mole.js, mole-motion.js → node explore/3d/lib/build-app.js 로 다시 만듦
import * as THREE from 'three'
import { add, clay } from './clay'

const SPH = new THREE.SphereGeometry(1, 32, 20)

/* ---------- 두더지 펠트 재료 ---------- */
// 섬유 노멀맵: 짧은 털 가닥을 높이맵으로 그린 뒤 기울기로 노멀을 만듦
function feltNormalTex(size = 512, strands = 9000, rep = [6, 3]) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, size, size);
  g.lineCap = 'round';
  for (let i = 0; i < strands; i++) {
    const x = Math.random() * size, y = Math.random() * size, a = Math.random() * Math.PI * 2, l = 2 + Math.random() * 6, v = Math.random() < .5 ? 175 : 85;
    g.strokeStyle = `rgba(${v},${v},${v},.55)`; g.lineWidth = .6 + Math.random() * .8;
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke(); }
  }
  const src = g.getImageData(0, 0, size, size).data, out = g.createImageData(size, size), h = (x, y) => src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * 2.0, dy = (h(x, y + 1) - h(x, y - 1)) * 2.0, l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    out.data[i] = (-dx / l * .5 + .5) * 255; out.data[i + 1] = (dy / l * .5 + .5) * 255; out.data[i + 2] = (1 / l * .5 + .5) * 255; out.data[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; return t;
}
// 잔털 알파맵: 픽셀마다 무작위 값. 껍질마다 alphaTest를 올려 바깥일수록 털이 드문드문
function fuzzAlphaTex(size = 512, rep = [10, 5]) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), d = g.createImageData(size, size);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.pow(Math.random(), 1.4) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.magFilter = THREE.NearestFilter; return t;
}
const MOLE_FELT = {
  shape: 'taper', // 'taper' = 원본형(위로 좁아짐), 'cyl' = 이전 원통형
  body: '#977f72', nose: '#f39e96', tip: '#e9787c', paw: '#f2aaa4', foot: '#ebd2c9',
  sheen: 1, nScale: .45, shells: 12, fuzz: .014, tipLight: .18,
  cheekY: .655, cheekPhi: .6, cheekR: 32, cheekA: .5,
};
MOLE_FELT.normal = feltNormalTex();
MOLE_FELT.fuzzTex = fuzzAlphaTex();


function makeMole() {
  const H = 1, W = .83;           // 높이 1 기준 비율 (높이:폭 ≈ 1.3:1)
  const R = W / 2;
  const pts = [new THREE.Vector2(0, 0)];
  if (MOLE_FELT.shape === 'taper') {
    // 원본형: 아래(높이 .2)가 가장 넓고 머리까지 꾸준히 좁아짐. 원본 확대 샷에서 잰 폭 비율에 맞춤
    // (높이 .45→.97, .60→.90, .75→.78, .82→.69). 바닥은 둥글게 말림
    const M = .42, n = 2.6, taper = .12;
    pts.push(new THREE.Vector2(M * .8, 0), new THREE.Vector2(M * .93, .02), new THREE.Vector2(M * .98, .06), new THREE.Vector2(M * .997, .12));
    for (let k = 0; k <= 48; k++) {
      const t = Math.sin(k / 48 * Math.PI / 2), y = .2 + .8 * t; // 꼭대기 쪽을 촘촘하게
      pts.push(new THREE.Vector2(Math.max(0.0001, M * (1 - taper * t) * Math.pow(Math.max(0, 1 - Math.pow(t, n)), 1 / n)), y));
    }
  } else {
    // 이전형: 거의 수직 옆면 → 넓은 돔 (원통에 가까움)
    pts.push(new THREE.Vector2(R * .82, 0), new THREE.Vector2(R * .96, .018), new THREE.Vector2(R * 1.03, .055), new THREE.Vector2(R * 1.06, .11));
    for (let i = 1; i <= 10; i++) { const y = .11 + (.6 - .11) * i / 10; pts.push(new THREE.Vector2(R * (1.06 - .1 * Math.pow(i / 10, 1.2)), y)); }
    const capH = H - .6, r0 = R * .96; // 옆면 꼭대기와 같은 반지름 (턱 없이 이어지게)
    for (let i = 1; i <= 24; i++) { const a = i / 24 * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.0001, r0 * Math.pow(Math.cos(a), .7)), .6 + capH * Math.pow(Math.sin(a), 1.1))); }
  }
  const TAPER = MOLE_FELT.shape === 'taper';
  const rAt = y => { for (let i = 1; i < pts.length; i++) if (pts[i].y >= y) { const a = pts[i - 1], b = pts[i]; return a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y || 1); } return 0; };
  const vAt = y => { for (let i = 1; i < pts.length; i++) if (pts[i].y >= y) return (i - 1 + (y - pts[i - 1].y) / (pts[i].y - pts[i - 1].y || 1)) / (pts.length - 1); return 1; };
  const ZS = .84; // 앞뒤로 약간 납작

  /* --- 펠트 재료: 섬유 노멀맵 + 잔털 알파맵 (한 번 만들어 코·손·발도 같이 씀) --- */
  const FELT = MOLE_FELT;

  /* --- 몸 색 텍스처: 회갈색 + 큰 얼룩 + 볼터치 --- */
  const TW = 1024, TH = 512;
  const c = document.createElement('canvas'); c.width = TW; c.height = TH; const g = c.getContext('2d');
  g.fillStyle = FELT.body; g.fillRect(0, 0, TW, TH);
  g.filter = 'blur(10px)';
  for (let i = 0; i < 200; i++) { g.fillStyle = Math.random() < .6 ? 'rgba(178,158,144,.1)' : 'rgba(84,62,52,.05)'; g.beginPath(); g.ellipse(Math.random() * TW, Math.random() * TH, 30 + Math.random() * 80, 20 + Math.random() * 50, Math.random() * 3, 0, 7); g.fill(); }
  g.filter = 'none';
  // 아래쪽은 살짝 어둡게, 머리 쪽은 살짝 밝게 (캔버스 아래 = 몸 아래)
  const vg = g.createLinearGradient(0, 0, 0, TH); vg.addColorStop(0, 'rgba(255,240,228,.08)'); vg.addColorStop(.7, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,25,18,.06)');
  g.fillStyle = vg; g.fillRect(0, 0, TW, TH);
  // 볼터치 (u: 0.5가 정면, v: 단면 위치)
  for (const s of [-1, 1]) {
    const u = .5 + s * (TAPER ? .73 : FELT.cheekPhi) / (Math.PI * 2), v = vAt(FELT.cheekY);
    const cx = u * TW, cy = TH - v * TH, r = FELT.cheekR;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, `rgba(255,172,168,${FELT.cheekA})`); gr.addColorStop(.55, `rgba(255,175,170,${FELT.cheekA * .45})`); gr.addColorStop(1, 'rgba(255,175,170,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;

  const feltMat = (o) => new THREE.MeshPhysicalMaterial({
    roughness: 1, metalness: 0,
    normalMap: FELT.normal, normalScale: new THREE.Vector2(FELT.nScale, FELT.nScale),
    sheen: FELT.sheen, sheenRoughness: .5, sheenColor: new THREE.Color(o.sheenColor || '#f3e4da'),
    ...o.base,
  });

  // mole(발 위치 기준) ┬ rig: 몸통·얼굴·손 (뒤뚱거림·숨쉬기·점프)
  //                   └ 발 두 개 (걸을 때 번갈아 들림)
  const mole = new THREE.Group(), rig = new THREE.Group(); mole.add(rig);
  const parts = { rig, eyes: [], highs: [], paws: [], feet: [] };
  const bodyGeo = new THREE.LatheGeometry(pts, 128, -Math.PI, Math.PI * 2);
  const bodyMat = feltMat({ base: { map: tex } });
  // 정수리(회전체 극점)에서는 노멀맵 방향 계산이 불안정해 밝은 줄이 생김 → 위로 갈수록 노멀맵 세기를 0으로
  bodyMat.onBeforeCompile = sh => {
    sh.vertexShader = 'varying float vPole;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vPole = 1.0 - smoothstep(0.84, 0.97, position.y);');
    sh.fragmentShader = 'varying float vPole;\n' + sh.fragmentShader.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * vPole;');
  };
  const body = add(new THREE.Mesh(bodyGeo, bodyMat), rig);
  body.scale.z = ZS;

  // 보송한 잔털 막: 몸을 법선 방향으로 조금씩 부풀린 껍질을 여러 겹, 바깥으로 갈수록 털이 드문드문
  if (FELT.shells) {
    const pos = bodyGeo.attributes.position, nrm = bodyGeo.attributes.normal;
    for (let k = 1; k <= FELT.shells; k++) {
      const t = k / FELT.shells, geo = bodyGeo.clone(), p = geo.attributes.position;
      const col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const y = pos.getY(i); const top = 1 - THREE.MathUtils.smoothstep(y, .86, .99); // 정수리(극점)는 잔털이 한 점에 몰려 밝은 줄이 생겨서 줄임
        const fade = Math.min(1, y / .04) * (.35 + .65 * top); // 바닥 쪽은 거의 안 부풂
        const lt = 1 + t * FELT.tipLight * top; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = lt;
        p.setXYZ(i, pos.getX(i) + nrm.getX(i) * FELT.fuzz * t * fade, y + nrm.getY(i) * FELT.fuzz * t * fade, pos.getZ(i) + nrm.getZ(i) * FELT.fuzz * t * fade);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const m = new THREE.MeshStandardMaterial({ map: tex, alphaMap: FELT.fuzzTex, alphaTest: .25 + t * .6, roughness: 1, vertexColors: true });
      const sh = new THREE.Mesh(geo, m); sh.scale.z = ZS; sh.receiveShadow = true; rig.add(sh);
    }
  }
  // 몸 표면 위의 점 (angle 0 = 정면)
  const surf = (y, ang, out = 0) => { const r = rAt(y) + out; return new THREE.Vector3(r * Math.sin(ang), y, r * Math.cos(ang) * ZS); };

  // 눈: 까맣고 반짝이는 작은 타원 + 흰 하이라이트
  const eyeM = new THREE.MeshPhysicalMaterial({ color: '#1a1210', roughness: .18, clearcoat: 1, clearcoatRoughness: .1 });
  const hiM = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  // 두 눈 모두 정면을 보게(곡면을 따라 바깥으로 돌리면 시선이 갈라져 사시처럼 보임).
  // 하이라이트는 두 눈 모두 같은 자리(오른쪽 위)에 둬서 같은 곳을 보는 것처럼.
  for (const s of [-1, 1]) {
    const ang = s * (TAPER ? .55 : .44), p = surf(.765, ang, -.014);
    const e = add(new THREE.Mesh(SPH, eyeM), rig); e.position.copy(p); e.scale.set(.036, .052, .036); e.rotation.y = ang * .2;
    const h = new THREE.Mesh(SPH, hiM); h.position.set(p.x + .011, p.y + .017, p.z + .03); h.scale.set(.011, .013, .006); rig.add(h);
    parts.eyes.push(e); parts.highs.push(h);
  }
  // 코: 넓적한 연분홍 펠트 주둥이 + 튀어나온 코끝
  const nose = add(new THREE.Mesh(SPH, feltMat({ base: { color: FELT.nose }, sheenColor: '#fff0ec' })), rig);
  nose.position.copy(surf(.645, 0, -.03)); nose.position.z += .045; nose.scale.set(.15, .092, .1);
  const nos = add(new THREE.Mesh(SPH, feltMat({ base: { color: FELT.tip }, sheenColor: '#ffd6d6' })), rig);
  nos.position.copy(nose.position).add(new THREE.Vector3(0, -.022, .092)); nos.scale.set(.048, .045, .04);
  // 손: 양옆 분홍 앞발 + 흰 발톱
  const pawM = feltMat({ base: { color: FELT.paw }, sheenColor: '#fff0ec' });
  for (const s of [-1, 1]) {
    const p = surf(.38, s * 1.35, -.02);
    const pg = new THREE.Group(); pg.position.set(p.x, p.y + .05, p.z); rig.add(pg); pg.userData.side = s; parts.paws.push(pg);
    const paw = add(new THREE.Mesh(SPH, pawM), pg); paw.position.set(s * .03, -.05, 0); paw.scale.set(.042, .065, .05); paw.rotation.z = s * .35;
    for (let k = 0; k < 2; k++) { const cl = add(new THREE.Mesh(new THREE.ConeGeometry(.01, .045, 6), clay('#fbf3ea')), pg); cl.position.set(s * .045, -.125, -.005 + k * .022); cl.rotation.set(Math.PI, 0, -s * .3); }
  }
  // 발: 앞쪽 납작한 연분홍 타원
  for (const s of [-1, 1]) { const f = add(new THREE.Mesh(SPH, feltMat({ base: { color: FELT.foot } })), mole); f.userData.side = s; f.userData.home = null; parts.feet.push(f); f.position.set(s * .12, .022, rAt(.03) * ZS * .88); f.scale.set(.074, .03, .062); }
  mole.userData.parts = parts;
  return mole;
}

/* ---------- 두더지 움직임 ---------- */
// createMoleMotion(mole, opts) → { update(dt, t), walkTo(p), drive(x, z), setWander(o) }
//  - drive(x, z): 사용자가 방향키로 조종 (월드 방향, 0,0이면 멈춤). 조종하는 동안·직후엔 혼자 돌아다니지 않음
//  - 대기: 숨쉬기(몸이 살짝 부풀었다 줄어듦), 2.5~4.5초마다 눈 깜빡임(가끔 두 번), 앞발 살랑
//  - 걷기: 목표 쪽으로 몸을 돌린 뒤 뒤뚱뒤뚱(좌우 기울기 + 통통 튀기), 발 번갈아 들기, 앞발 흔들기
//  - 도착: 살짝 눌렸다 펴지기
//  - opts.wander = { center: Vector3, radius, rest: [최소, 최대]초 } 이면 가만히 있다가 근처를 돌아다님
//  - opts.ground(x, z) = 그 자리 땅 높이, opts.clamp(p) = 갈 수 없는 곳이면 고친 점을 돌려줌
//  - prefers-reduced-motion이면 깜빡임만 하고 걸음은 미끄러지듯
function createMoleMotion(mole, opts = {}) {
  const P = mole.userData.parts;
  const ground = opts.ground || (() => 0);
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let wander = opts.wander || null;
  const SPEED = opts.speed || 1.05;   // 초당 몸 높이의 몇 배
  let target = null, phase = 0, walkAmt = 0, settle = 0, restUntil = 0, driveX = 0, driveZ = 0, stuck = 0;
  let nextBlink = 1.2 + Math.random() * 2, blinkT = -1, doubleBlink = false;
  const tmp = new THREE.Vector3();
  P.eyes.forEach(e => e.userData.sy = e.scale.y);
  P.feet.forEach(f => f.userData.home = f.position.clone());

  function pickWander(t) {
    if (!wander) return;
    const a = Math.random() * Math.PI * 2, r = wander.radius * Math.sqrt(Math.random());
    walkTo(tmp.set(wander.center.x + Math.cos(a) * r, 0, wander.center.z + Math.sin(a) * r));
  }
  function walkTo(p) {
    target = p.clone(); target.y = 0;
    if (opts.clamp) target = opts.clamp(target) || target;
  }
  function angleDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

  let started = false;
  function update(dt, t) {
    dt = Math.min(dt, .05);
    if (!started) { started = true; restUntil = t + (opts.startRest || 0); nextBlink = t + 1.2 + Math.random() * 2; }
    const s = mole.scale.x;                       // 몸 높이 = 월드 길이
    const R = P.rig;

    /* 눈 깜빡임 */
    if (blinkT < 0 && t > nextBlink) { blinkT = 0; doubleBlink = Math.random() < .25; }
    let lid = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      const d = .16, k = blinkT / d;
      lid = k < 1 ? Math.sin(k * Math.PI) : 0;
      if (k >= 1) { if (doubleBlink) { doubleBlink = false; blinkT = -0.0001; nextBlink = t + .12; } else { blinkT = -1; nextBlink = t + 2.5 + Math.random() * 2; } }
    }
    P.eyes.forEach(e => e.scale.y = e.userData.sy * (1 - .88 * lid));
    P.highs.forEach(h => h.visible = lid < .45);

    /* 걷기 */
    let moving = false;
    const before = mole.position.clone();
    if (driveX || driveZ) {
      // 방향키 조종: 그 방향으로 몸을 돌리며 걸음
      target = null; restUntil = t + 6;
      const want = Math.atan2(driveX, driveZ), diff = angleDiff(mole.rotation.y, want);
      mole.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), 7 * dt);
      const step = SPEED * 1.25 * s * dt * Math.max(0, Math.cos(diff)) * (.35 + .65 * walkAmt);
      mole.position.x += Math.sin(mole.rotation.y) * step; mole.position.z += Math.cos(mole.rotation.y) * step;
      moving = true;
    } else if (target) {
      const dx = target.x - mole.position.x, dz = target.z - mole.position.z, dist = Math.hypot(dx, dz);
      if (dist < .04 * s) { target = null; settle = 1; restUntil = t + (wander ? wander.rest[0] + Math.random() * (wander.rest[1] - wander.rest[0]) : 0); }
      else {
        const want = Math.atan2(dx, dz), diff = angleDiff(mole.rotation.y, want);
        mole.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), 5 * dt);
        const facing = Math.max(0, Math.cos(diff));            // 몸을 다 돌려야 앞으로 감
        const step = Math.min(dist, SPEED * s * dt * facing * (.35 + .65 * walkAmt));
        mole.position.x += Math.sin(mole.rotation.y) * step;
        mole.position.z += Math.cos(mole.rotation.y) * step;
        moving = true;
      }
    } else if (wander && t > restUntil && !settle) pickWander(t);
    // 갈 수 없는 곳(가구·둔덕·바닥 밖)이면 밀어냄. 목표로 가다 계속 막히면 포기
    if (moving && opts.clamp) {
      const p = opts.clamp(mole.position.clone()); mole.position.x = p.x; mole.position.z = p.z;
      const moved = Math.hypot(mole.position.x - before.x, mole.position.z - before.z);
      stuck = moved < SPEED * s * dt * .15 ? stuck + dt : 0;
      if (stuck > .6 && target) { target = null; settle = .6; restUntil = t + 2; stuck = 0; }
    }
    mole.position.y = ground(mole.position.x, mole.position.z);

    walkAmt += ((moving ? 1 : 0) - walkAmt) * Math.min(1, dt * 8);
    if (moving) phase += dt * (reduce ? 0 : 10.5);
    const w = reduce ? 0 : walkAmt, sw = Math.sin(phase);

    /* 몸통: 숨쉬기 + 뒤뚱 + 통통 + 도착할 때 눌림 */
    settle = Math.max(0, settle - dt * 3.2);
    const breathe = reduce ? 0 : Math.sin(t * 2.2) * .016 * (1 - w);
    const squash = Math.sin(settle * Math.PI) * .07;
    R.scale.set(1 - breathe * .5 + squash * .6, 1 + breathe - squash, 1 - breathe * .5 + squash * .6);
    R.rotation.z = sw * .085 * w;
    R.rotation.x = .07 * w;
    R.position.y = Math.abs(sw) * .03 * w;

    /* 발: 번갈아 들고 앞으로 */
    P.feet.forEach(f => {
      const h = f.userData.home, side = f.userData.side, ph = Math.sin(phase + (side > 0 ? 0 : Math.PI));
      f.position.set(h.x, h.y + Math.max(0, ph) * .045 * w, h.z + ph * .035 * w);
    });
    /* 앞발: 걸을 땐 흔들고, 쉴 땐 살랑 */
    P.paws.forEach(g => {
      const side = g.userData.side;
      g.rotation.x = Math.sin(phase + (side > 0 ? Math.PI : 0)) * .55 * w + (reduce ? 0 : Math.sin(t * 1.4 + side) * .06 * (1 - w));
      g.rotation.z = -side * .12 * w;
    });
  }
  function drive(x, z) { const l = Math.hypot(x, z); driveX = l ? x / l : 0; driveZ = l ? z / l : 0; }
  return { update, walkTo, drive, setWander(o) { wander = o; }, get walking() { return !!target || !!(driveX || driveZ); } };
}
// 방향키·WASD로 두더지 조종 (opts.arrows === false면 WASD만: 방향키를 다른 데 쓰는 화면용). 화면 위쪽 = 안쪽(-Z). 입력창에 글을 쓰는 중이면 무시. 돌려주는 함수로 해제
function bindMoleKeys(motion, target = window, opts = {}) {
  const down = new Set();
  const KEYS = { KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
  if (opts.arrows !== false) Object.assign(KEYS, { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] });
  const typing = e => { const el = e.target; return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)); };
  const apply = () => { let x = 0, z = 0; for (const k of down) { x += KEYS[k][0]; z += KEYS[k][1]; } motion.drive(x, z); };
  const kd = e => { if (!KEYS[e.code] || typing(e) || e.altKey || e.ctrlKey || e.metaKey) return; e.preventDefault(); down.add(e.code); apply(); };
  const ku = e => { if (!KEYS[e.code]) return; down.delete(e.code); apply(); };
  const blur = () => { down.clear(); apply(); };
  target.addEventListener('keydown', kd); target.addEventListener('keyup', ku); window.addEventListener('blur', blur);
  return () => { target.removeEventListener('keydown', kd); target.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); motion.drive(0, 0); };
}
/* ---------- 두더지 움직임 끝 ---------- */

/**
 * 계약
 *   makeMole(): THREE.Group  높이 1, 발이 원점, +Z를 바라봄. 부위는 mole.userData.parts
 *   createMoleMotion(mole, { ground, wander, clamp, speed, startRest }) → { update(dt, t), walkTo(p), setWander(o) }
 */
export { MOLE_FELT, makeMole, createMoleMotion, bindMoleKeys }
