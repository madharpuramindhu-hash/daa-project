/* ---------- Setup ---------- */
const cv = document.getElementById('map'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
let cities = [], state = {}, steps = 0, running = false, gen = null, timer = null, dragging = -1, moved = false;

/* ---------- Helpers ---------- */
const d = (a, b) => Math.hypot(cities[a].x - cities[b].x, cities[a].y - cities[b].y);
const len = (t, closed = true) => {
  let s = 0;
  for (let i = 0; i < t.length - 1; i++) s += d(t[i], t[i + 1]);
  if (closed && t.length > 1) s += d(t[t.length - 1], t[0]);
  return s;
};
const fmt = x => (x == null ? '–' : Math.round(x));
const fact = n => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
const big = x => (x > 1e9 ? x.toExponential(2) : Math.round(x).toLocaleString());

/* ---------- Algorithms (generators: each yield = one visible step) ---------- */
function* brute() {
  const n = cities.length; let best = Infinity, bt = null, c = 0;
  function* perm(a, k) {
    if (k === a.length) { yield a.slice(); return; }
    for (let i = k; i < a.length; i++) {
      [a[k], a[i]] = [a[i], a[k]]; yield* perm(a, k + 1); [a[k], a[i]] = [a[i], a[k]];
    }
  }
  for (const p of perm([...Array(n - 1)].map((_, i) => i + 1), 0)) {
    const t = [0, ...p], L = len(t);
    if (L < best) { best = L; bt = t; }
    yield { cur: t, best: bt, bestLen: best, note: `Tour #${++c} of ${fact(n - 1)} checked. Best so far: ${fmt(best)}` };
  }
  yield { cur: bt, best: bt, bestLen: best, note: 'Every possible tour checked. This is the optimal answer.' };
}

function* nn() {
  const n = cities.length, vis = [0], left = new Set([...Array(n).keys()].slice(1));
  while (left.size) {
    const last = vis[vis.length - 1]; let b = -1, bd = Infinity;
    for (const j of left) {
      yield { cur: [...vis, j], open: true, note: `At city ${last}: distance to city ${j} is ${fmt(d(last, j))}` };
      if (d(last, j) < bd) { bd = d(last, j); b = j; }
    }
    vis.push(b); left.delete(b);
    yield { cur: [...vis], open: true, note: `Closest unvisited city is ${b}. Move there.` };
  }
  yield { cur: vis, best: vis, bestLen: len(vis), note: 'All cities visited. Return to start. Fast, but not always optimal.' };
}

function* opt() {
  const n = cities.length; let t = [...Array(n).keys()], L = len(t), improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < n - 1; i++) for (let k = i + 1; k < n; k++) {
      const nt = t.slice(0, i).concat(t.slice(i, k + 1).reverse(), t.slice(k + 1)), nl = len(nt);
      yield { cur: nt, best: t, bestLen: L, note: `Reverse cities ${i} to ${k}: ${nl < L - 1e-9 ? 'shorter, keep it' : 'no gain, undo'}` };
      if (nl < L - 1e-9) { t = nt; L = nl; improved = true; }
    }
  }
  yield { cur: t, best: t, bestLen: L, note: 'No reversal improves the tour. Local optimum reached.' };
}

function* dp() {
  const n = cities.length, N = 1 << n, INF = Infinity;
  const f = new Float64Array(N * n).fill(INF), par = new Int8Array(N * n).fill(-1);
  f[1 * n + 0] = 0; // only city 0 visited, standing at 0
  for (let m = 1; m < N; m += 2) {
    for (let j = 0; j < n; j++) {
      if (!(m >> j & 1) || f[m * n + j] === INF) continue;
      for (let k = 0; k < n; k++) {
        if (m >> k & 1) continue;
        const nm = m | (1 << k), v = f[m * n + j] + d(j, k);
        if (v < f[nm * n + k]) { f[nm * n + k] = v; par[nm * n + k] = j; }
      }
    }
    yield { mask: m, note: `Best path for subset ${(m + 1) / 2} of ${N / 2} stored in the table` };
  }
  let last = -1, bl = INF; const full = N - 1;
  for (let j = 1; j < n; j++) { const v = f[full * n + j] + d(j, 0); if (v < bl) { bl = v; last = j; } }
  const t = []; let m = full, j = last;
  while (j !== -1) { t.push(j); const p = par[m * n + j]; m ^= 1 << j; j = p; }
  t.reverse();
  yield { cur: t, best: t, bestLen: bl, note: 'Table complete. Walked backwards through it to rebuild the optimal tour.' };
}

/* ---------- Algorithm info shown to the student ---------- */
const ALGOS = {
  brute: { fn: brute, max: 9, name: 'Brute force',
    text: 'Tries every possible order of cities and keeps the shortest. Always correct, but the number of tours explodes as cities are added.',
    time: 'O(n!)', space: 'O(n)', ops: n => `${n} cities → ${big(fact(n - 1))} tours to check. (Limit here: 9 cities)` },
  nn: { fn: nn, max: 30, name: 'Nearest neighbour',
    text: 'Start at city 0 and always walk to the closest city not yet visited. Very fast, but early greedy choices can force long jumps at the end.',
    time: 'O(n²)', space: 'O(n)', ops: n => `${n} cities → about ${big(n * n)} distance checks.` },
  opt: { fn: opt, max: 30, name: '2-opt improvement',
    text: 'Starts with the cities in the order you placed them, then repeatedly reverses a section of the route whenever that makes it shorter, until nothing helps.',
    time: 'O(n²) per pass', space: 'O(n)', ops: n => `${n} cities → ${big(n * (n - 1) / 2)} reversals tried per pass.` },
  dp: { fn: dp, max: 12, name: 'Held-Karp (dynamic programming)',
    text: 'Remembers the best path for every subset of cities ending at each city, and builds bigger subsets from smaller ones. Exact answer, far faster than brute force, but memory heavy.',
    time: 'O(n² · 2ⁿ)', space: 'O(n · 2ⁿ)', ops: n => `${n} cities → about ${big(n * n * 2 ** n)} operations. (Limit here: 12 cities)` }
};

