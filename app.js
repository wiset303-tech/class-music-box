(() => {
'use strict';

/* ---------- 상태 (사진은 이 브라우저의 localStorage에만 저장됩니다) ---------- */
const STORE = 'classMusicBox.v2';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function load() { try { return JSON.parse(localStorage.getItem(STORE)); } catch (e) { return null; } }
let state = Object.assign({ title: '우리 반 오르골', name: '', img: null, theme: 'classic', glass: true, song: 'canon', plate: '우리 반', crop: { z: 1, x: 0.5, y: 0.5 } }, load() || {});
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); }
  catch (e) { toast('저장 공간이 부족해요. 더 작은 사진을 써 주세요.'); }
}
let toastTimer;
function toast(msg, label, fn) {
  const t = $('toast'); t.textContent = msg; t.classList.toggle('act', !!label);
  if (label) { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { fn(); t.classList.remove('show'); }; t.appendChild(b); }
  t.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), label ? 6000 : 2600);
}

/* ---------- 시안(테마) ---------- */
const THEMES = {
  classic: { bg: 0x1b1220, body: 0x7a4a2b, velvet: 0x3b1d2e, gold: 0xe8c27a, frame: 0x8a5a36, glow: 0xffc26b, dust: 0xfff2c4, hl: 0xffd27a, ui: 'dark', stars: false },
  pastel:  { bg: 0xffeef3, body: 0xf6bfcd, velvet: 0xfff8fb, gold: 0xe7a39a, frame: 0xf3a9bd, glow: 0xffd9e6, dust: 0xff9fbd, hl: 0xff6f9c, ui: 'light', stars: false },
  starry:  { bg: 0x0a1630, body: 0x23407a, velvet: 0x0d1630, gold: 0xffe28a, frame: 0x3a5fa8, glow: 0x9fc0ff, dust: 0xcfe2ff, hl: 0xfff0a8, ui: 'dark', stars: true },
};
if (!THEMES[state.theme]) state.theme = 'classic';
const urlTheme = new URLSearchParams(location.search).get('theme');
if (THEMES[urlTheme]) state.theme = urlTheme;

/* ---------- Three.js 장면 ---------- */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1220);
scene.fog = new THREE.Fog(0x1b1220, 26, 70);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xfff0dd, 0x2a1b3a, 0.55));
const sun = new THREE.DirectionalLight(0xffe2b8, 0.65); sun.position.set(6, 12, 8); scene.add(sun);
const glow = new THREE.PointLight(0xffc26b, 0.5, 22); glow.position.set(0, 3.6, 0); scene.add(glow);

