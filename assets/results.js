// Results section: tabs, per-task leaderboards and best-so-far curves, from data/results.json.
(() => {
  const root = document.getElementById("leaderboard");
  if (!root) return;
  const tabsEl = root.querySelector(".board-tabs");
  const titleEl = root.querySelector(".board-title");
  const subEl = root.querySelector(".board-sub");
  const table = root.querySelector("table.results");
  const fig = root.querySelector(".curves-fig");
  const svg = root.querySelector(".curves-plot");
  const legend = root.querySelector(".legend");
  const noteEl = root.querySelector(".board-note");

  const PCT = new Set(["accuracy", "acc_vstar", "acc_hrbench8k", "success", "hos_sr", "hps_sr", "success_rate"]);
  const fmt = (key, v) => {
    if (v === null || v === undefined) return "–";
    if (PCT.has(key)) return (100 * v).toFixed(1) + "%";
    if (key === "score") return String(Math.round(v));
    if (key === "avg_steps") return v.toFixed(2);
    return v.toFixed(3);
  };
  const fmtCurve = (key, v) => (key === "score" ? String(Math.round(v)) : PCT.has(key) ? (100 * v).toFixed(0) + "%" : v.toFixed(2));
  const gain = (g) => (g === null || g === undefined ? "–" : (g >= 0 ? "+" : "") + Math.round(g) + "%");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tag = (w) => `<span class="wtag">${w === "open" ? "open" : "closed"}</span>`;
  // line colours: the accent for the leader, then quiet tones that read on the dark ground
  const COLORS = ["var(--accent-1)", "var(--ink)", "#c98b5e", "#9fb08f", "#8fa3b8", "#b59ac2", "#d98080", "#7fb3b0", "#a39a8e"];

  let data = null;

  function overview() {
    const tasks = data.tasks;
    const models = new Map();
    tasks.forEach((t) => t.rows.forEach((r, i) => {
      const m = models.get(r.model) || { model: r.model, weights: r.weights, cells: {}, ranks: [] };
      m.cells[t.id] = r.test[t.primary];
      m.ranks.push(i + 1);
      models.set(r.model, m);
    }));
    const rows = [...models.values()].map((m) => ({ ...m, avg: m.ranks.reduce((a, b) => a + b, 0) / m.ranks.length, n: m.ranks.length }));
    rows.sort((a, b) => (b.n === tasks.length) - (a.n === tasks.length) || a.avg - b.avg);
    titleEl.textContent = "Overview";
    subEl.textContent = "Primary test metric of every task. Models are ordered by their average rank across the tasks they were run on; those run on all four tasks come first.";
    table.innerHTML = `<thead><tr><th>#</th><th>Model</th>${tasks.map((t) => `<th>${esc(t.track)}<span class="th-sub">${esc(t.metrics[0].label)}</span></th>`).join("")}<th>Avg. rank</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr${r.n < tasks.length ? ' class="partial"' : ""}><td>${i + 1}</td><td class="model">${esc(r.model)} ${tag(r.weights)}</td>${tasks
        .map((t) => `<td>${t.id in r.cells ? fmt(t.primary, r.cells[t.id]) : "–"}</td>`).join("")}<td class="strong">${r.avg.toFixed(1)}${r.n < tasks.length ? `<span class="th-sub">${r.n}/${tasks.length} tasks</span>` : ""}</td></tr>`).join("")}</tbody>`;
    fig.hidden = true;
    noteEl.textContent = `Test scores on hidden splits. Updated ${data.updated}.`;
  }

  function task(t) {
    titleEl.textContent = t.track;
    subEl.textContent = `${t.task}. Ranked by ${t.metrics[0].label} on the hidden test split.`;
    table.innerHTML = `<thead><tr><th>#</th><th>Model</th>${t.metrics.map((m) => `<th>${esc(m.label)}</th>`).join("")}<th>Gain<span class="th-sub">validation</span></th></tr></thead>
      <tbody>${t.rows.map((r, i) => `<tr data-i="${i}"><td>${i + 1}</td><td class="model"><span class="sw" style="background:${COLORS[i % COLORS.length]}"></span>${esc(r.model)} ${tag(r.weights)}</td>${t.metrics
        .map((m, j) => `<td${j === 0 ? ' class="strong"' : ""}>${fmt(m.key, r.test[m.key])}</td>`).join("")}<td class="gain">${gain(r.gain_pct)}</td></tr>`).join("")}</tbody>`;
    drawCurves(t);
    noteEl.textContent = `${data.notes.gain} ${data.notes.curve}`;
  }


  // Smooth line through the points, monotone between them (Fritsch-Carlson), so a curve that
  // only rises never dips or overshoots between rounds.
  function smooth(p) {
    const n = p.length;
    if (n < 2) return n ? `M${p[0][0]},${p[0][1]}` : "";
    const dx = [], m = [];
    for (let i = 0; i < n - 1; i++) { dx.push(p[i + 1][0] - p[i][0]); m.push((p[i + 1][1] - p[i][1]) / dx[i]); }
    const t = [m[0]];
    for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
    t.push(m[n - 2]);
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b;
      if (h > 9) { const k = 3 / Math.sqrt(h); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    let d = `M${p[0][0]},${p[0][1]}`;
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += `C${p[i][0] + h},${p[i][1] + t[i] * h} ${p[i + 1][0] - h},${p[i + 1][1] - t[i + 1] * h} ${p[i + 1][0]},${p[i + 1][1]}`;
    }
    return d;
  }

  function drawCurves(t) {
    const W = 760, H = 300, L = 46, R = 16, T = 14, B = 34;
    // points of each line: the start, every round whose best score rose, and the last round;
    // joined by a smooth line, so the chart shows each model's rise rather than a staircase
    const keyPoints = (curve) => {
      const p = curve.map((v, x) => [x, v]).filter((q) => q[1] !== null);
      const out = p.filter((q, k) => k === 0 || q[1] > p[k - 1][1]);
      const end = p[p.length - 1];
      if (end && out[out.length - 1][0] !== end[0]) out.push(end);
      return out;
    };
    const series = t.rows.map((r, i) => ({ r, i, pts: keyPoints(r.curve) })).filter((s) => s.pts.length);
    const maxX = Math.max(...series.map((s) => s.r.curve.length - 1), 1);
    const vals = series.flatMap((s) => s.pts.map((p) => p[1]));
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.08 || 0.05; lo = Math.max(0, lo - pad); hi = hi + pad;
    const X = (x) => L + (x / maxX) * (W - L - R);
    const Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const ticks = 4;
    let g = "";
    for (let k = 0; k <= ticks; k++) {
      const v = lo + (k / ticks) * (hi - lo), y = Y(v);
      g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text class="ax" x="${L - 8}" y="${y + 4}" text-anchor="end">${fmtCurve(t.primary, v)}</text>`;
    }
    for (let x = 0; x <= maxX; x += maxX > 10 ? 5 : 2) g += `<text class="ax" x="${X(x)}" y="${H - 10}" text-anchor="middle">${x}</text>`;
    const lines = series.map((s) => {
      const pts = s.pts.map(([x, v]) => [X(x), Y(v)]);
      const last = s.pts[s.pts.length - 1];
      if (last[0] < maxX) pts.push([X(maxX), Y(last[1])]);   // a shorter run holds its best score
      const d = smooth(pts);
      const c = COLORS[s.i % COLORS.length];
      return `<g class="ln" data-i="${s.i}"><path d="${d}" stroke="${c}" pathLength="1"/><circle cx="${X(maxX)}" cy="${Y(last[1])}" r="3.5" fill="${c}"/></g>`;
    }).join("");
    svg.setAttribute("aria-label", `${t.track}: best validation score by round`);
    svg.innerHTML = g + lines;
    legend.innerHTML = series.map((s) => `<li data-i="${s.i}"><span class="sw" style="background:${COLORS[s.i % COLORS.length]}"></span>${esc(s.r.model)}</li>`).join("");
    fig.hidden = false;
    svg.classList.remove("drawn"); void svg.getBBox; requestAnimationFrame(() => svg.classList.add("drawn"));
  }

  // hovering a legend entry or a table row highlights that model's line
  const focus = (i) => {
    svg.classList.toggle("focus", i !== null);
    svg.querySelectorAll(".ln").forEach((l) => l.classList.toggle("on", l.dataset.i === i));
    legend.querySelectorAll("li").forEach((l) => l.classList.toggle("on", l.dataset.i === i));
  };
  [legend, table].forEach((el) => {
    el.addEventListener("mouseover", (e) => { const n = e.target.closest("[data-i]"); if (n) focus(n.dataset.i); });
    el.addEventListener("mouseleave", () => focus(null));
  });

  function select(id) {
    tabsEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.id === id)));
    const board = root.querySelector(".board");
    board.classList.remove("swap"); void board.offsetWidth; board.classList.add("swap");
    if (id === "overview") overview(); else task(data.tasks.find((t) => t.id === id));
  }

  fetch("data/results.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((d) => {
      data = d;
      const tabs = [{ id: "overview", label: "Overview" }, ...d.tasks.map((t) => ({ id: t.id, label: t.track }))];
      tabsEl.innerHTML = tabs.map((t) => `<button type="button" role="tab" data-id="${t.id}">${esc(t.label)}</button>`).join("");
      tabsEl.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) select(b.dataset.id); });
      select("overview");
    })
    .catch(() => { titleEl.textContent = "Results"; subEl.textContent = "Results could not be loaded."; });
})();