function showInfo() {
  const a = ALGOS[$('algo').value], n = cities.length;
  $('aName').textContent = a.name; $('aText').textContent = a.text;
  $('aTime').textContent = a.time; $('aSpace').textContent = a.space;
  $('aOps').textContent = n > 1 ? a.ops(n) : 'Add cities to see how much work this algorithm needs.';
}

/* ---------- Drawing ---------- */
function drawPath(t, closed, color, width, dash) {
  if (!t || t.length < 2) return;
  ctx.beginPath(); ctx.setLineDash(dash || []); ctx.strokeStyle = color; ctx.lineWidth = width;
  t.forEach((c, i) => i ? ctx.lineTo(cities[c].x, cities[c].y) : ctx.moveTo(cities[c].x, cities[c].y));
  if (closed) ctx.closePath();
  ctx.stroke(); ctx.setLineDash([]);
}
function draw() {
  ctx.clearRect(0, 0, cv.width, cv.height);
  const css = getComputedStyle(document.documentElement);
  if (state.cur) drawPath(state.cur, !state.open, css.getPropertyValue('--cur'), 2, [6, 6]);
  if (state.best) drawPath(state.best, true, css.getPropertyValue('--best'), 4);
  cities.forEach((c, i) => {
    const inSet = state.mask != null && (state.mask >> i & 1);
    ctx.beginPath(); ctx.arc(c.x, c.y, i === 0 ? 13 : 11, 0, 7);
    ctx.fillStyle = inSet ? css.getPropertyValue('--hi') : '#10243a'; ctx.fill();
    ctx.fillStyle = inSet ? '#10243a' : '#fff'; ctx.font = '600 12px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(i, c.x, c.y + 1);
  });
  $('sCities').textContent = cities.length; $('sSteps').textContent = steps.toLocaleString();
  $('sCur').textContent = state.cur ? fmt(len(state.cur, !state.open)) : '–';
  $('sBest').textContent = fmt(state.bestLen);
  $('note').textContent = state.note || 'Waiting to start.';
}

/* ---------- Running ---------- */
const SPEED = [[1, 500], [1, 200], [1, 60], [5, 16], [50, 16], [500, 16], [3000, 16]];
function setStatus(msg) { $('status').textContent = msg; }
function setRunning(r) {
  running = r; $('run').disabled = r; $('stop').disabled = !r;
  $('random').disabled = r; $('clear').disabled = r; $('algo').disabled = r;
}
function run() {
  const a = ALGOS[$('algo').value], n = cities.length;
  if (n < 3) return setStatus('Add at least 3 cities first.');
  if (n > a.max) return setStatus(`${a.name} is limited to ${a.max} cities here. Remove some cities or choose another algorithm.`);
  state = {}; steps = 0; gen = a.fn(); setRunning(true); setStatus(`Running ${a.name}...`); tick();
}
function tick() {
  if (!running) return;
  const [k, delay] = SPEED[$('speed').value - 1];
  for (let i = 0; i < k; i++) {
    const r = gen.next();
    if (r.done) { finish(); return; }
    state = r.value; steps++;
  }
  draw(); timer = setTimeout(tick, delay);
}
function finish() {
  clearTimeout(timer); setRunning(false); draw();
  setStatus(`Finished. Best tour length: ${fmt(state.bestLen)}.`);
}
function stop() { clearTimeout(timer); setRunning(false); setStatus('Stopped.'); }
function reset() { stop(); state = {}; steps = 0; draw(); showInfo(); }

/* ---------- Mouse / touch ---------- */
function pos(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height };
}
cv.addEventListener('pointerdown', e => {
  if (running) return;
  const p = pos(e); dragging = cities.findIndex(c => Math.hypot(c.x - p.x, c.y - p.y) < 14); moved = false;
  if (dragging >= 0) cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e => {
  if (dragging < 0) return;
  const p = pos(e); cities[dragging].x = p.x; cities[dragging].y = p.y; moved = true; state = {}; draw();
});
cv.addEventListener('pointerup', e => {
  if (running) return;
  if (dragging < 0) {
    if (cities.length >= 30) return setStatus('Maximum 30 cities.');
    const p = pos(e); cities.push(p); state = {}; steps = 0; setStatus(`City ${cities.length - 1} added.`); draw(); showInfo();
  }
  dragging = -1;
});

/* ---------- Buttons ---------- */
$('run').onclick = run;
$('stop').onclick = stop;
$('clear').onclick = () => { cities = []; reset(); setStatus('Cleared. Click the map to add cities.'); };
$('random').onclick = () => {
  const n = Math.min(30, Math.max(3, +$('count').value || 8));
  cities = Array.from({ length: n }, () => ({ x: 40 + Math.random() * (cv.width - 80), y: 40 + Math.random() * (cv.height - 80) }));
  reset(); setStatus(`${n} random cities placed.`);
};
$('algo').onchange = () => { state = {}; steps = 0; draw(); showInfo(); };
$('stop').disabled = true;
$('random').click();