const matWood = new THREE.MeshStandardMaterial({ color: 0x7a4a2b, roughness: 0.55 });
const matDark = new THREE.MeshStandardMaterial({ color: 0x3b1d2e, roughness: 0.9 });
const matGold = new THREE.MeshStandardMaterial({ color: 0xe8c27a, metalness: 0.85, roughness: 0.3 });
const matFrame = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.5 });
const matRim = new THREE.MeshStandardMaterial({ color: 0xe8c27a, metalness: 0.85, roughness: 0.3 });
const hlColor = new THREE.Color(0xffd27a);
const matGlass = new THREE.MeshPhongMaterial({ color: 0xdff1ff, specular: 0xffffff, shininess: 160, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
const noRay = () => {};
let starField = null, root = null, spin = null, key = null, photoMat = null, dustMat = null, shadowMesh = null;
let plateMat = null;
let halo = null, haloMat = null, seatMesh = null;
let pf = null, domeYaw = null, hinge = null, dustPts = null, dustRise = null;

function applyTheme(name) {
  state.theme = name; const t = THEMES[name];
  matWood.color.setHex(t.body); matDark.color.setHex(t.velvet); matGold.color.setHex(t.gold); matGold.metalness = t.ui === 'light' ? 0.15 : 0.85; matFrame.color.setHex(t.frame);
  matRim.color.setHex(t.gold); if (plateMat) { refreshPlate(); if (!photoImg) refreshPhoto(); } matRim.metalness = matGold.metalness; hlColor.setHex(t.hl); if (haloMat) haloMat.color.setHex(t.hl);
  scene.background.setHex(t.bg); scene.fog.color.setHex(t.bg); glow.color.setHex(t.glow);
  document.body.className = t.ui; document.body.style.background = '#' + t.bg.toString(16).padStart(6, '0');
  if (dustMat) dustMat.color.setHex(t.dust);
  if (!starField) {
    const pos = []; for (let i = 0; i < 260; i++) { const a = Math.random() * 6.28, r = 22 + Math.random() * 20; pos.push(Math.cos(a) * r, 2 + Math.random() * 24, Math.sin(a) * r); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    starField = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, fog: false })); starField.raycast = noRay; scene.add(starField);
  }
  starField.visible = t.stars;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.theme === name));
  if (shadowMesh) refreshShadow();
  save();
}
function refreshShadow() {
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const g = sc.getContext('2d'), rg = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  rg.addColorStop(0, THEMES[state.theme].ui === 'light' ? 'rgba(120,60,80,.22)' : 'rgba(0,0,0,.55)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  if (shadowMesh.material.map) shadowMesh.material.map.dispose();
  shadowMesh.material.map = new THREE.CanvasTexture(sc); shadowMesh.material.needsUpdate = true;
}

const BR = 4.2;          // 본체 반지름
const DR = BR - 0.12;    // 돔 반지름
const PH_Y = 0.2 + 1.65; // 회전판 기준 사진 중심 높이
let photoImg = null;

function build() {
  root = new THREE.Group(); scene.add(root);
  shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(BR * 3.4, BR * 3.4), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
  shadowMesh.rotation.x = -Math.PI / 2; shadowMesh.position.y = 0.01; shadowMesh.raycast = noRay; root.add(shadowMesh); refreshShadow();

  const body = new THREE.Mesh(new THREE.CylinderGeometry(BR, BR + 0.28, 1.4, 64), matWood); body.position.y = 0.7; root.add(body);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(BR, 0.07, 12, 96), matGold); rim.rotation.x = Math.PI / 2; rim.position.y = 1.4; root.add(rim);
  const foot = new THREE.Mesh(new THREE.TorusGeometry(BR + 0.28, 0.06, 12, 96), matGold); foot.rotation.x = Math.PI / 2; foot.position.y = 0.06; root.add(foot);
  const velvet = new THREE.Mesh(new THREE.CylinderGeometry(BR - 0.08, BR - 0.08, 0.06, 64), matDark); velvet.position.y = 1.4; root.add(velvet);

  // 정면 명판 (글자 수정 가능)
  const PL = 0.9;
  plateMat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.25 });
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(BR + 0.1, BR + 0.22, 0.62, 48, 1, true, -PL / 2, PL), plateMat); plate.position.y = 0.7; root.add(plate);
  refreshPlate();

  key = new THREE.Group(); key.position.set(BR + 0.28, 0.7, 0);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.55, 12), matGold); stem.rotation.z = Math.PI / 2; stem.position.x = 0.22; key.add(stem);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.8, 0.22), matGold); wing.position.x = 0.55; key.add(wing);
  root.add(key);

  // 회전판 + 양면 사진 (크게)
  spin = new THREE.Group(); spin.position.y = 1.46; root.add(spin);
  spin.add(new THREE.Mesh(new THREE.CylinderGeometry(BR - 0.5, BR - 0.5, 0.1, 64), matGold));
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.18, 40), matGold); base.position.y = 0.13; spin.add(base);

  pf = new THREE.Group(); pf.position.y = PH_Y; spin.add(pf);
  const border = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.3, 0.14), matFrame); border.userData.part = 'photo'; pf.add(border);
  photoMat = new THREE.MeshBasicMaterial({ map: makeTexture(), toneMapped: false });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.1), photoMat); front.position.z = 0.075; front.userData.part = 'photo'; pf.add(front);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.1), photoMat); back.position.z = -0.075; back.rotation.y = Math.PI; back.userData.part = 'photo'; pf.add(back);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), matGold); cap.position.y = 1.75; cap.userData.part = 'photo'; pf.add(cap);

  // 원형 유리 돔: 뒤쪽 가장자리를 경첩으로 뚜껑처럼 열립니다
  domeYaw = new THREE.Group(); domeYaw.position.y = 1.43; domeYaw.visible = state.glass; root.add(domeYaw);
  const seat = new THREE.Mesh(new THREE.TorusGeometry(DR, 0.1, 16, 96), matRim); seat.rotation.x = Math.PI / 2; seat.userData.part = 'dome'; domeYaw.add(seat); seatMesh = seat;
  haloMat = new THREE.MeshBasicMaterial({ color: THEMES[state.theme].hl, transparent: true, opacity: 0, depthWrite: false });
  halo = new THREE.Mesh(new THREE.TorusGeometry(DR, 0.3, 16, 96), haloMat); halo.rotation.x = Math.PI / 2; halo.raycast = noRay; domeYaw.add(halo);
  hinge = new THREE.Group(); hinge.position.z = -DR; domeYaw.add(hinge);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(DR, 64, 40, 0, Math.PI * 2, 0, Math.PI / 2), matGlass);
  shell.scale.y = 1.1; shell.position.z = DR; shell.renderOrder = 10; shell.userData.part = 'dome'; hinge.add(shell);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), matRim); knob.userData.part = 'dome'; knob.position.set(0, DR * 1.1 + 0.1, DR); hinge.add(knob);
  const hingePin = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 12), matRim); hingePin.userData.part = 'dome'; hingePin.rotation.z = Math.PI / 2; domeYaw.add(hingePin); hingePin.position.z = -DR;

  // 돔 안에서 떠다니는 가루
  const dpos = []; dustRise = [];
  for (let i = 0; i < 120; i++) {
    const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * (DR - 0.4), y = 0.2 + Math.random() * DR * 1.0;
    if (Math.hypot(rr, y / 1.1) > DR - 0.3) { i--; continue; }
    dpos.push(Math.cos(a) * rr, y, Math.sin(a) * rr); dustRise.push(0.05 + Math.random() * 0.12);
  }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dpos, 3));
  dustMat = new THREE.PointsMaterial({ color: THEMES[state.theme].dust, size: 0.1, transparent: true, opacity: 0.85, depthWrite: false });
  dustPts = new THREE.Points(dg, dustMat); dustPts.raycast = noRay; dustPts.position.y = 1.43; root.add(dustPts);
}

