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

  const PCT = new Set(["accuracy", "acc_vstar", "acc_hrbench8k", "acc_starter", "acc_cooking", "acc_bike", "pair_accuracy", "success", "hos_sr", "hps_sr", "success_rate", "success_t1", "success_t3", "success_t5"]);
  const DEC2 = new Set(["rhae", "rhae_starter"]);   // ARC-AGI-3 RHAE, 0 to 100
  const fmt = (key, v) => {
    if (v === null || v === undefined) return "–";
    if (PCT.has(key)) return (100 * v).toFixed(1) + "%";
    if (key === "score") return String(Math.round(v));
    if (key === "avg_steps" || DEC2.has(key)) return v.toFixed(2);
    return v.toFixed(3);
  };
  const fmtAxis = (key, v) => (key === "score" ? String(Math.round(v)) : PCT.has(key) ? (100 * v).toFixed(0) + "%" : v.toFixed(2));
  // validation change as absolute values, in the primary metric's own units: start → best (+delta)
  const change = (key, r) => {
    if (r.best === null || r.best === undefined) return "–";
    const v = (x) => fmt(key, x);
    if (r.start === null || r.start === undefined) return `<span class="to">best</span> <b>${v(r.best)}</b>`;
    const d = r.best - r.start;
    const dz = PCT.has(key) ? (100 * d).toFixed(1) + " pt" : key === "score" ? String(Math.round(d)) : d.toFixed(DEC2.has(key) ? 2 : 3);
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

  // Overview: who has been measured on what. Counts up top, then one bar per model built from one
  // segment per task it was run on, coloured by category; a segment opens that task's leaderboard.
  // Category colours from the page's palette, no black: Klein blue and three lighter steps of it, then a
  // warm sand (a taupe and a pale sand for categories still to come). Text is light on the two darkest.
  const CAT_COLOR = [["#002fa7", "#f4f4f1"], ["#4567d8", "#f4f4f1"], ["#93a9ef", "#0b0d1a"], ["#cdd7f7", "#0b0d1a"],
                     ["#ddd5c2", "#0b0d1a"], ["#a39d8c", "#0b0d1a"], ["#ecebe5", "#0b0d1a"]];
  const catPair = (id) => CAT_COLOR[Math.max(0, cats.findIndex((c) => c.id === id)) % CAT_COLOR.length];
  const catColor = (id) => catPair(id)[0];
  // Rows wider than the chart move sideways on their own, back and forth and all together: one shared
  // position f from 0 to 1, each row shifted by f times its own overflow; rows that fit stay still. The
  // rail below shows f. Dragging the rail or the rows, clicking the rail or scrolling sideways moves them
  // by hand, and they set off again a few seconds later; hovering the chart pauses them so a cell can be
  // clicked. With reduced motion they only move by hand.
  let covLoop = 0, covObs = [];
  function covMotion() {
    cancelAnimationFrame(covLoop);
    covObs.forEach((o) => o.disconnect());
    covObs = [];
    const mid = cov.querySelector(".cov-mid"), lanes = mid.querySelector(".cov-lanes");
    const rail = mid.querySelector(".cov-rail"), thumb = rail.firstElementChild;
    const bars = [...lanes.querySelectorAll(".cov-bar")];
    const SPEED = 55, REST = 1800, IDLE = 4000;   // px per second of the longest row; pause at each end; wait after a manual move
    let over = [], longest = 0, f = 0, dir = 1, hold = performance.now() + 2400, hover = false, inView = true, last = 0;
    const draw = () => {
      bars.forEach((b, i) => (b.style.translate = over[i] ? `${(-f * over[i]).toFixed(1)}px 0` : ""));
      rail.hidden = longest <= 1;
      if (rail.hidden) return;
      const w = Math.max(28, (rail.clientWidth * lanes.clientWidth) / (lanes.clientWidth + longest));
      thumb.style.width = w + "px";
      thumb.style.transform = `translateX(${(f * (rail.clientWidth - w)).toFixed(1)}px)`;
    };
    const measure = () => {
      over = bars.map((b) => Math.max(0, b.scrollWidth - lanes.clientWidth));   // a bar is as wide as its cells
      longest = Math.max(0, ...over);
      draw();
    };
    const set = (v) => { f = Math.min(1, Math.max(0, v)); hold = performance.now() + IDLE; draw(); };
    const step = (now) => {
      if (!mid.isConnected || cov.hidden) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (!reduced && inView && !hover && longest > 1 && now > hold) {
        f += (dir * SPEED * dt) / longest;
        if (f >= 1 || f <= 0) { f = Math.min(1, Math.max(0, f)); dir = -dir; hold = now + REST; }
        draw();
      }
      covLoop = requestAnimationFrame(step);
    };
    // the rail: drag the thumb, or click the rail to centre the thumb there
    const toX = (x) => { const room = rail.clientWidth - thumb.offsetWidth; set(room > 0 ? x / room : 0); };
    let grab = null;
    thumb.addEventListener("pointerdown", (e) => { grab = e.clientX - thumb.getBoundingClientRect().left; thumb.setPointerCapture(e.pointerId); e.preventDefault(); });
    thumb.addEventListener("pointermove", (e) => { if (grab !== null) toX(e.clientX - rail.getBoundingClientRect().left - grab); });
    thumb.addEventListener("pointerup", () => (grab = null));
    rail.addEventListener("pointerdown", (e) => { if (e.target === rail) toX(e.clientX - rail.getBoundingClientRect().left - thumb.offsetWidth / 2); });
    // the rows: drag sideways (a drag does not count as a click on a cell), or scroll sideways
    let drag = null;
    lanes.addEventListener("pointerdown", (e) => { if (longest > 1 && e.button === 0) drag = { x: e.clientX, f, moved: false, id: e.pointerId }; });
    lanes.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 5) { drag.moved = true; lanes.setPointerCapture(drag.id); lanes.classList.add("dragging"); }
      if (drag.moved) set(drag.f - dx / longest);
    });
    const endDrag = () => {
      if (drag && drag.moved) lanes.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); }, { capture: true, once: true });
      drag = null;
      lanes.classList.remove("dragging");
    };
    lanes.addEventListener("pointerup", endDrag);
    lanes.addEventListener("pointercancel", () => { drag = null; lanes.classList.remove("dragging"); });
    lanes.addEventListener("wheel", (e) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (!d || longest <= 1) return;
      e.preventDefault();
      set(f + d / longest);
    }, { passive: false });
    lanes.addEventListener("keydown", (e) => {
      const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (k && longest > 1) { e.preventDefault(); set(f + (k * 130) / longest); }
    });
    mid.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") hover = true; });
    mid.addEventListener("pointerleave", () => { hover = false; hold = Math.max(hold, performance.now() + 1200); });
    if ("ResizeObserver" in window) { const o = new ResizeObserver(measure); o.observe(lanes); covObs.push(o); }
    if ("IntersectionObserver" in window) {
      const o = new IntersectionObserver((es) => es.forEach((x) => (inView = x.isIntersecting)), { threshold: 0.2 });
      o.observe(mid); covObs.push(o);
    }
    measure();
    covLoop = requestAnimationFrame(step);
  }
  function overview() {
    titleEl.textContent = "Overview";
    leadEl.textContent = "Which frontier models have been run on which tasks so far. Standings are kept per task, so a model is only compared where it was measured: open a category for its rankings and improvement curves.";
    subEl.hidden = true;
    const models = new Map();
    data.tasks.forEach((t) => t.rows.filter((r) => !r.extra).forEach((r) => {
      const m = models.get(r.model) || { model: r.model, weights: r.weights, tasks: [] };
      m.tasks.push(t);
      models.set(r.model, m);
    }));
    const order = (t) => cats.findIndex((c) => c.id === t.category) * 100 + data.tasks.indexOf(t);
    const rows = [...models.values()].map((m) => ({ ...m, tasks: m.tasks.sort((x, y) => order(x) - order(y)) }))
      .sort((x, y) => y.tasks.length - x.tasks.length || x.model.localeCompare(y.model));
    const std = (t) => t.rows.filter((r) => !r.extra);
    const total = data.tasks.length, runs = data.tasks.reduce((n, t) => n + std(t).length, 0);
    const rounds = data.tasks.reduce((n, t) => n + std(t).reduce((k, r) => k + (r.rounds || 0), 0), 0);
    const stat = (n, label) => `<div class="cov-stat"><b data-n="${n}">0</b><span>${label}</span></div>`;
    cov.innerHTML = `
      <div class="cov-stats">${stat(rows.length, "frontier models")}${stat(total, "tasks")}${stat(cats.length, "categories")}${stat(runs, "model × task runs")}${stat(rounds, "total RSI rounds")}</div>
      <div class="cov-head"><span>Tasks each model has been run on</span>
        <ul class="cov-legend">${cats.map((c) => `<li><i style="background:${catColor(c.id)}"></i>${esc(c.name)}</li>`).join("")}</ul></div>
      <div class="cov-chart">
        <div class="cov-names">${rows.map((r, i) => `<div class="cov-model" style="--i:${i}">${modelMark(r.model)}<span class="model-name">${esc(r.model)}</span>${tag(r.weights)}</div>`).join("")}</div>
        <div class="cov-mid"><div class="cov-lanes" tabindex="0" aria-label="Tasks per model; rows that do not fit move sideways">${rows.map((r, i) =>
          `<div class="cov-lane" style="--i:${i}"><div class="cov-bar">${r.tasks.map((t) => {
            const [bg, fg] = catPair(t.category);
            return `<button type="button" class="cov-seg" data-cat="${t.category}" data-task="${t.id}" style="--c:${bg};--fg:${fg}" title="${esc(t.track)} · ${esc(r.model)} ranked ${rankOf[t.id][r.model]} of ${t.rows.length}"><span>${esc(t.track)}</span></button>`;
          }).join("")}</div></div>`).join("")}</div>
          <div class="cov-rail" hidden><span class="cov-thumb"></span></div></div>
        <div class="cov-counts">${rows.map((r, i) => `<div class="cov-n" style="--i:${i}"><b>${r.tasks.length}</b>/${total}</div>`).join("")}</div>
      </div>`;
    cov.hidden = false;
    covMotion();
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
    const ranks = ranksOf(t);
    const body = t.rows.map((r, i) => {
      const values = t.metrics.map((m, j) => `<td${j === 0 ? ' class="strong"' : ""}>${fmt(m.key, r.test[m.key])}</td>`).join("");
      return `<tr data-i="${i}" class="${ranks[i] === null ? "" : rankClass(ranks[i] - 1)}"><td>${rankBadge(ranks[i])}</td>${modelCell(r.model, r.weights, r.mark)}${values}<td class="vchange">${change(t.primary, r)}</td><td class="rounds">${r.rounds ?? "–"}${r.ended ? `<span class="ended">${esc(ENDED[r.ended] || r.ended)}</span>` : ""}</td></tr>`;
    }).join("");
    const metricHeads = t.metrics.map((m) => `<th>${esc(m.label)}</th>`).join("");
    table.innerHTML = `<thead><tr class="table-band"><th colspan="2" class="band-l">Methods</th><th colspan="${t.metrics.length}">Hidden test metrics</th><th>Validation</th><th>Run depth</th></tr><tr><th>#</th><th class="model">Model</th>${metricHeads}<th>Start → best<span class="th-sub">${esc(t.metrics[0].label)}</span></th><th class="rounds">Rounds<span class="th-sub">ended by</span></th></tr></thead><tbody>${body}</tbody>`;
    drawCurves(t);
    noteEl.innerHTML = (t.footnotes || []).map((f) => `<span class="fn">${esc(f)}</span>`).join("") +
      "Validation: the run's starting score and its best score over the rounds, in the primary metric's units. Each line ends at the last round its run reached.";
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
      rankOf = Object.fromEntries(d.tasks.map((t) => { const rk = ranksOf(t); return [t.id, Object.fromEntries(t.rows.flatMap((r, i) => (r.extra ? [] : [[r.model, rk[i]]])))]; }));
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
