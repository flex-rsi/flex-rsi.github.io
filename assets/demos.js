// Demos: before/after self-improvement, from data/demos.json.
(() => {
  const root = document.getElementById("demos");
  if (!root) return;
  const $ = (sel) => root.querySelector(sel);
  const tabsEl = $(".demo-tabs"), card = $(".demo"), stage = $(".demo-stage");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LETTERS = "ABCD";

  const ABOUT = {
    "active-search": "The agent turns its head inside a 360° scene to find an object or the way to go, in as few actions as possible.",
    "visual-search": "Questions about small details in large, high-resolution images.",
    "robot-control": "A dual-arm robot in simulation picks up four bottles and throws them into a dustbin, handing bottles between its arms when needed.",
    "3d-tracking": "Segment every object in several views of a scene and keep each object's identity consistent across views.",
  };
  const fmtScore = (p, v) => (p.metric === "accuracy" ? (100 * v).toFixed(1) + "%" : p.metric === "score" ? String(Math.round(v)) : v.toFixed(3));

  // ---------------------------------------------------------------- video helpers
  let inView = false, active = [];
  const playAll = () => { if (!reduced && inView) active.forEach((v) => v.play().catch(() => {})); };
  const pauseAll = () => active.forEach((v) => v.pause());
  const video = (src, poster, extra = "") =>
    `<video muted playsinline preload="metadata"${reduced ? " controls" : ""} poster="${esc(poster)}" src="${esc(src)}"${extra}></video>`;

  // Two replays of equal length play together: restart both when the first ends, and keep them in step.
  const pair = (a, b) => {
    const restart = () => { [a, b].forEach((v) => { v.pause(); v.currentTime = 0; }); setTimeout(playAll, 500); };
    a.addEventListener("ended", restart);
    b.addEventListener("ended", restart);
    a.addEventListener("timeupdate", () => { if (!b.paused && Math.abs(a.currentTime - b.currentTime) > 0.12) b.currentTime = a.currentTime; });
  };
  const loop = (v) => v.addEventListener("ended", () => { v.currentTime = 0; setTimeout(playAll, 400); });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((e) => { inView = e.isIntersecting; inView ? playAll() : pauseAll(); });
    }, { threshold: 0.25 }).observe(card);
  } else { inView = true; }

  // ---------------------------------------------------------------- panels
  const LEGEND = `<ul class="demo-legend">
    <li><svg viewBox="0 0 22 14"><rect x="1" y="1" width="20" height="12" fill="rgba(0,47,167,.27)" stroke="#002fa7" stroke-width="1.5" stroke-dasharray="4 3"/></svg>Target zone (counts as success)</li>
    <li><svg viewBox="0 0 22 14"><path d="M2 3q9-3 18 0v8q-9 3-18 0z" fill="none" stroke="#002fa7" stroke-width="2"/></svg>Current field of view</li>
    <li><svg viewBox="0 0 22 14"><path d="M3 9L19 5" stroke="#0b0d1a" stroke-width="3"/><path d="M3 9L19 5" stroke="#f4f4f1" stroke-width="1.4"/><circle cx="3" cy="9" r="2.6" fill="#f4f4f1" stroke="#0b0d1a" stroke-width="1"/><circle cx="19" cy="5" r="2.6" fill="#f4f4f1" stroke="#0b0d1a" stroke-width="1"/></svg>Views so far</li>
    <li><svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="5" fill="none" stroke="#002fa7" stroke-width="2"/><circle cx="11" cy="7" r="1.8" fill="#002fa7"/></svg>Submitted, hit</li>
    <li><svg viewBox="0 0 22 14"><path d="M6 2l10 10M16 2L6 12" stroke="#d23c2e" stroke-width="2"/></svg>Submitted, missed</li>
  </ul>`;

  const outcome = (r) => `<span class="${r.success ? "ok" : "no"}">${esc(r.outcome)} · ${r.steps} step${r.steps > 1 ? "s" : ""}</span>`;
  const KIND = { hos: "Object search", hps: "Path search" };

  function activeSearch(p) {
    let cur = 0;
    stage.innerHTML = `
      <div class="ep-task"><q></q><span class="ep-meta"></span></div>
      <div class="ab-row"><div class="ab-bar"><span class="lhs"><span class="ab-tag">Before</span>Starting solution</span><span class="rhs" data-o="before"></span></div>
        <div class="ab-video" data-v="before"></div></div>
      <div class="ab-row"><div class="ab-bar"><span class="lhs"><span class="ab-tag after">After</span>Self-improved solution</span><span class="rhs" data-o="after"></span></div>
        <div class="ab-video" data-v="after"></div></div>
      ${LEGEND}
      <div class="ep-strip" role="group" aria-label="Episodes">${p.episodes.map((e, i) =>
        `<button type="button" data-i="${i}" aria-pressed="${i === 0}"><img src="${esc(e.after.poster)}" alt="" loading="lazy"><span>${esc(e.scene)}<small>${e.split === "test" ? "Test" : "Validation"} · ${KIND[e.kind]}</small></span></button>`).join("")}</div>
      <p class="demo-note"><b>What the agent changed.</b> The starting solution asks the model for one turn at a time and often wanders, runs out of actions or submits too early.
        The self-improved solution draws an absolute angle grid onto every view, so the model can read off directions; it submits as soon as the target is in view,
        otherwise takes one well-chosen look (often straight behind), votes over three sampled answers, and for path search zooms in to fix the exact heading.</p>`;
    const show = (i) => {
      cur = i;
      const e = p.episodes[i];
      stage.querySelector(".ep-task q").textContent = e.task;
      stage.querySelector(".ep-meta").textContent = `${e.split === "test" ? "Test" : "Validation"} · ${KIND[e.kind]} · fewest ${e.fewest} step${e.fewest > 1 ? "s" : ""}`;
      ["before", "after"].forEach((w) => {
        stage.querySelector(`[data-o="${w}"]`).innerHTML = outcome(e[w]);
        stage.querySelector(`[data-v="${w}"]`).innerHTML = video(e[w].video, e[w].poster, ` aria-label="${w === "before" ? "Starting" : "Self-improved"} solution replay"`);
      });
      const [a, b] = ["before", "after"].map((w) => stage.querySelector(`[data-v="${w}"] video`));
      pair(a, b);
      active = [a, b];
      let ready = 0;
      const go = () => { if (++ready === 2) playAll(); };
      [a, b].forEach((v) => (v.readyState >= 3 ? go() : v.addEventListener("canplay", go, { once: true })));
      stage.querySelectorAll(".ep-strip button").forEach((btn) => btn.setAttribute("aria-pressed", String(+btn.dataset.i === i)));
    };
    stage.querySelector(".ep-strip").addEventListener("click", (ev) => {
      const btn = ev.target.closest("button");
      if (btn && +btn.dataset.i !== cur) show(+btn.dataset.i);
    });
    show(0);
  }

  function visualSearch(p) {
    const ans = (c, w) => {
      const k = c[w], ok = k === c.label, i = LETTERS.indexOf(k);
      const text = i >= 0 ? `(${k}) ${c.options[i]}` : "no answer";
      return `<span class="ab-tag${w === "after" ? " after" : ""}">${w === "after" ? "After" : "Before"}</span>
        <span class="opt ${ok ? "ok" : "no"}">${esc(text)}</span><span class="mark ${ok ? "ok" : "no"}">${ok ? "✓" : "×"}</span>`;
    };
    const pct = (f) => (100 * f < 0.1 ? (100 * f).toFixed(3) : (100 * f).toFixed(2)) + "%";
    stage.innerHTML = `<div class="vq-grid">${p.cards.map((c) => `
      <article class="vq">
        <div class="vq-media">
          <figure><img src="${esc(c.full)}" alt="" loading="lazy" style="aspect-ratio:${c.aspect}"><figcaption>${esc(c.source)} · ${c.image[0]}×${c.image[1]}</figcaption></figure>
          <figure class="zoom"><img src="${esc(c.zoom)}" alt="" loading="lazy"><figcaption>Target ${c.target[0]}×${c.target[1]} px · ${pct(c.fraction)}</figcaption></figure>
        </div>
        <h4>${esc(c.question)}</h4>
        <div class="vq-ans">${ans(c, "before")}${ans(c, "after")}</div>
      </article>`).join("")}</div>
      <p class="demo-note"><b>What the agent changed.</b> The starting solution shows the model the whole photo, shrunk to fit, and reads off its answer; the target can be a few dozen pixels wide.
        The self-improved solution first asks where the relevant objects are, re-locates them on full-resolution crops, and answers from enlarged crops next to the overview,
        voting when answers disagree. Boxes and zooms on this page are added for the reader: dataset annotations for V* Bench, drawn by hand for HR-Bench 8K.</p>`;
    active = [];
  }

  function robotControl(p) {
    const rounds = Object.fromEntries(p.rounds.map((r) => [r.id, r]));
    stage.innerHTML = `<div class="robot-pairs">${p.comparisons.map((pair) => {
      const before = rounds[pair.before], after = rounds[pair.after];
      const item = (r, label) => `<article class="robot-round">
        <div class="robot-round-head"><span class="robot-round-name">${esc(r.id)} <small>${label}</small></span>
          <span class="robot-round-rate ${r.successRate > 0 ? "ok" : "no"}">${Math.round(100 * r.successRate)}% <small>· ${r.successes}/${r.episodes} full successes</small></span></div>
        <figure class="robot-round-video">${video(r.video, r.poster, ` controls aria-label="${esc(r.id)} validation rollout, ${Math.round(100 * r.successRate)} percent full success"`)}</figure>
        <p class="robot-round-score">${esc(r.case)} · ${r.caseScore}/100 · ${r.caseSuccess ? "complete" : "partial"}</p>
        <p class="robot-round-summary">${esc(r.summary)}</p>
      </article>`;
      return `<section class="robot-pair">
        <div class="robot-pair-head"><span>Same validation case · ${esc(pair.case)}</span>
          <strong>${before.caseScore} <i>→</i> ${after.caseScore}</strong></div>
        <div class="robot-pair-clips">${item(before, "Before")} ${item(after, "After")}</div>
      </section>`;
    }).join("")}</div>
    <p class="demo-note"><b>Full success</b> means all four bottles are in the bin and the robot returns to its start pose. Each card shows the round-wide validation success rate and the score for the specific clip.</p>`;
    active = Array.from(stage.querySelectorAll("video"));
  }

  function tracking(p) {
    const L = p.layout;
    stage.innerHTML = `<div class="quad"><div class="quad-video"></div>
        <div class="quad-labels" style="grid-template-columns:repeat(${L.length},1fr)">${L.map((l) => `<span class="${l === "After" ? "after" : ""}">${esc(l)}</span>`).join("")}</div>
      </div>
      <p class="clip-line"><span class="ep-meta" data-k="about"></span><span class="ep-meta" data-k="score"></span></p>
      <div class="ep-strip ep-strip-wide" role="group" aria-label="Clips">${p.cases.map((c, i) =>
        `<button type="button" data-i="${i}" aria-pressed="${i === 0}"><img src="${esc(c.poster)}" alt="" loading="lazy"><span>${esc(c.scene)}<small>${c.split === "test" ? "Test" : "Val"} · ${c.before.toFixed(2)} → ${c.after.toFixed(2)}</small></span></button>`).join("")}</div>
      <p class="demo-note"><b>What the agent changed.</b> The starting solution clusters pixels by color in each view and links the pieces across views by color,
        so objects break apart and their identities jump from view to view. The self-improved solution segments every view with SAM 2.1 and links the segments
        across views by voting with VGGT's 3D reprojection and DINOv2 features, keeping one identity per object.
        Colors follow the scorer's matching to the ground truth; gray marks segments matched to no annotated object, including objects the ground truth leaves out.</p>`;
    let cur = -1;
    const show = (i) => {
      cur = i;
      const c = p.cases[i];
      stage.querySelector(".quad-video").innerHTML = video(c.video, c.poster, ` aria-label="${esc(c.scene)}: instance tracking before and after"`);
      stage.querySelector('[data-k="about"]').textContent = `${c.split === "test" ? "Test" : "Validation"} clip · ${c.views} views of one room · ${c.objects} annotated objects`;
      stage.querySelector('[data-k="score"]').innerHTML = `Tracking mIoU on this clip <span class="no">${c.before.toFixed(3)}</span> → <span class="ok">${c.after.toFixed(3)}</span>`;
      stage.querySelectorAll(".ep-strip button").forEach((btn) => btn.setAttribute("aria-pressed", String(+btn.dataset.i === i)));
      const v = stage.querySelector("video");
      loop(v);
      active = [v];
      v.readyState >= 3 ? playAll() : v.addEventListener("canplay", playAll, { once: true });
    };
    stage.querySelector(".ep-strip").addEventListener("click", (ev) => {
      const btn = ev.target.closest("button");
      if (btn && +btn.dataset.i !== cur) show(+btn.dataset.i);
    });
    show(0);
  }

  const RENDER = { "active-search": activeSearch, "visual-search": visualSearch, "robot-control": robotControl, "3d-tracking": tracking };

  function select(d, id) {
    const p = d.panels.find((x) => x.id === id);
    pauseAll();
    tabsEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.id === id)));
    $(".demo-title").textContent = p.name;
    $(".demo-sub").textContent = ABOUT[p.id] || "";
    if (p.id === "robot-control" && p.rounds?.length) {
      const first = p.rounds[0], last = p.rounds[p.rounds.length - 1];
      $(".demo-score").innerHTML = `${esc(d.model)} <b>${Math.round(100 * first.successRate)}%</b><span class="to">→</span><span class="after">${Math.round(100 * last.successRate)}%</span><span class="what">Validation full-success rate · ${esc(first.id)} → ${esc(last.id)}</span>`;
    } else {
      const what = `Test ${p.metric} · start → final`;
      $(".demo-score").innerHTML = `${esc(d.model)} <b>${fmtScore(p, p.before)}</b><span class="to">→</span><span class="after">${fmtScore(p, p.after)}</span><span class="what">${esc(what)}</span>`;
    }
    RENDER[p.id](p);
    card.classList.remove("swap");
    void card.offsetWidth;
    card.classList.add("swap");
  }

  fetch("data/demos.json")
    .then((r) => r.json())
    .then((d) => {
      const ORDER = ["active-search", "visual-search", "3d-tracking", "robot-control"];
      d.panels = d.panels.filter((p) => RENDER[p.id]).sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
      tabsEl.innerHTML = d.panels.map((p) => `<button type="button" role="tab" data-id="${p.id}">${esc(p.name)}</button>`).join("");
      tabsEl.addEventListener("click", (ev) => {
        const b = ev.target.closest("button");
        if (b && b.getAttribute("aria-selected") !== "true") select(d, b.dataset.id);
      });
      select(d, d.panels[0].id);
    })
    .catch(() => { root.hidden = true; });
})();