/* 명판 텍스처: 테마색 바탕 + 금색 글자 (칸에 맞게 글자 크기 자동 조절) */
function refreshPlate() {
  const t = THEMES[state.theme], hex = n => '#' + n.toString(16).padStart(6, '0');
  const W = 1300, H = 200, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = hex(t.velvet); g.fillRect(0, 0, W, H);
  g.strokeStyle = hex(t.gold); g.lineWidth = 6; g.strokeRect(14, 14, W - 28, H - 28);
  const text = state.plate || state.title || '우리 반';
  let size = 110; const face = '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
  g.font = `bold ${size}px ${face}`;
  const w = g.measureText(text).width; if (w > W - 120) { size = Math.floor(size * (W - 120) / w); g.font = `bold ${size}px ${face}`; }
  g.fillStyle = hex(t.gold); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, W / 2, H / 2 + 4);
  const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
  plateMat.map && plateMat.map.dispose(); plateMat.map = tex; plateMat.needsUpdate = true;
}
/* 사진이 없을 때 보이는 기본 그림: 시안마다 어울리게 */
function drawPlaceholder(g, W, H) {
  const th = state.theme; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pal = { classic: ['#f6e2bd', '#c9975e', '#5a3420'], pastel: ['#ffe3ee', '#d9c8ff', '#b34d74'], starry: ['#16306a', '#0a1630', '#ffe28a'] }[th];
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = pal[2]; g.globalAlpha = 0.28;
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W, y = rnd() * H, r = 8 + rnd() * 18;
    if (th === 'classic') { g.font = `${r * 3}px serif`; g.textAlign = 'center'; g.fillText(['♪', '♫'][i % 2], x, y); }
    else if (th === 'pastel') { g.font = `${r * 3}px sans-serif`; g.textAlign = 'center'; g.fillText(['♥', '✿'][i % 2], x, y); }
    else { g.globalAlpha = 0.35 + rnd() * 0.5; g.beginPath(); g.arc(x, y, r / 4, 0, 7); g.fill(); }
  }
  g.globalAlpha = th === 'starry' ? 0.9 : 0.4; g.fillStyle = pal[2];
  if (th === 'starry') { g.beginPath(); g.arc(W * 0.78, H * 0.17, 46, 0, 7); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(W * 0.78 + 20, H * 0.17 - 10, 42, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; g.fillStyle = pal[2]; g.globalAlpha = 0.5; }
  g.beginPath(); g.arc(W / 2, H * 0.4, W * 0.17, 0, 7); g.fill();            // 사람 모양 자리표시
  g.beginPath(); g.ellipse(W / 2, H * 0.98, W * 0.34, H * 0.34, 0, Math.PI, 0); g.fill();
  g.globalAlpha = 1; g.fillStyle = th === 'starry' ? '#fff' : pal[2]; g.textAlign = 'center';
  g.font = 'bold 44px "Apple SD Gothic Neo","Malgun Gothic",sans-serif'; g.fillText('우리 반 친구 사진', W / 2, H * 0.07 + 20);
  g.font = '34px "Apple SD Gothic Neo","Malgun Gothic",sans-serif'; g.fillText('마우스를 올려 사진을 넣어요', W / 2, H * 0.07 + 70);
}
/* 사진을 (dw x dh) 칸에 가득 채워 그립니다. crop = 확대(z)와 중심 위치(x, y: 0~1) */
function drawCover(g, img, dw, dh, crop) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const sc = Math.max(dw / iw, dh / ih) * crop.z, sw = dw / sc, sh = dh / sc;
  const sx = clamp(crop.x * iw - sw / 2, 0, iw - sw), sy = clamp(crop.y * ih - sh / 2, 0, ih - sh);
  g.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
}
/* 사진 텍스처: 중앙 크롭 + 이름표 (앞뒤 모두 동일) */
function makeTexture() {
  const W = 720, H = 930, NAME_H = 118, ph = H - NAME_H;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff6e6'; g.fillRect(0, 0, W, H);
  if (photoImg && photoImg.naturalWidth) {
    drawCover(g, photoImg, W, ph, state.crop);
  } else {
    drawPlaceholder(g, W, ph);
  }
  g.fillStyle = '#3b1d2e'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 60px "Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
  g.fillText(state.name || state.title || '우리 반', W / 2, H - NAME_H / 2);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
  return t;
}
function refreshPhoto() { if (!photoMat) return; photoMat.map && photoMat.map.dispose(); photoMat.map = makeTexture(); photoMat.needsUpdate = true; updateToolsLabels(); }

