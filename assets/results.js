// Results section, built entirely from data/results.json so that categories and tasks can grow
// without changes here.
//   Overview   one leaderboard: each model's average rank over the tasks it was run on
//   Category   one tab per task (no second row when there is only one)
//   Task       every test metric, validation start and best, the rounds run, and the improvement curves
// The current view is kept in the URL (#results/<category>/<task>) so it can be linked.
(() => {
  const root = document.getElementById("leaderboard");
  if (!root) return;
  const $ = (sel) => root.querySelector(sel);
  const tabsEl = $(".board-tabs"), subEl = $(".board-subtabs");
  const titleEl = $(".board-title"), leadEl = $(".board-sub");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const table = $("table.results"), fig = $(".curves-fig"), svg = $(".curves-plot"), legend = $(".legend"), noteEl = $(".board-note");

  // Every metric is shown on one 0-100 scale, to one decimal, without a % sign: scores and rates kept in 0-1 are
  // multiplied by 100; RoboDojo points (pts_*), RoboLab scores and ARC-AGI-3 RHAE are already 0-100. Counts stay
  // counts (tasks run; average steps to two decimals). Speedups are ratios, shown as such (2.13×).
  const ON100 = new Set(["rhae", "rhae_starter", "robolab_score", "robolab_starter", "score"]);
  const TIMES = new Set(["speedup"]);
  const scale = (key) => (ON100.has(key) || TIMES.has(key) || key.startsWith("pts_") ? 1 : 100);
  const fmt = (key, v) => {
    if (v === null || v === undefined) return "–";
    if (key === "tasks_run" || key === "tasks_nonzero") return String(v);
    if (key === "avg_steps") return v.toFixed(2);
    if (TIMES.has(key)) return `${v.toFixed(2)}×`;
    return (scale(key) * v).toFixed(1);
  };
  // validation change in the same units: start → best (+delta)
  const change = (key, r) => {
    if (r.best === null || r.best === undefined) return "–";
    const v = (x) => fmt(key, x);
    if (r.start === null || r.start === undefined) return `<span class="to">best</span> <b>${v(r.best)}</b>`;
    const p = TIMES.has(key) ? 2 : 1, d = Math.round(10 ** p * scale(key) * (r.best - r.start)) / 10 ** p;
    return `${v(r.start)} <span class="to">→</span> <b>${v(r.best)}</b><span class="delta${d > 0 ? "" : " flat"}">${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d).toFixed(p)}</span>`;
  };
  const ENDED = { max_rounds: "round limit", budget_wall: "time budget", budget_usd: "cost budget", budget_gpu: "GPU budget",
                  budget_tokens: "token budget", val_calls: "validation budget", idle: "no further progress" };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tag = (w) => `<span class="wtag">${w === "open" ? "open" : "closed"}</span>`;

  // Provider marks are the SVGs from 4dcodebench.com/logos, plus Grok and Meta (for Muse) from the same LobeHub
  // icon set. GPT, GLM and Grok are drawn in black ("mono"); the others keep their brand colours.
  const LOGOS = [[/claude|sonnet|opus|fable|haiku/, "claude"], [/qwen/, "qwen"], [/gemini/, "gemini"], [/gemma/, "gemma"],
                 [/gpt|openai/, "gpt"], [/minimax/, "minimax"], [/\bglm\b/, "glm"], [/deepseek/, "deepseek"],
                 [/mistral/, "mistral"], [/mimo/, "mimo"], [/grok/, "grok"], [/\bmuse\b/, "meta"]];
  const MONO = new Set(["gpt", "glm", "grok"]);
  function modelMark(name) {
    const n = name.toLowerCase();
    const hit = LOGOS.find(([re]) => re.test(n));
    if (!hit) return '<span class="model-icon" aria-hidden="true"></span>';
    const f = hit[1];
    return `<span class="model-icon" aria-hidden="true"><img${MONO.has(f) ? ' class="mono"' : ""} src="assets/model-logos/${f}.svg" alt="" loading="lazy" decoding="async"></span>`;
  }
  // r.mark flags a row run under a non-standard condition (its task's footnote says which): it takes
  // no rank and stays out of the overview
  const markSup = (mark) => (mark ? `<sup class="row-mark">${esc(mark)}</sup>` : "");
  function modelCell(model, weights, mark) {
    return `<td class="model"><div class="mcell">${modelMark(model)}<span class="model-name">${esc(model)}${markSup(mark)}</span>${tag(weights)}</div></td>`;
  }
  function rankBadge(rank) {
    if (rank === null || rank === undefined) return `<span class="rank-badge na">–</span>`;
    const medal = rank <= 3 ? ` medal medal-${rank}` : "";
    return `<span class="rank-badge${medal}">${String(rank).padStart(2, "0")}</span>`;
  }
  // Standard competition ranking: equal scores share a rank and the next rank skips (1, 1, 3).
  const ranksOf = (t) => {
    const std = t.rows.filter((q) => !q.extra);
    return t.rows.map((r) => (r.extra ? null : 1 + std.filter((q) => q.test[t.primary] > r.test[t.primary]).length));
  };
  function rankClass(i, partial = false) {
    const classes = [];
    if (i < 3) classes.push("podium", `podium-${i + 1}`);
    if (partial) classes.push("partial");
    return classes.join(" ");
  }

  const COLORS = ["var(--accent-1)", "var(--ink)", "#e0471b", "#00937c", "#b07700", "#7b4cc4", "#4787dd", "#c93f7c", "#5f8a1c", "#8c5a2b", "#16a3b5", "#7d8597"];

  let data, cats, byCat, rankOf;   // rankOf[taskId][model] = 1-based rank on that task

  // ---------- views ----------

  // Overview: one leaderboard over all tasks. Each task ranks its models on the hidden test split (equal
  // scores share a rank); a model's average rank is the mean over the tasks it was run on, lower is better.
  // RoboDojo and RoboCasa are one task each. A model run on fewer than MIN_TASKS tasks is listed after the
  // others without a place, since a few tasks say little.
  const MIN_TASKS = 5;
  function overview() {
    titleEl.textContent = "Overview";
    leadEl.textContent = "Every model's average rank over the tasks it was run on: open a category for each task's scores and improvement curves.";
    subEl.hidden = true;
    const models = new Map();
    data.tasks.forEach((t) => t.rows.filter((r) => !r.extra).forEach((r) => {
      const m = models.get(r.model) || { model: r.model, weights: r.weights, ranks: [] };
      m.ranks.push(rankOf[t.id][r.model]);
      models.set(r.model, m);
    }));
    const rows = [...models.values()].map((m) => ({ ...m, n: m.ranks.length,
      avg: m.ranks.reduce((x, y) => x + y, 0) / m.ranks.length, firsts: m.ranks.filter((k) => k === 1).length }));
    const ranked = rows.filter((m) => m.n >= MIN_TASKS).sort((x, y) => x.avg - y.avg || y.n - x.n);
    const few = rows.filter((m) => m.n < MIN_TASKS).sort((x, y) => x.avg - y.avg || y.n - x.n);
    const r2 = (x) => Math.round(100 * x);   // places follow the averages as shown, to two decimals
    const place = ranked.map((m) => 1 + ranked.filter((q) => r2(q.avg) < r2(m.avg)).length);
    const row = (m, p) => `<tr class="${p ? rankClass(p - 1) : "partial"}"><td>${rankBadge(p)}</td>${modelCell(m.model, m.weights)}<td class="strong">${m.avg.toFixed(2)}</td><td>${m.n}<span class="th-sub">of ${data.tasks.length}</span></td><td>${m.firsts}</td></tr>`;
    table.innerHTML = `<thead><tr><th>#</th><th class="model">Model</th><th>Average rank<span class="th-sub">lower is better</span></th><th>Tasks<span class="th-sub">ranked on</span></th><th>First places</th></tr></thead><tbody>${ranked.map((m, i) => row(m, place[i])).join("")}${few.map((m) => row(m, null)).join("")}</tbody>`;
    $(".board-scroll").hidden = false;
    fig.hidden = true;
    noteEl.innerHTML = `<span class="fn">Average rank: a model's rank on each task it was run on (equal scores share a rank), averaged over those tasks; RoboDojo and RoboCasa count as one task each. Models run on fewer than ${MIN_TASKS} tasks are listed last without a place.</span>Updated ${esc(data.updated)}.`;
  }

  function task(t) {
    $(".board-scroll").hidden = false;
    titleEl.textContent = t.track;
    leadEl.textContent = `${t.task}. Ranked by ${t.metrics[0].label} on the hidden test split.`;
    const ranks = ranksOf(t);
    const ms = t.metrics.filter((m) => !m.hidden);   // hidden: kept in the data, not shown as a column
    const body = t.rows.map((r, i) => {
      const values = ms.map((m, j) => `<td${j === 0 ? ' class="strong"' : ""}>${fmt(m.key, r.test[m.key])}</td>`).join("");
      return `<tr data-i="${i}" class="${ranks[i] === null ? "" : rankClass(ranks[i] - 1)}"><td>${rankBadge(ranks[i])}</td>${modelCell(r.model, r.weights, r.mark)}${values}<td class="vchange">${change(t.primary, r)}</td><td class="rounds">${r.rounds ?? "–"}${r.ended ? `<span class="ended">${esc(ENDED[r.ended] || r.ended)}</span>` : ""}</td></tr>`;
    }).join("");
    const metricHeads = ms.map((m) => `<th>${esc(m.label)}</th>`).join("");
    table.innerHTML = `<thead><tr class="table-band"><th colspan="2" class="band-l">Methods</th><th colspan="${ms.length}">Hidden test metrics</th><th>Validation</th><th>Run depth</th></tr><tr><th>#</th><th class="model">Model</th>${metricHeads}<th>Start → best<span class="th-sub">${esc(t.metrics[0].label)}</span></th><th class="rounds">Rounds<span class="th-sub">ended by</span></th></tr></thead><tbody>${body}</tbody>`;
    drawCurves(t);
    noteEl.innerHTML = (t.footnotes || []).map((f) => `<span class="fn">${esc(f)}</span>`).join("") +
      (TIMES.has(t.primary) ? "Validation: the run's starting speedup and its best speedup over the rounds."
                            : "Validation: the run's starting score and its best score over the rounds, on the same 0–100 scale.") +
      " Each line ends at the last round its run reached.";
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
    const k = scale(t.primary);                      // curves are kept in the metric's own units
    const vals = series.flatMap((s) => s.pts.map((p) => k * p[1]));
    // round ticks on the 0-100 scale: a 1-2-2.5-5 step giving about four intervals, never below 0 or above 100
    const raw = Math.max((Math.max(...vals) - Math.min(...vals)) / 4, 0.5), e = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / e;
    const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
    const lo = Math.max(0, Math.floor(Math.min(...vals) / step) * step);
    const hi = Math.max(lo + step, Math.min(100, Math.ceil(Math.max(...vals) / step) * step));
    const X = (x) => L + (x / maxX) * (W - L - R);
    const Y = (v) => T + (1 - (k * v - lo) / (hi - lo)) * (H - T - B);
    let g = "";
    for (let j = 0; j <= Math.round((hi - lo) / step); j++) {
      const v = lo + j * step;
      const y = T + (1 - (v - lo) / (hi - lo)) * (H - T - B),
            lab = (Math.abs(v - Math.round(v)) < 1e-6 ? v.toFixed(0) : v.toFixed(1)) + (TIMES.has(t.primary) ? "×" : "");
      g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text class="ax" x="${L - 8}" y="${y + 4}" text-anchor="end">${lab}</text>`;
    }
    for (let x = 0; x <= maxX; x += maxX > 10 ? 5 : 2) g += `<text class="ax" x="${X(x)}" y="${H - 10}" text-anchor="middle">${x}</text>`;
    const lines = series.map((s) => {
      const end = s.pts[s.pts.length - 1];
      const c = COLORS[s.i % COLORS.length];
      return `<g class="ln" data-i="${s.i}"><path d="${smooth(s.pts.map(([x, v]) => [X(x), Y(v)]))}" stroke="${c}" pathLength="1"/><circle cx="${X(end[0])}" cy="${Y(end[1])}" r="3.5" fill="${c}"/></g>`;
    }).join("");
    svg.setAttribute("aria-label", `${t.track}: validation score over rounds`);
    svg.innerHTML = g + lines;
    legend.innerHTML = series.map((s) => `<li data-i="${s.i}"><span class="legend-line" style="--legend-color:${COLORS[s.i % COLORS.length]}"></span>${modelMark(s.r.model)}<span>${esc(s.r.model)}${markSup(s.r.mark)}</span></li>`).join("");
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
  function show(catId = "overview", taskId = null, push = true) {
    if (!cats.some((c) => c.id === catId)) catId = "overview";
    tabsEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.cat === catId)));
    if (catId === "overview") {
      overview();
    } else {
      const tasks = byCat[catId];
      if (!tasks.some((t) => t.id === taskId)) taskId = tasks[0].id;   // a category opens on its first task
      subEl.hidden = tasks.length < 2;
      subEl.innerHTML = tasks.map((t) => `<button type="button" role="tab" data-task="${t.id}">${esc(t.track)}</button>`).join("");
      subEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.task === taskId)));
      task(tasks.find((t) => t.id === taskId));
    }
    const board = $(".board");
    board.classList.remove("swap"); void board.offsetWidth; board.classList.add("swap");
    if (push) history.replaceState(null, "", catId === "overview" ? "#results" : `#results/${catId}/${taskId}`);
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
      rankOf = Object.fromEntries(d.tasks.map((t) => { const rk = ranksOf(t); return [t.id, Object.fromEntries(t.rows.flatMap((r, i) => (r.extra ? [] : [[r.model, rk[i]]])))]; }));
      byCat = {};
      d.tasks.forEach((t) => (byCat[t.category] = byCat[t.category] || []).push(t));
      const FIRST = ["robodojo", "robocasa"];                // shown first within their category
      Object.values(byCat).forEach((ts) => ts.sort((x, y) => (FIRST.includes(y.id) ? 1 : 0) - (FIRST.includes(x.id) ? 1 : 0)));
      cats = d.categories.filter((c) => byCat[c.id]);        // categories without tasks stay hidden
      tabsEl.innerHTML = [`<button type="button" role="tab" data-cat="overview">Overview</button>`,
        ...cats.map((c) => `<button type="button" role="tab" data-cat="${c.id}">${esc(c.name)}<span class="count">${byCat[c.id].length}</span></button>`)].join("");
      const fromHash = () => {
        const m = location.hash.match(/^#results(?:\/([\w-]+))?(?:\/([\w-]+))?/);
        if (m) show(m[1] || "overview", m[2] || null, false);
        return m;
      };
      if (fromHash()) root.scrollIntoView(); else show("overview", null, false);
      window.addEventListener("hashchange", () => { if (fromHash()) root.scrollIntoView({ behavior: "smooth" }); });
    })
    .catch(() => { titleEl.textContent = "Results"; leadEl.textContent = "Results could not be loaded."; });
})();
