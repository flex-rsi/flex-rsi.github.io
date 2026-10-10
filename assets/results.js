// Results section, built entirely from data/results.json so that categories and tasks can grow
// without changes here.
//   Overview   coverage: how many models, tasks and runs, and which tasks each model was run on
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
  const cov = document.createElement("div");
  cov.className = "cov";
  cov.hidden = true;
  $(".board-scroll").before(cov);
  const table = $("table.results"), fig = $(".curves-fig"), svg = $(".curves-plot"), legend = $(".legend"), noteEl = $(".board-note");

  const PCT = new Set(["accuracy", "acc_vstar", "acc_hrbench8k", "acc_starter", "acc_cooking", "acc_bike", "success", "hos_sr", "hps_sr", "success_rate"]);
  const fmt = (key, v) => {
    if (v === null || v === undefined) return "–";
    if (PCT.has(key)) return (100 * v).toFixed(1) + "%";
    if (key === "score") return String(Math.round(v));
    if (key === "avg_steps") return v.toFixed(2);
    return v.toFixed(3);
  };
  const fmtAxis = (key, v) => (key === "score" ? String(Math.round(v)) : PCT.has(key) ? (100 * v).toFixed(0) + "%" : v.toFixed(2));
  // validation change as absolute values, in the primary metric's own units: start → best (+delta)
  const change = (key, r) => {
    if (r.best === null || r.best === undefined) return "–";
    const v = (x) => fmt(key, x);
    if (r.start === null || r.start === undefined) return `<span class="to">best</span> <b>${v(r.best)}</b>`;
    const d = r.best - r.start;
    const dz = PCT.has(key) ? (100 * d).toFixed(1) + " pt" : key === "score" ? String(Math.round(d)) : d.toFixed(3);
    return `${v(r.start)} <span class="to">→</span> <b>${v(r.best)}</b><span class="delta${d > 0 ? "" : " flat"}">${d > 0 ? "+" : d < 0 ? "−" : "±"}${dz.replace("-", "")}</span>`;
  };
  const ENDED = { max_rounds: "round limit", budget_wall: "time budget", budget_usd: "cost budget", budget_gpu: "GPU budget",
                  budget_tokens: "token budget", val_calls: "validation budget", idle: "no further progress" };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tag = (w) => `<span class="wtag">${w === "open" ? "open" : "closed"}</span>`;

  // Provider marks are the SVGs from 4dcodebench.com/logos. GPT and GLM are drawn in black
  // ("mono"); the others keep their brand colours.
  const LOGOS = [[/claude|sonnet|opus|fable|haiku/, "claude"], [/qwen/, "qwen"], [/gemini/, "gemini"], [/gemma/, "gemma"],
                 [/gpt|openai/, "gpt"], [/minimax/, "minimax"], [/\bglm\b/, "glm"], [/deepseek/, "deepseek"],
                 [/mistral/, "mistral"], [/mimo/, "mimo"]];
  const MONO = new Set(["gpt", "glm"]);
  function modelMark(name) {
    const n = name.toLowerCase();
    const hit = LOGOS.find(([re]) => re.test(n));
    if (!hit) return '<span class="model-icon" aria-hidden="true"></span>';
    const f = hit[1];
    return `<span class="model-icon" aria-hidden="true"><img${MONO.has(f) ? ' class="mono"' : ""} src="assets/model-logos/${f}.svg" alt="" loading="lazy" decoding="async"></span>`;
  }
  function modelCell(model, weights) {
    return `<td class="model"><div class="mcell">${modelMark(model)}<span class="model-name">${esc(model)}</span>${tag(weights)}</div></td>`;
  }
  function rankBadge(rank) {
    const medal = rank <= 3 ? ` medal medal-${rank}` : "";
    return `<span class="rank-badge${medal}">${String(rank).padStart(2, "0")}</span>`;
  }
  function rankClass(i, partial = false) {
    const classes = [];
    if (i < 3) classes.push("podium", `podium-${i + 1}`);
    if (partial) classes.push("partial");
    return classes.join(" ");
  }

  const COLORS = ["var(--accent-1)", "var(--ink)", "#e0471b", "#00937c", "#b07700", "#7b4cc4", "#4787dd", "#c93f7c", "#5f8a1c"];

  let data, cats, byCat, rankOf;   // rankOf[taskId][model] = 1-based rank on that task

  // ---------- views ----------

  // Overview: who has been measured on what. Counts up top, then one bar per model built from one
  // segment per task it was run on, coloured by category; a segment opens that task's leaderboard.
  const CAT_COLOR = ["var(--accent-1)", "#6f8fe8", "var(--ink)", "#b07700", "#00937c", "#7b4cc4", "#c93f7c"];
  const catColor = (id) => CAT_COLOR[cats.findIndex((c) => c.id === id) % CAT_COLOR.length];
  function overview() {
    titleEl.textContent = "Overview";
    leadEl.textContent = "Which frontier models have been run on which tasks so far. Standings are kept per task, so a model is only compared where it was measured: open a category for its rankings and improvement curves.";
    subEl.hidden = true;
    const models = new Map();
    data.tasks.forEach((t) => t.rows.forEach((r) => {
      const m = models.get(r.model) || { model: r.model, weights: r.weights, tasks: [] };
      m.tasks.push(t);
      models.set(r.model, m);
    }));
    const order = (t) => cats.findIndex((c) => c.id === t.category) * 100 + data.tasks.indexOf(t);
    const rows = [...models.values()].map((m) => ({ ...m, tasks: m.tasks.sort((x, y) => order(x) - order(y)) }))
      .sort((x, y) => y.tasks.length - x.tasks.length || x.model.localeCompare(y.model));
    const total = data.tasks.length, runs = data.tasks.reduce((n, t) => n + t.rows.length, 0);
    const rounds = data.tasks.reduce((n, t) => n + t.rows.reduce((k, r) => k + (r.rounds || 0), 0), 0);
    const stat = (n, label) => `<div class="cov-stat"><b data-n="${n}">0</b><span>${label}</span></div>`;
    const ticks = Array.from({ length: total + 1 }, (_, k) => `<span style="left:${(100 * k) / total}%">${k}</span>`).join("");
    cov.innerHTML = `
      <div class="cov-stats">${stat(rows.length, "frontier models")}${stat(total, "tasks")}${stat(cats.length, "categories")}${stat(runs, "model × task runs")}${stat(rounds, "total RSI rounds")}</div>
      <div class="cov-head"><span>Tasks each model has been run on</span>
        <ul class="cov-legend">${cats.map((c) => `<li><i style="background:${catColor(c.id)}"></i>${esc(c.name)}</li>`).join("")}</ul></div>
      <div class="cov-chart">
        <div class="cov-axis"><span class="cov-axis-pad"></span><div class="cov-ticks">${ticks}</div><span class="cov-axis-n"></span></div>
        ${rows.map((r, i) => `<div class="cov-row" style="--i:${i}">
          <div class="cov-model">${modelMark(r.model)}<span class="model-name">${esc(r.model)}</span>${tag(r.weights)}</div>
          <div class="cov-track"><div class="cov-bar">${r.tasks.map((t) =>
            `<button type="button" class="cov-seg" data-cat="${t.category}" data-task="${t.id}" style="width:${100 / total}%;--c:${catColor(t.category)}" title="${esc(t.track)} · ${esc(r.model)} ranked ${rankOf[t.id][r.model]} of ${t.rows.length}"><span>${esc(t.track)}</span></button>`).join("")}</div></div>
          <div class="cov-n"><b>${r.tasks.length}</b>/${total}</div>
        </div>`).join("")}
      </div>`;
    cov.hidden = false;
    $(".board-scroll").hidden = true;
    fig.hidden = true;
    noteEl.textContent = `Hover a segment for that model's rank on the task; click it to open the task. Updated ${data.updated}.`;
    // replay the entrance: bars grow in turn, and the counts run up
    cov.classList.remove("play"); void cov.offsetWidth; cov.classList.add("play");
    const t0 = performance.now(), dur = reduced ? 0 : 900;
    const nums = [...cov.querySelectorAll(".cov-stat b")];
    const step = (now) => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3);
      nums.forEach((el) => (el.textContent = Math.round(e * +el.dataset.n)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function task(t) {
    cov.hidden = true;
    $(".board-scroll").hidden = false;
    titleEl.textContent = t.track;
    leadEl.textContent = `${t.task}. Ranked by ${t.metrics[0].label} on the hidden test split.`;
    const body = t.rows.map((r, i) => {
      const values = t.metrics.map((m, j) => `<td${j === 0 ? ' class="strong"' : ""}>${fmt(m.key, r.test[m.key])}</td>`).join("");
      return `<tr data-i="${i}" class="${rankClass(i)}"><td>${rankBadge(i + 1)}</td>${modelCell(r.model, r.weights)}${values}<td class="vchange">${change(t.primary, r)}</td><td class="rounds">${r.rounds ?? "–"}${r.ended ? `<span class="ended">${esc(ENDED[r.ended] || r.ended)}</span>` : ""}</td></tr>`;
    }).join("");
    const metricHeads = t.metrics.map((m) => `<th>${esc(m.label)}</th>`).join("");
    table.innerHTML = `<thead><tr class="table-band"><th colspan="2" class="band-l">Methods</th><th colspan="${t.metrics.length}">Hidden test metrics</th><th>Validation</th><th>Run depth</th></tr><tr><th>#</th><th class="model">Model</th>${metricHeads}<th>Start → best<span class="th-sub">${esc(t.metrics[0].label)}</span></th><th class="rounds">Rounds<span class="th-sub">ended by</span></th></tr></thead><tbody>${body}</tbody>`;
    drawCurves(t);
    noteEl.textContent = "Validation: the run's starting score and its best score over the rounds, in the primary metric's units. Each line ends at the last round its run reached.";
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
    legend.innerHTML = series.map((s) => `<li data-i="${s.i}"><span class="legend-line" style="--legend-color:${COLORS[s.i % COLORS.length]}"></span>${modelMark(s.r.model)}<span>${esc(s.r.model)}</span></li>`).join("");
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
  cov.addEventListener("click", (e) => { const b = e.target.closest(".cov-seg"); if (b) show(b.dataset.cat, b.dataset.task); });
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
      const FIRST = ["robot-control"];                       // shown first within its category
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
      // the hero's track index: categories with tasks link to their leaderboard
      document.querySelectorAll(".hero-index a[data-cat]").forEach((a) => {
        const n = (byCat[a.dataset.cat] || []).length;
        if (!n) return;
        a.classList.add("live");
        a.href = `#results/${a.dataset.cat}`;
        a.querySelector(".hi-meta").textContent = `${n} task${n > 1 ? "s" : ""}`;
      });
    })
    .catch(() => { titleEl.textContent = "Results"; leadEl.textContent = "Results could not be loaded."; });
})();