/* ---------- 카메라 (드래그 회전 · 휠/핀치 확대) + 열기 연출 ---------- */
const HOME = { dist: BR * 3.4 + 3, el: 0.3, ty: 2.2 };
const cam = { az: 0.5, el: HOME.el, dist: HOME.dist, minD: 3.5, maxD: BR * 6 + 12, target: new THREE.Vector3(0, HOME.ty, 0) };
let goal = null, camLock = 0;
function updateCamera() {
  const { az, el, dist, target } = cam;
  camera.position.set(target.x + dist * Math.sin(az) * Math.cos(el), target.y + dist * Math.sin(el), target.z + dist * Math.cos(az) * Math.cos(el));
  camera.lookAt(target);
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 60 : 42; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

const pointers = new Map(); let moved = 0, pinchD = 0;
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  moved = 0; canvas.classList.add('dragging');
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); }
});
canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 1) { moved += Math.abs(dx) + Math.abs(dy); camLock = 0; cam.az -= dx * 0.006; cam.el = clamp(cam.el + dy * 0.005, 0.03, 1.3); }
  else if (pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); camLock = 0; cam.dist = clamp(cam.dist * pinchD / d, cam.minD, cam.maxD); pinchD = d; moved = 99; }
});
canvas.addEventListener('pointerup', e => {
  const wasClick = pointers.size === 1 && moved < 6;
  pointers.delete(e.pointerId); canvas.classList.remove('dragging');
  if (wasClick) clickScene(e.clientX, e.clientY, e.pointerType);
});
canvas.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); canvas.classList.remove('dragging'); });
canvas.addEventListener('wheel', e => { e.preventDefault(); camLock = 0; cam.dist = clamp(cam.dist * (1 + e.deltaY * 0.001), cam.minD, cam.maxD); }, { passive: false });

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const isTouch = matchMedia('(hover: none)').matches;
// 마우스가 가리키는 곳: 'photo'(사진) > 'dome'(유리 돔) > 'box'(본체) > null
function classify(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(root.children, true);
  if (!hits.length) return null;
  if (hits.some(h => h.object.userData.part === 'photo')) return 'photo';
  if (hits.some(h => h.object.userData.part === 'dome')) return 'dome';
  return 'box';
}
function clickScene(x, y, type) {
  if (editorOpen) return;
  const k = classify(x, y);
  if (type !== 'mouse' && k === 'photo') { showTools(5000); return; }   // 터치에는 호버가 없어서 탭하면 편집 메뉴
  if (isOpen) { if (k !== 'photo') setOpen(false); return; }            // 열려 있을 땐 바깥을 눌러야 닫힘
  if (k) setOpen(true);
}

/* 호버: 돔 테두리 강조 + 사진 위 편집 메뉴 */
let hover = null, hoverDome = 0, hoverPhoto = 0, toolsTimer = 0, toolsOver = false;
const tools = $('photoTools'), tip = $('tip');
function showTools(ms) { clearTimeout(toolsTimer); tools.classList.add('show'); if (ms) toolsTimer = setTimeout(hideTools, ms); }
function hideTools() { tools.classList.remove('show'); }
function scheduleHideTools() { clearTimeout(toolsTimer); toolsTimer = setTimeout(() => { if (!toolsOver) hideTools(); }, 600); }
tools.addEventListener('pointerenter', () => { toolsOver = true; clearTimeout(toolsTimer); });
tools.addEventListener('pointerleave', () => { toolsOver = false; scheduleHideTools(); });
function setHover(k, e) {
  hover = k; canvas.style.cursor = k && !editorOpen ? 'pointer' : '';
  let msg = '';
  if (k && !editorOpen) msg = isOpen ? (k === 'photo' ? '' : '눌러서 닫기') : (k === 'photo' ? '눌러서 사진 크게 보기' : k === 'dome' ? '눌러서 유리 돔 열기' : '눌러서 돔 열기');
  if (msg && e) { tip.textContent = msg; tip.hidden = false; tip.style.left = e.clientX + 16 + 'px'; tip.style.top = e.clientY + 18 + 'px'; } else tip.hidden = true;
  if (k === 'photo' && !editorOpen) showTools(); else scheduleHideTools();
}
canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || pointers.size || editorOpen) return; setHover(classify(e.clientX, e.clientY), e); });
canvas.addEventListener('pointerleave', () => setHover(null));
const tv = new THREE.Vector3();
function placeTools() {                                     // 메뉴를 사진 아래쪽에 붙입니다
  if (!tools.classList.contains('show')) return;
  tv.set(0, spin.position.y + pf.position.y - 1.05 * pf.scale.x, 0).project(camera);
  const x = clamp((tv.x * 0.5 + 0.5) * innerWidth, 170, innerWidth - 170), y = clamp((-tv.y * 0.5 + 0.5) * innerHeight, 150, innerHeight - 190);
  tools.style.left = x + 'px'; tools.style.top = y + 'px';
}
function updateToolsLabels() {
  const has = !!photoImg;
  $('tZoom').textContent = isOpen ? '↩ 작게 보기' : '🔍 크게 보기';
  $('tPhoto').textContent = has ? '📷 바꾸기' : '📷 사진 넣기';
  $('tEdit').disabled = !has; $('tRemove').disabled = !has;
}
function updateHint() {
  $('hint').textContent = isOpen ? '사진을 크게 보는 중이에요 · ＋ － 로 더 키우고, 바깥을 누르거나 닫기를 누르면 돌아가요'
    : isTouch ? '오르골을 누르면 돔이 열리고 사진이 커져요 · 사진을 탭하면 편집 메뉴가 나와요'
    : '오르골을 누르면 유리 돔이 열리고 사진이 커져요 · 사진에 마우스를 올리면 편집 메뉴가 나와요';
}

