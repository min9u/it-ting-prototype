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
