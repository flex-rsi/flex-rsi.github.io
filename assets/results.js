// Results section, built entirely from data/results.json so that categories and tasks can grow
// without changes here.
//   Overview   models x categories: average rank within each category, and over all tasks
//   Category   a summary table (models x the category's tasks, primary metric) and one tab per task
//   Task       every test metric, the validation gain, the rounds run, and the improvement curves
// The current view is kept in the URL (#results/<category>/<task>) so it can be linked.
(() => {
  const root = document.getElementById("leaderboard");
  if (!root) return;
  const $ = (sel) => root.querySelector(sel);
  const tabsEl = $(".board-tabs"), subEl = $(".board-subtabs");
  const titleEl = $(".board-title"), leadEl = $(".board-sub");
  const table = $("table.results"), fig = $(".curves-fig"), svg = $(".curves-plot"), legend = $(".legend"), noteEl = $(".board-note");

  const PCT = new Set(["accuracy", "acc_vstar", "acc_hrbench8k", "success", "hos_sr", "hps_sr", "success_rate"]);
  const fmt = (key, v) => {
    if (v === null || v === undefined) return "–";
    if (PCT.has(key)) return (100 * v).toFixed(1) + "%";
    if (key === "score") return String(Math.round(v));
    if (key === "avg_steps") return v.toFixed(2);
    return v.toFixed(3);
  };
  const fmtAxis = (key, v) => (key === "score" ? String(Math.round(v)) : PCT.has(key) ? (100 * v).toFixed(0) + "%" : v.toFixed(2));
  const gain = (g) => (g === null || g === undefined ? "–" : (g >= 0 ? "+" : "") + Math.round(g) + "%");
  const ENDED = { max_rounds: "round limit", budget_wall: "time budget", budget_usd: "cost budget", budget_gpu: "GPU budget",
                  budget_tokens: "token budget", val_calls: "validation budget", idle: "no further progress" };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tag = (w) => `<span class="wtag">${w === "open" ? "open" : "closed"}</span>`;
  const COLORS = ["var(--accent-1)", "var(--ink)", "#c98b5e", "#9fb08f", "#8fa3b8", "#b59ac2", "#d98080", "#7fb3b0", "#a39a8e"];

  let data, cats, byCat, rankOf;   // rankOf[taskId][model] = 1-based rank on that task

  // Average rank of each model over a set of tasks; models are ordered by how many of the tasks
  // they were run on (more first), then by average rank.
  function aggregate(tasks) {
    const m = new Map();
    tasks.forEach((t) => t.rows.forEach((r) => {
      const e = m.get(r.model) || { model: r.model, weights: r.weights, ranks: {}, values: {} };
      e.ranks[t.id] = rankOf[t.id][r.model];
      e.values[t.id] = r.test[t.primary];
      m.set(r.model, e);
    }));
    return [...m.values()].map((e) => {
      const rs = Object.values(e.ranks);
      return { ...e, n: rs.length, avg: rs.reduce((a, b) => a + b, 0) / rs.length };
    }).sort((a, b) => b.n - a.n || a.avg - b.avg);
  }

  // ---------- views ----------
  function overview() {
    const rows = aggregate(data.tasks);
    const total = data.tasks.length;
    titleEl.textContent = "Overview";
    leadEl.textContent = `${total} tasks in ${cats.length} categories. Each cell is a model's average rank over the category's tasks it was run on (lower is better); click a cell to open the category.`;
    subEl.hidden = true;
    table.innerHTML = `<thead><tr><th>#</th><th>Model</th>${cats.map((c) => `<th>${esc(c.name)}<span class="th-sub">${byCat[c.id].length} task${byCat[c.id].length > 1 ? "s" : ""}</span></th>`).join("")}<th>Overall<span class="th-sub">avg. rank</span></th><th>Tasks</th></tr></thead>
      <tbody>${rows.map((r, i) => {
        const cells = cats.map((c) => {
          const rs = byCat[c.id].filter((t) => t.id in r.ranks).map((t) => r.ranks[t.id]);
          if (!rs.length) return `<td class="na">–</td>`;
          const avg = rs.reduce((a, b) => a + b, 0) / rs.length;
          const part = rs.length < byCat[c.id].length ? `<span class="th-sub">${rs.length}/${byCat[c.id].length}</span>` : "";
          return `<td class="cell-link" data-cat="${c.id}">${avg.toFixed(1)}${part}</td>`;
        }).join("");
        return `<tr${r.n < total ? ' class="partial"' : ""}><td>${i + 1}</td><td class="model">${esc(r.model)} ${tag(r.weights)}</td>${cells}<td class="strong">${r.avg.toFixed(1)}</td><td>${r.n}/${total}</td></tr>`;
      }).join("")}</tbody>`;
    fig.hidden = true;
    noteEl.textContent = `Ranks use each task's primary test metric. Updated ${data.updated}.`;
  }

  function categorySummary(c) {
    const tasks = byCat[c.id];
    const rows = aggregate(tasks);
    titleEl.textContent = c.name;
    leadEl.textContent = `${c.about} Primary test metric of each task; models ordered by their average rank in this category.`;
    table.innerHTML = `<thead><tr><th>#</th><th>Model</th>${tasks.map((t) => `<th class="cell-link" data-task="${t.id}">${esc(t.track)}<span class="th-sub">${esc(t.metrics[0].label)}</span></th>`).join("")}<th>Avg. rank</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr${r.n < tasks.length ? ' class="partial"' : ""}><td>${i + 1}</td><td class="model">${esc(r.model)} ${tag(r.weights)}</td>${tasks
        .map((t) => `<td>${t.id in r.values ? fmt(t.primary, r.values[t.id]) : "–"}</td>`).join("")}<td class="strong">${r.avg.toFixed(1)}${r.n < tasks.length ? `<span class="th-sub">${r.n}/${tasks.length} tasks</span>` : ""}</td></tr>`).join("")}</tbody>`;
    fig.hidden = true;
    noteEl.textContent = "Open a task for all of its metrics and the improvement curves.";
  }

  function task(t) {
    titleEl.textContent = t.track;
    leadEl.textContent = `${t.task}. Ranked by ${t.metrics[0].label} on the hidden test split.`;
    table.innerHTML = `<thead><tr><th>#</th><th>Model</th>${t.metrics.map((m) => `<th>${esc(m.label)}</th>`).join("")}<th>Gain<span class="th-sub">validation</span></th><th>Rounds<span class="th-sub">ended by</span></th></tr></thead>
      <tbody>${t.rows.map((r, i) => `<tr data-i="${i}"><td>${i + 1}</td><td class="model"><span class="sw" style="background:${COLORS[i % COLORS.length]}"></span>${esc(r.model)} ${tag(r.weights)}</td>${t.metrics
        .map((m, j) => `<td${j === 0 ? ' class="strong"' : ""}>${fmt(m.key, r.test[m.key])}</td>`).join("")}<td class="gain">${gain(r.gain_pct)}</td><td>${r.rounds ?? "–"}${r.ended ? `<span class="th-sub">${esc(ENDED[r.ended] || r.ended)}</span>` : ""}</td></tr>`).join("")}</tbody>`;
    drawCurves(t);
    noteEl.textContent = `${data.notes.gain} Each line ends at the last round its run reached.`;
  }

  // ---------- curves ----------
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

  // The start, every round whose best score rose, and the run's own last round.
  function keyPoints(curve) {
    const p = curve.map((v, x) => [x, v]).filter((q) => q[1] !== null);
    const out = p.filter((q, k) => k === 0 || q[1] > p[k - 1][1]);
    const end = p[p.length - 1];
    if (end && out[out.length - 1][0] !== end[0]) out.push(end);
    return out;
  }

  function drawCurves(t) {
    const W = 760, H = 300, L = 46, R = 16, T = 14, B = 34;
    const series = t.rows.map((r, i) => ({ r, i, pts: keyPoints(r.curve) })).filter((s) => s.pts.length);
    const maxX = Math.max(...series.map((s) => s.r.curve.length - 1), 1);
    const vals = series.flatMap((s) => s.pts.map((p) => p[1]));
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.08 || 0.05; lo = Math.max(0, lo - pad); hi += pad;
    const X = (x) => L + (x / maxX) * (W - L - R);
    const Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    let g = "";
    for (let k = 0; k <= 4; k++) {
      const v = lo + (k / 4) * (hi - lo), y = Y(v);
      g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text class="ax" x="${L - 8}" y="${y + 4}" text-anchor="end">${fmtAxis(t.primary, v)}</text>`;
    }
    for (let x = 0; x <= maxX; x += maxX > 10 ? 5 : 2) g += `<text class="ax" x="${X(x)}" y="${H - 10}" text-anchor="middle">${x}</text>`;
    const lines = series.map((s) => {
      const end = s.pts[s.pts.length - 1];
      const c = COLORS[s.i % COLORS.length];
      return `<g class="ln" data-i="${s.i}"><path d="${smooth(s.pts.map(([x, v]) => [X(x), Y(v)]))}" stroke="${c}" pathLength="1"/><circle cx="${X(end[0])}" cy="${Y(end[1])}" r="3.5" fill="${c}"/></g>`;
    }).join("");
    svg.setAttribute("aria-label", `${t.track}: validation score over rounds`);
    svg.innerHTML = g + lines;
    legend.innerHTML = series.map((s) => `<li data-i="${s.i}"><span class="sw" style="background:${COLORS[s.i % COLORS.length]}"></span>${esc(s.r.model)}</li>`).join("");
    fig.hidden = false;
    svg.classList.remove("drawn");
    requestAnimationFrame(() => svg.classList.add("drawn"));
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

  // ---------- navigation ----------
  function show(catId = "overview", taskId = "summary", push = true) {
    if (!cats.some((c) => c.id === catId)) catId = "overview";
    tabsEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.cat === catId)));
    if (catId === "overview") {
      overview();
    } else {
      const cat = cats.find((c) => c.id === catId), tasks = byCat[catId];
      if (!tasks.some((t) => t.id === taskId)) taskId = "summary";
      subEl.hidden = false;
      subEl.innerHTML = [`<button type="button" role="tab" data-task="summary">Summary</button>`,
        ...tasks.map((t) => `<button type="button" role="tab" data-task="${t.id}">${esc(t.track)}</button>`)].join("");
      subEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.task === taskId)));
      if (taskId === "summary") categorySummary(cat); else task(tasks.find((t) => t.id === taskId));
    }
    const board = $(".board");
    board.classList.remove("swap"); void board.offsetWidth; board.classList.add("swap");
    if (push) history.replaceState(null, "", catId === "overview" ? "#results" : `#results/${catId}${taskId !== "summary" ? "/" + taskId : ""}`);
  }
  const currentCat = () => tabsEl.querySelector('[aria-selected="true"]').dataset.cat;

  tabsEl.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) show(b.dataset.cat); });
  subEl.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) show(currentCat(), b.dataset.task); });
  table.addEventListener("click", (e) => {
    const c = e.target.closest("td[data-cat]"), t = e.target.closest("th[data-task]");
    if (c) show(c.dataset.cat);
    else if (t) show(currentCat(), t.dataset.task);
  });

  fetch("data/results.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((d) => {
      data = d;
      rankOf = Object.fromEntries(d.tasks.map((t) => [t.id, Object.fromEntries(t.rows.map((r, i) => [r.model, i + 1]))]));
      byCat = {};
      d.tasks.forEach((t) => (byCat[t.category] = byCat[t.category] || []).push(t));
      cats = d.categories.filter((c) => byCat[c.id]);        // categories without tasks stay hidden
      tabsEl.innerHTML = [`<button type="button" role="tab" data-cat="overview">Overview</button>`,
        ...cats.map((c) => `<button type="button" role="tab" data-cat="${c.id}">${esc(c.name)}<span class="count">${byCat[c.id].length}</span></button>`)].join("");
      const fromHash = () => {
        const m = location.hash.match(/^#results(?:\/([\w-]+))?(?:\/([\w-]+))?/);
        if (m) show(m[1] || "overview", m[2] || "summary", false);
        return m;
      };
      if (fromHash()) root.scrollIntoView(); else show("overview", "summary", false);
      window.addEventListener("hashchange", fromHash);
    })
    .catch(() => { titleEl.textContent = "Results"; leadEl.textContent = "Results could not be loaded."; });
})();