/* 열기: 유리 돔이 뒤로 젖혀지고, 카메라가 사진 앞으로 다가갑니다 */
let isOpen = false, openAmt = 0, startedByOpen = false;
function setOpen(v) {
  if (v === isOpen) return; isOpen = v;
  if (v) {
    if (openAmt < 0.02) domeYaw.rotation.y = cam.az;     // 카메라 반대쪽에 경첩
    HOME.dist = cam.dist; HOME.el = cam.el; HOME.ty = cam.target.y;
    goal = { dist: camera.aspect < 0.8 ? 11 : 8.8, el: 0.1, ty: 3.1 };
    if (!playing) { startedByOpen = true; start(); }
  } else {
    goal = { dist: HOME.dist, el: HOME.el, ty: HOME.ty };
    if (startedByOpen) { stop(); startedByOpen = false; }
  }
  camLock = 1.8; $('zoomBar').hidden = !v; updateHint(); updateToolsLabels();
}
$('closeBtn').onclick = () => setOpen(false);
$('zIn').onclick = () => { camLock = 0; cam.dist = clamp(cam.dist * 0.8, cam.minD, cam.maxD); };
$('zOut').onclick = () => { camLock = 0; cam.dist = clamp(cam.dist * 1.25, cam.minD, cam.maxD); };
addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('textPanel').hidden) $('textPanel').hidden = true; else editorOpen ? closeEditor(false) : setOpen(false); } });

/* ---------- 사진 넣기 / UI ---------- */
// 사진은 가로세로 최대 1000px로 줄여서 저장 (용량 절약)
function setPhoto(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file), im = new Image();
  im.onload = () => {
    const s = Math.min(1, 1000 / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
    state.img = c.toDataURL('image/jpeg', 0.86);
    const stored = new Image(); stored.onload = () => { photoImg = stored; state.crop = { z: 1, x: 0.5, y: 0.5 }; refreshPhoto(); save(); toast('사진을 넣었어요'); }; stored.src = state.img;
  };
  im.onerror = () => { URL.revokeObjectURL(url); toast('이미지를 열 수 없어요'); };
  im.src = url;
}
$('btnPhoto').onclick = () => $('fileOne').click();
$('fileOne').addEventListener('change', e => { setPhoto(e.target.files[0]); e.target.value = ''; });
function removePhoto() {
  if (!photoImg) return;
  const prev = { img: state.img, crop: state.crop, el: photoImg };
  state.img = null; photoImg = null; state.crop = { z: 1, x: 0.5, y: 0.5 }; refreshPhoto(); save();
  toast('사진을 뺐어요', '되돌리기', () => { state.img = prev.img; state.crop = prev.crop; photoImg = prev.el; refreshPhoto(); save(); });
}
$('btnClear').onclick = removePhoto;
$('tZoom').onclick = () => setOpen(!isOpen);
$('tPhoto').onclick = () => $('fileOne').click();
$('tEdit').onclick = () => openEditor();
$('tRemove').onclick = removePhoto;

/* 사진 편집: 끌어서 위치, 슬라이더/휠로 확대 */
let editorOpen = false, edCrop = null, edDrag = null;
const EW = 300, EH = 338, edC = $('edCanvas'), edG = edC.getContext('2d');
function clampCrop(c) {
  const iw = photoImg.naturalWidth, ih = photoImg.naturalHeight, sc = Math.max(EW / iw, EH / ih) * c.z;
  const hw = EW / sc / 2 / iw, hh = EH / sc / 2 / ih; c.x = clamp(c.x, hw, 1 - hw); c.y = clamp(c.y, hh, 1 - hh);
}
function drawEditor() { edG.fillStyle = '#000'; edG.fillRect(0, 0, EW, EH); if (photoImg) drawCover(edG, photoImg, EW, EH, edCrop); }
function openEditor() {
  if (!photoImg) { toast('먼저 사진을 넣어 주세요'); return; }
  edCrop = { ...state.crop }; clampCrop(edCrop); $('edZoom').value = edCrop.z; drawEditor();
  $('editor').hidden = false; editorOpen = true; hideTools(); tip.hidden = true;
}
function closeEditor(ok) {
  if (ok) { state.crop = { ...edCrop }; refreshPhoto(); save(); }
  $('editor').hidden = true; editorOpen = false;
}
edC.addEventListener('pointerdown', e => { edC.setPointerCapture(e.pointerId); edDrag = { x: e.clientX, y: e.clientY }; });
edC.addEventListener('pointermove', e => {
  if (!edDrag || !photoImg) return;
  const iw = photoImg.naturalWidth, ih = photoImg.naturalHeight, sc = Math.max(EW / iw, EH / ih) * edCrop.z, k = EW / edC.getBoundingClientRect().width;
  edCrop.x -= (e.clientX - edDrag.x) * k / (sc * iw); edCrop.y -= (e.clientY - edDrag.y) * k / (sc * ih);
  edDrag = { x: e.clientX, y: e.clientY }; clampCrop(edCrop); drawEditor();
});
edC.addEventListener('pointerup', () => { edDrag = null; });
edC.addEventListener('wheel', e => { e.preventDefault(); edCrop.z = clamp(edCrop.z * (1 - e.deltaY * 0.001), 1, 3); clampCrop(edCrop); $('edZoom').value = edCrop.z; drawEditor(); }, { passive: false });
$('edZoom').addEventListener('input', e => { edCrop.z = +e.target.value; clampCrop(edCrop); drawEditor(); });
$('edReset').onclick = () => { edCrop = { z: 1, x: 0.5, y: 0.5 }; $('edZoom').value = 1; drawEditor(); };
$('edCancel').onclick = () => closeEditor(false);
$('edOk').onclick = () => closeEditor(true);
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => {
  e.preventDefault(); const f = e.dataTransfer.files[0]; if (!f) return;
  f.type.startsWith('audio/') ? setCustomAudio(f) : setPhoto(f);
});

