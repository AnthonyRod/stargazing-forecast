// Canvas water renderer for hourly rain cards. Vanilla 2D canvas (GPU
// composited), one shared rAF loop for all cards. No dependencies.
let raf = 0;
let waters = [];
let resizeT = 0;

function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sizeCanvas(cv) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  // Medir la tarjeta (sin transforms): el .w-fill lleva un scaleY de entrada
  // que colapsaría su propio rect a ~0 si lo midiéramos directamente.
  const card = cv.closest('.w-card');
  const pct = parseFloat(cv.parentElement.style.height) || 0;
  const r = card ? card.getBoundingClientRect() : cv.getBoundingClientRect();
  cv.width = Math.max(2, Math.round(r.width * dpr));
  cv.height = Math.max(2, Math.round(r.height * (pct / 100) * dpr));
}

function initWater(cv, idx) {
  const rnd = mulberry(idx * 97 + 13);
  const bubbles = Array.from({ length: 8 }, () => ({
    x: rnd(), off: rnd(), r: 1.6 + rnd() * 1.8, sp: 0.30 + rnd() * 0.30, sw: rnd() * 6.28,
  }));
  return { cv, ctx: cv.getContext('2d'), bubbles, seed: rnd() * 6.28 };
}

function draw(w, t) {
  const { ctx, bubbles, seed } = w;
  const W = w.cv.width, H = w.cv.height;
  if (W < 4 || H < 4) return;
  ctx.clearRect(0, 0, W, H);

  // Body: depth gradient, pale surface -> marine depth (kept light/cristal)
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(125,211,252,.38)');
  g.addColorStop(0.35, 'rgba(56,189,248,.28)');
  g.addColorStop(1, 'rgba(3,105,161,.34)');
  ctx.fillStyle = g;

  // Three wave layers, back -> front. Each sums two drifting harmonics so
  // the surface breathes instead of sliding like a rigid sine.
  const layers = [
    { amp: 0.038, len: 0.9, sp: 0.0011, base: 0.045, col: 'rgba(125,211,252,.22)' },
    { amp: 0.028, len: 1.4, sp: 0.0016, base: 0.02, col: 'rgba(56,189,248,.26)' },
    { amp: 0.022, len: 2.1, sp: 0.0022, base: 0.0, col: 'rgba(186,230,253,.38)' },
  ];
  const surf = [];
  for (const L of layers) {
    const len2 = L.len * 2.3 + 0.7, sp2 = -L.sp * 1.4;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 3) {
      const y = H * L.base
        + Math.sin((x / W) * Math.PI * 2 * L.len + seed + t * L.sp) * H * L.amp
        + Math.sin((x / W) * Math.PI * 2 * len2 + seed * 1.7 + t * sp2) * H * L.amp * 0.4;
      ctx.lineTo(x, y);
      if (L === layers[2]) surf.push([x, y]);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = L.col;
    ctx.fill();
  }
  // Specular crest on the front wave
  ctx.beginPath();
  surf.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = 'rgba(224,242,254,.8)';
  ctx.lineWidth = Math.max(1, H * 0.008);
  ctx.stroke();

  // Glass gloss: diagonal sheen
  const s = ctx.createLinearGradient(0, 0, W, H);
  s.addColorStop(0, 'rgba(255,255,255,.20)');
  s.addColorStop(0.3, 'rgba(255,255,255,.05)');
  s.addColorStop(0.55, 'rgba(255,255,255,0)');
  ctx.fillStyle = s;
  ctx.fillRect(0, 0, W, H);

  // Drifting shimmer band
  const sy = H * (0.4 + 0.2 * Math.sin(seed + t * 0.0015));
  ctx.fillStyle = 'rgba(224,242,254,.07)';
  ctx.fillRect(0, sy, W, H * 0.06);

  // Rising micro-bubbles with sway: halo + bright core so they read clearly
  for (const b of bubbles) {
    const p = ((t * b.sp * 0.001 + b.off) % 1 + 1) % 1;
    const y = H - p * (H + 6);
    const x = b.x * W + Math.sin(seed + b.sw + t * 0.0022) * W * 0.02;
    const a = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
    const r = b.r * (W / 160 + 0.5);
    ctx.beginPath();
    ctx.arc(x, y, r * 1.9, 0, 6.29);
    ctx.fillStyle = `rgba(186,230,253,${(0.28 * a).toFixed(3)})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.29);
    ctx.fillStyle = `rgba(240,249,255,${(0.9 * a).toFixed(3)})`;
    ctx.fill();
  }
}

function loop(t) {
  const panel = document.getElementById('panel-weather');
  if (!document.hidden && panel && !panel.hasAttribute('hidden')) {
    for (const w of waters) draw(w, t);
  }
  raf = requestAnimationFrame(loop);
}

export function stopWater() {
  cancelAnimationFrame(raf);
  raf = 0;
  waters = [];
}

export function startWater() {
  stopWater();
  const cvs = [...document.querySelectorAll('.w-water')];
  if (!cvs.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    waters = cvs.map((cv, i) => { sizeCanvas(cv); return initWater(cv, i); });
    for (const w of waters) draw(w, 1200); // one static frame
    return;
  }
  waters = cvs.map((cv, i) => { sizeCanvas(cv); return initWater(cv, i); });
  raf = requestAnimationFrame(loop);
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { for (const w of waters) sizeCanvas(w.cv); }, 200);
  });
}
