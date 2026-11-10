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