$('plateInput').value = state.plate; $('titleP').value = state.title;
$('plateInput').addEventListener('input', e => { state.plate = e.target.value; refreshPlate(); save(); });
$('titleP').addEventListener('input', e => { $('title').value = e.target.value; $('title').dispatchEvent(new Event('input')); });
$('btnText').onclick = () => { const p = $('textPanel'); p.hidden = !p.hidden; if (!p.hidden) $('titleP').focus(); };
$('textClose').onclick = () => { $('textPanel').hidden = true; };
$('nameInput').value = state.name;
$('nameInput').addEventListener('input', e => { state.name = e.target.value; refreshPhoto(); save(); });
$('title').value = state.title; document.title = state.title || '우리 반 오르골';
$('title').addEventListener('input', e => { state.title = e.target.value; $('titleP').value = e.target.value; document.title = e.target.value || '우리 반 오르골'; if (!state.name) refreshPhoto(); save(); });
$('glass').checked = state.glass;
$('glass').addEventListener('change', e => { state.glass = e.target.checked; domeYaw.visible = state.glass; save(); });
document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => applyTheme(b.dataset.theme)));

/* ---------- 음악 ---------- */
// 내장곡은 모두 저작권이 끝난(퍼블릭 도메인) 곡이며, 악보를 코드로 옮겨 Web Audio로 합성합니다.
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = s => { const m = /^([A-G])(#|b)?(\d)$/.exec(s); return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };

const BASS = ['D3', 'A2', 'B2', 'F#2', 'G2', 'D2', 'G2', 'A2'];            // 그라운드 베이스 (4분음표)
const Q = s => s.split(' ');                                                // "F#5 E5 ..." → 배열
const CYCLES = [
  { q: Q('F#5 E5 D5 C#5 B4 A4 B4 C#5') },                                    // 1. 첫 선율
  { q: Q('D5 C#5 B4 A4 G4 F#4 G4 A4') },                                     // 2. 두 번째 선율
  { e: Q('D5 F#5 C#5 E5 D5 F#5 C#5 F#5 B4 D5 A4 D5 B4 D5 C#5 E5') },         // 3. 분산화음 (8분음표)
  { e: Q('F#5 D5 E5 C#5 D5 B4 C#5 A4 B4 G4 A4 F#4 G4 B4 A4 C#5') },          // 4. 내려오는 8분음표
  { q: Q('F#6 E6 D6 C#6 B5 A5 B5 C#6'), vel: 0.9 },                          // 5. 첫 선율을 한 옥타브 위에서
];
const SONG = [];  // {t: 박, m: midi, d: 길이(박), v: 세기}
CYCLES.forEach((c, k) => {
  const t0 = k * 8;
  BASS.forEach((b, i) => SONG.push({ t: t0 + i, m: midi(b) + 12, d: 1.6, v: 0.5 }));
  (c.q || []).forEach((n, i) => SONG.push({ t: t0 + i, m: midi(n) + 12, d: 1.6, v: c.vel || 0.8 }));
  (c.e || []).forEach((n, i) => SONG.push({ t: t0 + i / 2, m: midi(n) + 12, d: 1.2, v: 0.75 }));
});
// 마지막 D 화음
const END = CYCLES.length * 8;
['D3', 'A4', 'D5', 'F#5'].forEach(n => SONG.push({ t: END, m: midi(n) + 12, d: 4, v: 0.7 }));
SONG.sort((a, b) => a.t - b.t);
const SONG_BEATS = END + 5;


const BASS_UNUSED = 0;
// 간단 작곡 도구: melody [[음, 박]...] (음이 null이면 쉼표), bass [[시작박, 음, 박]...]
function mk(name, bpm, melody, bass, vel = 0.8) {
  const events = []; let t = 0;
  melody.forEach(([n, d]) => { if (n) events.push({ t, m: midi(n) + 12, d: Math.max(d * 1.4, 1.2), v: vel }); t += d; });
  bass.forEach(([bt, n, d]) => events.push({ t: bt, m: midi(n) + 12, d: Math.max(d, 1.5), v: 0.5 }));
  events.sort((a, b) => a.t - b.t);
  return { name, bpm, events, beats: Math.ceil(t) + 2 };
}
const q = s => s.split(' ').map(n => [n, 1]);
const bars = (arr, len) => arr.map((n, i) => [i * len, n, len]);

const SONGS = {
  canon: { name: '파헬벨 캐논', bpm: 84, events: SONG, beats: SONG_BEATS },
  ode: mk('환희의 송가 (베토벤)', 100,
    [...q('E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4'), ['E4', 1.5], ['D4', 0.5], ['D4', 2],
     ...q('E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4'), ['D4', 1.5], ['C4', 0.5], ['C4', 2]],
    bars(['C3', 'G2', 'C3', 'G2', 'C3', 'G2', 'C3', 'C3'], 4)),
  twinkle: mk('반짝반짝 작은 별', 96,
    (() => { const L = (s, last) => [...q(s), [last, 2]]; return [
      ...L('C4 C4 G4 G4 A4 A4', 'G4'), ...L('F4 F4 E4 E4 D4 D4', 'C4'),
      ...L('G4 G4 F4 F4 E4 E4', 'D4'), ...L('G4 G4 F4 F4 E4 E4', 'D4'),
      ...L('C4 C4 G4 G4 A4 A4', 'G4'), ...L('F4 F4 E4 E4 D4 D4', 'C4')]; })(),
    (() => { const l1 = ['C3', 'C3', 'F3', 'C3'], l2 = ['F3', 'C3', 'G2', 'C3'], l3 = ['C3', 'F3', 'C3', 'G2'];
      return [...l1, ...l2, ...l3, ...l3, ...l1, ...l2].map((n, i) => [i * 2, n, 2]); })()),
  elise: (() => {
    const ev = [], add = (t, n, d = 0.5, v = 0.8) => ev.push({ t, m: midi(n) + 12, d: Math.max(d * 1.5, 1.2), v });
    const ph = t0 => { ['E5', 'D#5', 'E5', 'D#5', 'E5', 'B4', 'D5', 'C5'].forEach((n, i) => add(t0 + i * 0.25, n, 0.25)); add(t0 + 2, 'A4', 0.75); };
    ph(0); [[3, 'C4'], [3.25, 'E4'], [3.5, 'A4'], [3.75, 'B4'], [4.5, 'E4'], [4.75, 'G#4'], [5, 'B4'], [5.25, 'C5']].forEach(([t, n]) => add(t, n, 0.5));
    ph(6); [[9, 'C4'], [9.25, 'E4'], [9.5, 'A4'], [9.75, 'B4'], [10.5, 'E4'], [10.75, 'C5'], [11, 'B4']].forEach(([t, n]) => add(t, n, 0.5)); add(11.25, 'A4', 1.5);
    [[2, 'A2'], [4.5, 'E3'], [8, 'A2'], [10.5, 'E3'], [11.25, 'A2']].forEach(([t, n]) => add(t, n, 1.5, 0.5));
    ev.sort((a, b) => a.t - b.t); return { name: '엘리제를 위하여 (베토벤)', bpm: 100, events: ev, beats: 16 };
  })(),
  birthday: mk('생일 축하 노래', 92,
    [['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2],
     ['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2],
     ['G4', 0.75], ['G4', 0.25], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 1],
     ['F5', 0.75], ['F5', 0.25], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 2]],
    [['C3', 0], ['G2', 3], ['G2', 6], ['C3', 9], ['C3', 12], ['G2', 15], ['F3', 18], ['C3', 21]].map(([n, t]) => [t, n, 3])),
};

let ac, master, playing = false, timer, idx = 0, loopStart = 0, bpm = 84, loopBpm = 84, curSong = SONGS.canon;
let custom = null;   // {name, el, node}
const volume = () => $('vol').value / 100 * 0.9;

function initAudio() {
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = volume();
  const comp = ac.createDynamicsCompressor();
  const delay = ac.createDelay(); delay.delayTime.value = 0.27;
  const fb = ac.createGain(); fb.gain.value = 0.28;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3500;
  const wet = ac.createGain(); wet.gain.value = 0.3;
  master.connect(comp); comp.connect(ac.destination);
  master.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(wet); wet.connect(comp);
}
function ding(m, when, vel, dur) {
  const f = 440 * Math.pow(2, (m - 69) / 12);
  const decay = clamp(dur * 0.8 + 0.6 - (m - 70) * 0.012, 0.5, 3);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vel * 0.32, when + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  g.connect(master);
  [[1, 1], [3.01, 0.22], [5.4, 0.06]].forEach(([r, a]) => {   // 오르골 음판의 비정수배 배음
    const o = ac.createOscillator(), og = ac.createGain();
    o.type = 'sine'; o.frequency.value = f * r; og.gain.value = a;
    o.connect(og); og.connect(g); o.start(when); o.stop(when + decay + 0.05);
  });
}
function schedule() {
  const beat = 60 / loopBpm, ev = curSong.events;
  while (true) {
    const e = ev[idx], when = loopStart + e.t * beat;
    if (when > ac.currentTime + 0.25) break;
    if (when >= ac.currentTime - 0.05) ding(e.m, when, e.v, e.d * beat);
    if (++idx >= ev.length) { idx = 0; loopStart += curSong.beats * beat; loopBpm = bpm; }
  }
}
function start() {
  if (!ac) initAudio();
  ac.resume(); master.gain.cancelScheduledValues(ac.currentTime); master.gain.setValueAtTime(volume(), ac.currentTime);
  if (state.song === 'custom' && custom) {
    if (!custom.node) { custom.node = ac.createMediaElementSource(custom.el); custom.node.connect(master); }
    custom.el.playbackRate = bpm / 84; custom.el.play().catch(() => toast('음악 파일을 재생할 수 없어요'));
  } else {
    idx = 0; loopBpm = bpm; loopStart = ac.currentTime + 0.15;
    timer = setInterval(schedule, 60); schedule();
  }
  playing = true; $('play').textContent = '⏸';
}
function stop() {
  clearInterval(timer); playing = false; $('play').textContent = '▶';
  if (custom) custom.el.pause();
  if (ac) master.gain.setTargetAtTime(0, ac.currentTime, 0.06);
}
$('play').onclick = () => { startedByOpen = false; playing ? stop() : start(); };
$('tempo').addEventListener('input', e => { bpm = +e.target.value; if (custom && playing && state.song === 'custom') custom.el.playbackRate = bpm / 84; });
$('vol').addEventListener('input', () => { if (master && playing) master.gain.setTargetAtTime(volume(), ac.currentTime, 0.02); });
addEventListener('keydown', e => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('play').click(); } });

/* 곡 선택 / 내 음악 넣기 */
const sel = $('songSel');
function chooseSong(id, silent) {
  const was = playing;
  if (was) stop();
  state.song = id; save();
  if (id !== 'custom') { curSong = SONGS[id]; bpm = curSong.bpm; } else bpm = 84;
  $('tempo').value = bpm; sel.value = id;
  if (was && !silent) setTimeout(start, 120);
}
sel.addEventListener('change', () => chooseSong(sel.value));
$('btnSong').onclick = () => $('fileAudio').click();
$('fileAudio').addEventListener('change', e => { setCustomAudio(e.target.files[0]); e.target.value = ''; });

function idbOpen() { return new Promise((res, rej) => { const r = indexedDB.open('classMusicBox', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbPut(k, v) { try { const d = await idbOpen(); d.transaction('f', 'readwrite').objectStore('f').put(v, k); } catch (e) {} }
async function idbGet(k) { try { const d = await idbOpen(); return await new Promise(r => { const q = d.transaction('f').objectStore('f').get(k); q.onsuccess = () => r(q.result); q.onerror = () => r(null); }); } catch (e) { return null; } }

function useAudioBlob(blob, name) {
  if (custom) { custom.el.pause(); URL.revokeObjectURL(custom.el.src); }
  const el = new Audio(); el.src = URL.createObjectURL(blob); el.loop = true;
  custom = { name, el, node: null };
  let opt = sel.querySelector('option[value=custom]');
  if (!opt) { opt = document.createElement('option'); opt.value = 'custom'; sel.appendChild(opt); }
  opt.textContent = '🎧 ' + name.replace(/\.[^.]+$/, '').slice(0, 18);
}
function setCustomAudio(file) {
  if (!file) return;
  if (!file.type.startsWith('audio/')) { toast('음악 파일(mp3, m4a, wav 등)을 골라 주세요'); return; }
  useAudioBlob(file, file.name);
  idbPut('audio', { blob: file, name: file.name });
  chooseSong('custom', true);
  toast('내 음악을 넣었어요. 저작권이 있는 곡은 교실 안에서만 쓰세요');
}

/* ---------- 렌더 루프 ---------- */
let speed = 0, last = performance.now();
const smooth = (dt, k) => 1 - Math.exp(-dt * k);
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  openAmt = clamp(openAmt + (isOpen ? 1 : -1) * dt / 1.3, 0, 1);
  const e = openAmt * openAmt * (3 - 2 * openAmt);
  hinge.rotation.x = -e * 2.0;                              // 돔 뚜껑이 뒤로 젖혀짐
  pf.scale.setScalar(1 + 0.1 * e); pf.position.y = PH_Y + 0.12 * e;

  speed += ((isOpen ? 0 : playing ? 0.8 : 0.25) - speed) * Math.min(1, dt * 2.2);
  if (isOpen) {                                             // 사진 앞면이 카메라를 향하도록
    let d = ((cam.az - spin.rotation.y + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    spin.rotation.y += d * smooth(dt, 4);
  } else spin.rotation.y += speed * dt;
  key.rotation.x -= (playing ? 1 : 0) * dt * 2.4;

  if (camLock > 0 && goal) {                                // 카메라가 부드럽게 이동
    camLock -= dt; const k = smooth(dt, 3.2);
    cam.dist += (goal.dist - cam.dist) * k; cam.el += (goal.el - cam.el) * k; cam.target.y += (goal.ty - cam.target.y) * k;
  }
  if (domeYaw.visible || true) {
    const a = dustPts.geometry.attributes.position, lim = DR * 1.0;
    for (let i = 0; i < dustRise.length; i++) { let y = a.getY(i) + dustRise[i] * dt * (playing ? 3 : 1); if (y > lim) y = 0.2; a.setY(i, y); }
    a.needsUpdate = true; dustPts.rotation.y += dt * (playing ? 0.4 : 0.08);
  }
  const kh = smooth(dt, 12);
  hoverDome += ((hover === 'dome' ? 1 : 0) - hoverDome) * kh;
  hoverPhoto += ((hover === 'photo' || toolsOver ? 1 : 0) - hoverPhoto) * kh;
  matRim.emissive.copy(hlColor).multiplyScalar(0.85 * hoverDome); haloMat.opacity = 0.55 * hoverDome;
  seatMesh.scale.z = 1 + 0.9 * hoverDome; matGlass.opacity = 0.16 + 0.1 * hoverDome;
  matFrame.emissive.copy(hlColor).multiplyScalar(0.7 * hoverPhoto);
  updateCamera(); placeTools(); renderer.render(scene, camera); requestAnimationFrame(frame);
}

/* ---------- 시작 ---------- */
async function start0() {
  resize(); build(); applyTheme(state.theme); refreshPhoto(); updateHint();
  const saved = await idbGet('audio');
  if (saved && saved.blob) useAudioBlob(saved.blob, saved.name);
  if (state.song === 'custom' && !custom) state.song = 'canon';
  if (!SONGS[state.song] && state.song !== 'custom') state.song = 'canon';
  chooseSong(state.song, true);
  requestAnimationFrame(frame);
}
if (state.img) { const im = new Image(); im.onload = () => { photoImg = im; start0(); }; im.onerror = start0; im.src = state.img; } else start0();
})();
