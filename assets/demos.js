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
    "robodojo": "A dual-arm robot in simulation with the model as its policy: the agent rewrites the control policy between rounds, and each episode is replayed with an earlier and a later round's policy.",
    "robocasa": "A mobile manipulator in a simulated kitchen with the model as its policy: the agent rewrites the control policy between rounds, and each episode is replayed with an earlier and a later round's policy.",
    "3d-tracking": "Segment every object in several views of a scene and keep each object's identity consistent across views.",
    "ego-exo-memory": "Memory questions about synchronized first-person (ego) and fixed-camera (exo) videos of cooking and bike repair.",
    "image-editing": "Edit a photo or painting to a written instruction, change only what it asks for, and keep everything else as it was.",
    "scene-from-photo": "Rebuild a furnished room from one photo as a 3D scene, every piece of furniture a whole object where the photo shows it. Compare any two versions side by side.",
    "robolab": "One generalist policy for many tabletop tasks. The same episode run by the starting and by the self-improved policy; only dev tasks are recorded on video.",
    "video-quality": "Judge how good videos look to people: score real user videos from 1 to 5, and pick the better of two AI-generated clips.",
    "arc-agi-2": "Grid puzzles: infer the rule from a few input–output examples and produce the output grid for a new input, with two guesses per test.",
    "arc-agi-3": "Interactive puzzle games with no instructions: the agent acts, works out the rules and the goal, and clears as many levels as it can within its limits.",
  };
  const fmtScore = (p, v) => (p.metric === "accuracy" ? (100 * v).toFixed(1) + "%" : p.metric === "scene score" ? v.toFixed(1) : p.metric === "score" ? String(Math.round(v)) : p.metric === "RHAE" ? v.toFixed(2) : v.toFixed(3));

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
    <li><svg viewBox="0 0 22 14"><rect width="22" height="14" fill="#33364a"/><rect x="4" y="3" width="14" height="8" fill="rgba(244,244,241,.18)" stroke="#f4f4f1" stroke-width="1.2" stroke-dasharray="3 2"/></svg>Target zone (counts as success)</li>
    <li><svg viewBox="0 0 22 14"><rect width="22" height="14" fill="#33364a"/><path d="M4 3.5q7-2 14 0v7q-7 2-14 0z" fill="none" stroke="#f4f4f1" stroke-width="1.5"/></svg>Current field of view</li>
    <li><svg viewBox="0 0 22 14"><rect width="22" height="14" fill="#33364a"/><path d="M5 9.5L17 4.5" stroke="#f4f4f1" stroke-width="1"/><circle cx="5" cy="9.5" r="1.8" fill="#f4f4f1"/><circle cx="17" cy="4.5" r="1.8" fill="#f4f4f1"/></svg>Views so far</li>
    <li><svg viewBox="0 0 22 14"><rect width="22" height="14" fill="#33364a"/><circle cx="11" cy="7" r="4.2" fill="none" stroke="#f4f4f1" stroke-width="1.5"/><circle cx="11" cy="7" r="1.6" fill="#f4f4f1"/></svg>Submitted, hit</li>
    <li><svg viewBox="0 0 22 14"><rect width="22" height="14" fill="#33364a"/><path d="M7.5 3.5l7 7M14.5 3.5l-7 7" stroke="#d23c2e" stroke-width="1.8"/></svg>Submitted, missed</li>
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

  // Robot control: one validation case run by an earlier and a later round. Each row is a figure: the
  // head camera at its own 4:3 with the decisive region boxed, and beside it, on the page, that region
  // enlarged (drawn from the same video into a canvas, so it never drifts), joined by hairline leaders.
  let robotStop = () => {};
  function robotControl(p) {
    robotStop();
    const row = (w) => `<section class="rb-row" data-w="${w}">
        <div class="rb-cam"><svg class="rb-box" preserveAspectRatio="none" aria-hidden="true"><rect/></svg></div>
        <div class="rb-side">
          <div class="rb-head"><span class="ab-tag${w === "after" ? " after" : ""}">${w === "after" ? "After" : "Before"}</span><span class="rb-round"></span></div>
          <p class="rb-score"></p>
          <figure class="rb-inset"><canvas></canvas><figcaption></figcaption></figure>
          <p class="rb-sum"></p>
        </div>
        <svg class="rb-lead" aria-hidden="true"></svg>
      </section>`;
    stage.innerHTML = `
      <div class="rb-case">
        <dl class="rb-facts"><div><dt>Benchmark</dt><dd data-f="benchmark"></dd></div><div><dt>Task</dt><dd data-f="task"></dd></div>
          <div><dt>Model</dt><dd data-f="model"></dd></div><div><dt>Episode</dt><dd data-f="case"></dd></div></dl>
      </div>
      <div class="rb-rows">${row("before")}${row("after")}</div>
      <div class="ep-strip" role="group" aria-label="Cases">${p.comparisons.map((c, i) =>
        `<button type="button" data-i="${i}" aria-pressed="${i === 0}"><img src="${esc(c.after.poster)}" alt="" loading="lazy"><span>${esc(c.task)}<small>${esc(c.benchmark)} · ${esc(c.model)} · ${esc(c.before.round)} → ${esc(c.after.round)}</small></span></button>`).join("")}</div>
      <p class="demo-note"></p>`;
    const rows = [...stage.querySelectorAll(".rb-row")];
    let region = [0, 0, 1, 1], size = [640, 480], token = 0;

    // the enlarged region: copy it from the video on every frame, or from the poster until frames arrive
    const draw = (rowEl) => {
      const cv = rowEl.querySelector("canvas"), v = rowEl.querySelector("video"), img = rowEl._poster;
      const dpr = window.devicePixelRatio || 1, cw = Math.round(cv.clientWidth * dpr), ch = Math.round(cv.clientHeight * dpr);
      if (!cw || !ch) return;
      if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
      const src = v && v.readyState >= 2 ? v : img && img.complete && img.naturalWidth ? img : null;
      if (!src) return;
      const sx = (src.videoWidth || src.naturalWidth) / size[0], sy = (src.videoHeight || src.naturalHeight) / size[1];
      const ctx = cv.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      const g = rowEl._region || region;
      ctx.drawImage(src, g[0] * sx, g[1] * sy, g[2] * sx, g[3] * sy, 0, 0, cw, ch);
    };
    // a side with a `track` ([t, cx, cy] keyframes in source pixels) moves its box with the video,
    // easing between keyframes and staying inside the visible view
    const follow = (r) => {
      const tr = r._track, v = r.querySelector("video");
      if (!tr || !v) return false;
      const t = v.currentTime;
      let k = tr.findIndex((q) => q[0] > t);
      if (k < 0) k = tr.length;
      const a = tr[Math.max(0, k - 1)], b = tr[Math.min(tr.length - 1, k)];
      const f = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0, e = f * f * (3 - 2 * f);
      const [w, h] = region.slice(2), vw = r._view;
      const x = Math.min(vw[0] + vw[2] - w, Math.max(vw[0], a[1] + (b[1] - a[1]) * e - w / 2));
      const y = Math.min(vw[1] + vw[3] - h, Math.max(vw[1], a[2] + (b[2] - a[2]) * e - h / 2));
      r._region = [x, y, w, h];
      const rect = r.querySelector(".rb-box rect");
      rect.setAttribute("x", x.toFixed(1)); rect.setAttribute("y", y.toFixed(1));
      return true;
    };
    const tick = (t) => () => {
      if (t !== token) return;
      if (rows.map(follow).some(Boolean)) lead();
      rows.forEach(draw);
      requestAnimationFrame(tick(t));
    };

    // leaders from the box's right corners to the inset's left corners: white over the video, ink over the page
    const lead = () => rows.forEach((r) => {
      const svg = r.querySelector(".rb-lead"), R = r.getBoundingClientRect();
      const b = r.querySelector(".rb-box rect").getBoundingClientRect(), c = r.querySelector(".rb-cam").getBoundingClientRect();
      const i = r.querySelector(".rb-inset canvas").getBoundingClientRect();
      if (i.left < c.right) { svg.innerHTML = ""; return; }      // stacked on a phone: no leaders
      const P = (x, y) => `${(x - R.left).toFixed(1)} ${(y - R.top).toFixed(1)}`;
      const d = `M${P(b.right, b.top)}L${P(i.left, i.top)}M${P(b.right, b.bottom)}L${P(i.left, i.bottom)}`;
      const id = `rbclip-${r.dataset.w}`;
      svg.setAttribute("viewBox", `0 0 ${R.width} ${R.height}`);
      svg.innerHTML = `<defs><clipPath id="${id}"><rect x="${c.left - R.left}" y="${c.top - R.top}" width="${c.width}" height="${c.height}"/></clipPath></defs>
        <path d="${d}" class="ink"/><path d="${d}" class="on-video" clip-path="url(#${id})"/>`;
    });
    const ro = "ResizeObserver" in window ? new ResizeObserver(() => { lead(); rows.forEach(draw); }) : null;
    if (ro) rows.forEach((r) => ro.observe(r));
    robotStop = () => { token++; if (ro) ro.disconnect(); };

    let cur = -1;
    const show = (i) => {
      cur = i;
      const c = p.comparisons[i];
      region = c.region; size = c.size || size;
      // every replay shows at 4:3 so the rows line up; a taller video is cropped to `view` (x, y, w, h)
      const view = c.view || [0, 0, size[0], size[1]];
      ["benchmark", "task", "model", "case"].forEach((k) => (stage.querySelector(`[data-f="${k}"]`).textContent = c[k]));
      const zoom = ((c.view ? c.view[2] : size[0]) / region[2]).toFixed(1).replace(/\.0$/, "");
      [[rows[0], c.before], [rows[1], c.after]].forEach(([r, rd]) => {
        const ok = rd.outcome === "Success";
        r.querySelector(".rb-round").textContent = `Round ${rd.round.replace(/^R0*(?=\d)/, "")}`;
        r.querySelector(".rb-score").innerHTML = `<b class="${ok ? "ok" : "no"}">${rd.outcome}</b>${rd.score !== undefined ? `<span class="of">${rd.score}/100</span>` : ""}`;
        r.querySelector(".rb-sum").textContent = rd.summary;
        const sp = rd.speed ?? c.speed;   // a side may play at its own speed
        r.querySelector(".rb-inset figcaption").textContent = `${c.focus} · ${zoom}×${sp && sp !== 1 ? ` · played ${sp}× speed` : ""}`;
        const cam = r.querySelector(".rb-cam");
        cam.querySelector("video")?.remove();
        cam.insertAdjacentHTML("afterbegin", video(rd.video, rd.poster, ` aria-label="${esc(c.model)}, ${esc(c.task)}, ${esc(rd.round)}: ${esc(rd.outcome)}"`));
        const box = cam.querySelector(".rb-box");
        box.setAttribute("viewBox", view.join(" "));
        const v = cam.querySelector("video"), ex = size[1] - view[3], ey = size[0] - view[2];
        v.style.objectPosition = `${ey ? (100 * view[0]) / ey : 50}% ${ex ? (100 * view[1]) / ex : 50}%`;
        ["x", "y", "width", "height"].forEach((k, j) => box.querySelector("rect").setAttribute(k, region[j]));
        r._track = rd.track || null;
        r._view = view;
        r._region = rd.track ? null : region;
        r._poster = new Image();
        r._poster.onload = () => draw(r);
        r._poster.src = rd.poster;
      });
      stage.querySelector(".demo-note").innerHTML = `<b>What the agent changed.</b> ${esc(c.changed || "")} The box and its enlargement are added for the reader.${c.note ? ` ${esc(c.note)}` : ""}`;
      const [a, b] = rows.map((r) => r.querySelector("video"));
      pair(a, b);
      active = [a, b];
      let ready = 0;
      const go = () => { if (++ready === 2) playAll(); };
      [a, b].forEach((v) => (v.readyState >= 3 ? go() : v.addEventListener("canplay", go, { once: true })));
      stage.querySelectorAll(".ep-strip button").forEach((btn) => btn.setAttribute("aria-pressed", String(+btn.dataset.i === i)));
      token++;
      requestAnimationFrame(tick(token));
      requestAnimationFrame(lead);
    };
    stage.querySelector(".ep-strip").addEventListener("click", (ev) => {
      const btn = ev.target.closest("button");
      if (btn && +btn.dataset.i !== cur) show(+btn.dataset.i);
    });
    show(0);
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

  // Ego-Exo Memory: one question at a time. Before: the frames the starting solution saw (8 per view, evenly
  // spaced). After: the seconds the self-improved solution chose to look at in high resolution, both views.
  function egoExo(p) {
    const opt = (c, k) => { const i = LETTERS.indexOf(k); return i >= 0 ? `(${k}) ${c.options[i]}` : "no answer"; };
    stage.innerHTML = `
      <div class="ep-task"><q></q><span class="ep-meta"></span></div>
      <div class="ab-row"><div class="ab-bar"><span class="lhs"><span class="ab-tag">Before</span><span data-k="bl"></span></span><span class="rhs" data-k="ba"></span></div>
        <figure class="ee-fig"><img data-k="bi" alt="Frames the starting solution saw"></figure></div>
      <div class="ab-row"><div class="ab-bar"><span class="lhs"><span class="ab-tag after">After</span><span data-k="al"></span></span><span class="rhs" data-k="aa"></span></div>
        <figure class="ee-fig"><img data-k="ai" alt="Frames the self-improved solution chose"></figure>
        <p class="ee-why"></p></div>
      <div class="ep-strip ep-strip-wide" role="group" aria-label="Questions">${p.cases.map((c, i) =>
        `<button type="button" data-i="${i}" aria-pressed="${i === 0}"><img src="${esc(c.after_img)}" alt="" loading="lazy"><span>${esc(c.category)}<small>${esc(c.family)}</small></span></button>`).join("")}</div>
      <p class="demo-note"><b>What the agent changed.</b> The starting solution shows the model 8 frames of each view, evenly spaced over the whole video, and answers in one call;
        the moment a question is about often falls between them. The self-improved solution first skims 32 time points in both views and names the seconds that matter,
        then looks at those seconds at high resolution in both views before it answers.</p>`;
    let cur = -1;
    const $s = (k) => stage.querySelector(`[data-k="${k}"]`);
    const show = (i) => {
      cur = i;
      const c = p.cases[i];
      stage.querySelector(".ep-task q").textContent = c.question;
      stage.querySelector(".ep-meta").textContent = `Test · ${c.family} · ${c.category} · ${c.duration} s video`;
      $s("bl").textContent = "8 frames per view, evenly spaced";
      $s("al").textContent = `Chose to look closely at ${c.shown_seconds.join(", ")} s`;
      $s("ba").innerHTML = `<span class="no">${esc(opt(c, c.before))} ×</span>`;
      $s("aa").innerHTML = `<span class="ok">${esc(opt(c, c.after))} ✓</span>`;
      $s("bi").src = c.before_img;
      $s("ai").src = c.after_img;
      stage.querySelector(".ee-why").textContent = c.reason ? `“${c.reason}”` : "";
      stage.querySelectorAll(".ep-strip button").forEach((btn) => btn.setAttribute("aria-pressed", String(+btn.dataset.i === i)));
    };
    stage.querySelector(".ep-strip").addEventListener("click", (ev) => {
      const btn = ev.target.closest("button");
      if (btn && +btn.dataset.i !== cur) show(+btn.dataset.i);
    });
    show(0);
    active = [];
  }

  // Image editing: the source image and the two outputs side by side, each output with its score.
  // Image editing: for each output a comparison slider over the input (input left of the divider, the
  // output right of it). The two sliders move together, and sweep once when a case is opened.
  let ieStop = () => {};
  function imageEdit(p) {
    const col = (k, tag, label) => `
      <figure class="ie-col"><div class="ab-bar"><span class="lhs">${tag}<span>${label}</span></span><span class="rhs" data-k="${k}s"></span></div>
        <div class="ie-cmp" data-k="${k}c"><img class="ie-out" data-k="${k}" alt=""><img class="ie-in" data-k="${k}i" alt="">
          <span class="ie-line" aria-hidden="true"><span class="ie-knob"></span></span>
          <span class="ie-chip l" aria-hidden="true">Input</span><span class="ie-chip r" aria-hidden="true">Output</span>
          <input class="ie-range" type="range" min="0" max="100" step="0.1" value="50" aria-label="Divider between input and ${label.toLowerCase()} output"></div>
        <figcaption data-k="${k}n"></figcaption></figure>`;
    stage.innerHTML = `
      <div class="ep-task"><q></q><span class="ep-meta"></span></div>
      <p class="ie-type"></p>
      <div class="ie-grid">${col("b", `<span class="ab-tag">Before</span>`, "Starting solution")}${col("a", `<span class="ab-tag after">After</span>`, "Self-improved")}</div>
      <p class="ie-hint">Drag across either image: the input is left of the divider, the output right of it. Both dividers move together.</p>
      <div class="ep-strip ep-strip-wide ie-strip" role="group" aria-label="Edits">${p.cases.map((c, i) =>
        `<button type="button" data-i="${i}" aria-pressed="${i === 0}"><img src="${esc(c.thumb)}" alt="" loading="lazy"><span>${esc(c.kind)}<small>${esc(c.family)}</small></span></button>`).join("")}</div>
      <p class="demo-note"><b>What the agent changed.</b> The starting solution passes the instruction unchanged to Qwen-Image-Edit-2509 with an 8-step Lightning LoRA and keeps its one output.
        The self-improved solution moves to Qwen-Image-2.1 at 40 steps. For reasoning and compound instructions it first has the editor's own vision-language encoder rewrite the request into an explicit edit
        (which object, the exact text to write, what a week of ripening looks like). It then puts the result back onto the source photo, so regions the edit did not touch keep their original pixels and texture,
        generates four seeds and lets Qwen3-VL-32B pick one by pairwise preference. Scores are the benchmark's per-image score (0 to 1, judge and programmatic checks); the notes summarize the judge's reasons.</p>`;
    const grid = stage.querySelector(".ie-grid");
    const ranges = [...stage.querySelectorAll(".ie-range")];
    const setX = (x) => { grid.style.setProperty("--x", x + "%"); ranges.forEach((r) => (r.value = x)); };
    let raf = 0;
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    ieStop = stop;
    // one sweep: input fully shown, divider runs to the left edge (output fully shown), settles in the middle
    const sweep = () => {
      stop();
      if (reduced) { setX(50); return; }
      const keys = [[0, 100], [500, 100], [1700, 0], [2300, 0], [3100, 50]];
      const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
      let t0 = 0;
      const step = (now) => {
        t0 = t0 || now;
        const t = now - t0;
        const j = keys.findIndex(([k]) => k > t);
        if (j < 0) { setX(50); raf = 0; return; }
        const [ta, xa] = keys[j - 1], [tb, xb] = keys[j];
        setX(xa + (xb - xa) * ease((t - ta) / (tb - ta)));
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    ranges.forEach((r) => {
      r.addEventListener("pointerdown", stop);
      r.addEventListener("input", () => { stop(); setX(+r.value); });
    });
    let cur = -1;
    const $s = (k) => stage.querySelector(`[data-k="${k}"]`);
    const show = (i) => {
      cur = i;
      const c = p.cases[i];
      const [w, h] = c.aspect.split("/").map(Number);
      stage.querySelector(".ep-task q").textContent = c.instruction;
      stage.querySelector(".ep-meta").textContent = `Test · ${c.family}`;
      stage.querySelector(".ie-type").textContent = `${c.kind}: ${c.about}`;
      ["b", "a"].forEach((k) => {
        $s(k + "c").style.aspectRatio = c.aspect;
        $s(k + "c").style.width = `min(100%, ${Math.round((520 * w) / h)}px)`;   // portrait images stay at most 520 px tall
        $s(k).src = c[k === "b" ? "before_img" : "after_img"];
        $s(k + "i").src = c.in_img;
      });
      $s("bs").innerHTML = `<span class="no">${c.before_score.toFixed(2)}</span>`;
      $s("as").innerHTML = `<span class="ok">${c.after_score.toFixed(2)}</span>`;
      $s("bn").textContent = c.before_note;
      $s("an").textContent = c.after_note;
      stage.querySelectorAll(".ep-strip button").forEach((btn) => btn.setAttribute("aria-pressed", String(+btn.dataset.i === i)));
      sweep();
    };
    stage.querySelector(".ep-strip").addEventListener("click", (ev) => {
      const btn = ev.target.closest("button");
      if (btn && +btn.dataset.i !== cur) show(+btn.dataset.i);
    });
    setX(50);
    show(0);
    active = [];
  }

  // ARC-AGI-2: one puzzle at a time. The demonstrations, then each test input with the guesses of both solutions.
  const ARC = ["#000000", "#0074d9", "#ff4136", "#2ecc40", "#ffdc00", "#aaaaaa", "#f012be", "#ff851b", "#7fdbff", "#870c25"];
  const grid = (rows, max = 132) => {
    const h = rows.length, w = rows[0].length, c = Math.max(3, Math.min(14, Math.floor(max / Math.max(w, h))));
    const cells = rows.flatMap((r, y) => [...r].map((v, x) => `<rect x="${x}" y="${y}" width="1" height="1" fill="${ARC[+v]}"/>`)).join("");
    return `<svg class="arc-g" viewBox="0 0 ${w} ${h}" width="${w * c}" height="${h * c}" role="img" aria-label="${h} by ${w} grid">${cells}</svg>`;
  };
  function arcPuzzles(p) {
    const guesses = (gs) => (gs.length ? gs.map((g) => `<figure>${grid(g.grid)}<figcaption class="${g.ok ? "ok" : "no"}">${g.ok ? "✓" : "×"}</figcaption></figure>`).join("")
      : `<p class="arc-none no">No answer ×</p>`);
    stage.innerHTML = `
      <div class="ep-task"><span class="ep-meta"></span></div>
      <div class="arc-train"></div>
      <div class="arc-tests"></div>
      <div class="ep-strip ep-strip-wide arc-strip" role="group" aria-label="Puzzles">${p.cases.map((c, i) =>
        `<button type="button" data-i="${i}" aria-pressed="${i === 0}"><span class="arc-thumb">${grid(c.tests[0].input, 72)}</span><span>${esc(c.puzzle)}<small>${c.split === "test" ? "Test" : "Validation"} · ${c.tests.length} test${c.tests.length > 1 ? "s" : ""}</small></span></button>`).join("")}</div>
      <p class="demo-note"><b>What the agent changed.</b> The starting solution asks the model once for up to two output grids as bare JSON; a reply it cannot parse counts as no answer, as on 8b28cd80.
        The self-improved solution parses each test's guesses separately and asks again if any test came back empty. It also has the model write a Python transform,
        which it keeps only if the program reproduces every demonstration output; the direct guesses keep priority, and a verified program fills an empty slot or moves the guess it agrees with to first place.</p>`;
    let cur = -1;
    const show = (i) => {
      cur = i;
      const c = p.cases[i];
      stage.querySelector(".ep-meta").textContent = `${c.split === "test" ? "Test" : "Validation"} · puzzle ${c.puzzle} · ${c.train.length} demonstrations · ${c.tests.length} test${c.tests.length > 1 ? "s" : ""}`;
      stage.querySelector(".arc-train").innerHTML = c.train.map((t) => `<figure class="arc-pair">${grid(t.input, 96)}<span class="to">→</span>${grid(t.output, 96)}</figure>`).join("");
      stage.querySelector(".arc-tests").innerHTML = c.tests.map((t, k) => `
        <div class="arc-test">
          <div class="arc-col"><div class="ab-bar"><span class="lhs">${c.tests.length > 1 ? `Test ${k + 1} input` : "Test input"}</span></div>${grid(t.input)}</div>
          <div class="arc-col"><div class="ab-bar"><span class="lhs"><span class="ab-tag">Before</span>Starting solution</span></div><div class="arc-guesses">${guesses(t.before)}</div></div>
          <div class="arc-col"><div class="ab-bar"><span class="lhs"><span class="ab-tag after">After</span>Self-improved</span></div><div class="arc-guesses">${guesses(t.after)}</div></div>
        </div>`).join("");
      stage.querySelectorAll(".ep-strip button").forEach((btn) => btn.setAttribute("aria-pressed", String(+btn.dataset.i === i)));
    };
    stage.querySelector(".ep-strip").addEventListener("click", (ev) => {
      const btn = ev.target.closest("button");
      if (btn && +btn.dataset.i !== cur) show(+btn.dataset.i);
    });
    show(0);
    active = [];
  }

  // ARC-AGI-3: the level the starting solution got stuck on, played by both solutions from the same frame.
  function arcGames(p) {
    let cur = -1;
    stage.innerHTML = `
      <div class="ep-task"><span class="arc-game"></span><span class="ep-meta"></span></div>
      <div class="a3-grid">
        <div><div class="ab-bar"><span class="lhs"><span class="ab-tag">Before</span>Starting solution</span><span class="rhs" data-o="before"></span></div>
          <div class="a3-video" data-v="before"></div></div>
        <div><div class="ab-bar"><span class="lhs"><span class="ab-tag after">After</span>Self-improved</span><span class="rhs" data-o="after"></span></div>
          <div class="a3-video" data-v="after"></div></div>
      </div>
      <div class="ep-strip ep-strip-wide a3-strip" role="group" aria-label="Games">${p.episodes.map((e, i) =>
        `<button type="button" data-i="${i}" aria-pressed="${i === 0}"><img src="${esc(e.after.poster)}" alt="" loading="lazy"><span>${esc(e.game)}<small>${e.split === "test" ? "Test" : "Validation"} · level ${e.level}</small></span></button>`).join("")}</div>
      <p class="demo-note"><b>What the agent changed.</b> The starting solution sends the model the current frame and a short memory of its last actions, and plays the up to 8 actions it returns;
        in four of the five validation games it ran out of time or model calls. From round 1 the self-improved solution tells the model which pixels each action changed, drops unavailable actions,
        keeps clicks on the grid, restarts after GAME_OVER and stops before the limits. Later accepted rounds add one-line hints that appear only when they apply:
        three batches with no change, a level just cleared (write the rules down and reuse them), a GAME_OVER, most model calls used, and an action that redrew much of the screen.</p>`;
    const show = (i) => {
      cur = i;
      const e = p.episodes[i];
      stage.querySelector(".arc-game").textContent = `${e.game} · level ${e.level} of ${e.levels}`;
      stage.querySelector(".ep-meta").textContent = `${e.split === "test" ? "Test" : "Validation"} · levels cleared ${e.cleared[0]} → ${e.cleared[1]}`;
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

  // Video quality: a real user video scored against the people's mean opinion score (MOS) on a 1-5 scale,
  // or two AI-generated clips with the people's vote on one question; the starting and the self-improved
  // solution's answers side by side.
  function videoQuality(p) {
    stage.innerHTML = `
      <div class="ep-task"><q></q><span class="ep-meta"></span></div>
      <p class="vqd-prompt" hidden></p>
      <div class="vqd-body"></div>
      <div class="ep-strip ep-strip-wide vqd-strip" role="group" aria-label="Cases">${p.cases.map((c, i) =>
        `<button type="button" data-i="${i}" aria-pressed="${i === 0}"><img src="${esc(c.kind === "rate" ? c.poster : c.clips[0].poster)}" alt="" loading="lazy"><span>${
          c.kind === "rate" ? `${esc(c.category)}<small>Rate · people ${c.mos.toFixed(2)}</small>` : `${esc(c.question)}<small>Compare · AI clips</small>`}</span></button>`).join("")}</div>
      <p class="demo-note"><b>What the agent changed.</b> The starting solution shows the model 8 frames of a video and asks for a score from 1 to 5; for a pair it shows 6 frames of each clip and asks all three questions in one call.
        The self-improved solution adds a resolution prior to the score (+0.15 for each doubling of the pixel count over 640 × 360), and asks the pair questions one at a time:
        alignment with the prompt shown; artifacts and overall preference without the prompt, on 10 frames per clip, asked twice with A and B swapped, the two votes weighted by the confidence the model states.</p>`;
    const body = stage.querySelector(".vqd-body"), promptEl = stage.querySelector(".vqd-prompt");
    let cur = -1;
    const pos = (v) => `${(100 * (Math.min(5, Math.max(1, v)) - 1)) / 4}%`;
    const show = (i) => {
      cur = i;
      pauseAll();
      const c = p.cases[i];
      if (c.kind === "rate") {
        stage.querySelector(".ep-task q").textContent = "How good does this video look to people?";
        stage.querySelector(".ep-meta").textContent = `Test · real user video · ${c.category} · ${c.width} × ${c.height}`;
        promptEl.hidden = true;
        const span = (a, b, cls) => `<span class="vqd-err ${cls}" style="left:${pos(Math.min(a, b))};width:calc(${pos(Math.max(a, b))} - ${pos(Math.min(a, b))})"></span>`;
        body.innerHTML = `<div class="vqd-rate">
          <figure class="vqd-clip">${video(c.video, c.poster, " loop")}</figure>
          <div class="vqd-score">
            <div class="vqd-scale">
              ${span(c.mos, c.before, "no")}${span(c.mos, c.after, "ok")}
              <span class="vqd-mark people" style="left:${pos(c.mos)}"><i></i><b>People ${c.mos.toFixed(2)}</b></span>
              <span class="vqd-mark before" style="left:${pos(c.before)}"><i></i><b>Before ${c.before.toFixed(2)}</b></span>
              <span class="vqd-mark after" style="left:${pos(c.after)}"><i></i><b>After ${c.after.toFixed(2)}</b></span>
              <span class="vqd-axis">${[1, 2, 3, 4, 5].map((k) => `<span style="left:${pos(k)}">${k}</span>`).join("")}</span>
            </div>
            <dl class="vqd-read">
              <div><dt><span class="ab-tag">Before</span></dt><dd>${c.before.toFixed(2)} <span class="no">off by ${Math.abs(c.before - c.mos).toFixed(2)}</span></dd></div>
              <div><dt><span class="ab-tag after">After</span></dt><dd>${c.after.toFixed(2)} <span class="ok">off by ${Math.abs(c.after - c.mos).toFixed(2)}</span></dd></div>
            </dl>
          </div></div>`;
        const v = body.querySelector("video");
        active = [v];
        loop(v);
      } else {
        stage.querySelector(".ep-task q").textContent = c.question_text;
        stage.querySelector(".ep-meta").textContent = "Test · two AI-generated clips from one prompt";
        promptEl.hidden = false;
        promptEl.textContent = `Prompt: ${c.prompt}`;
        const pick = (who, k, mark) => `<div><dt>${who}</dt><dd>${k}${mark ? ` <span class="${mark === "✓" ? "ok" : "no"}">${mark}</span>` : ""}</dd></div>`;
        body.innerHTML = `<div class="vqd-pair">${c.clips.map((m, j) => {
            const k = "AB"[j];
            return `<figure class="vqd-clip${k === c.label ? " chosen" : ""}">${video(m.video, m.poster)}<figcaption><span class="vqd-ab">${k}</span>${k === c.label ? "<span class=\"vqd-people\">People's choice</span>" : ""}</figcaption></figure>`;
          }).join("")}</div>
          <dl class="vqd-read vqd-picks">
            ${pick("<span class=\"ab-tag\">People</span>", c.label, "")}
            ${pick("<span class=\"ab-tag\">Before</span>", c.before, c.before === c.label ? "✓" : "×")}
            ${pick("<span class=\"ab-tag after\">After</span>", c.after, c.after === c.label ? "✓" : "×")}
          </dl>`;
        const [a, b] = body.querySelectorAll("video");
        active = [a, b];
        pair(a, b);
      }
      stage.querySelectorAll(".vqd-strip button").forEach((btn) => btn.setAttribute("aria-pressed", String(+btn.dataset.i === i)));
      playAll();
    };
    stage.querySelector(".vqd-strip").addEventListener("click", (ev) => {
      const btn = ev.target.closest("button");
      if (btn && +btn.dataset.i !== cur) show(+btn.dataset.i);
    });
    show(0);
  }

  // ---------------------------------------------------------------- scene from photo: two synced 3D views
  // three.js r147 (assets/vendor/three-r147) loads the first time this panel opens. Each version's GLB carries UVs
  // projected from that version's own camera, so "Photo" maps the input photo onto it with a plain texture.
  let sceneStop = () => {};
  let threeReady = null;
  const loadScript = (src) => new Promise((ok, fail) => {
    const el = document.createElement("script");
    el.src = src; el.onload = ok; el.onerror = () => fail(new Error(src));
    document.head.append(el);
  });
  const loadThree = () => threeReady || (threeReady = loadScript("assets/vendor/three-r147/three.min.js").then(() =>
    Promise.all(["OrbitControls", "GLTFLoader"].map((n) => loadScript(`assets/vendor/three-r147/${n}.js`)))));
  function sceneViewer(p) {
    const PALETTE = ["#002fa7", "#d9822b", "#2e9e6a", "#c2185b", "#16a2b8", "#7a5cc6", "#e0a526", "#5d6d7e", "#7cb342", "#b4472f"];
    const isRoom = (n) => /^(wall|room|floor|ceiling)/.test(n);
    const label = Object.fromEntries(p.versions);
    const state = { sc: p.scenes[0], mode: "photo", room: true };
    const opts = (v) => p.versions.map(([k, l]) => `<option value="${k}"${k === v ? " selected" : ""}>${esc(l)}</option>`).join("");
    const pane = (side, v) => `<div class="s3-pane"><div class="s3-head"><label>${side} <select>${opts(v)}</select></label><span class="s3-stats"></span></div>
        <div class="s3-stage"><canvas></canvas><span class="s3-state">Loading…</span></div><ul class="s3-legend"></ul></div>`;
    stage.innerHTML = `<div class="s3-bar">
        <div class="s3-seg" role="group" aria-label="Shading"><button type="button" data-mode="photo" aria-pressed="true">Photo</button><button type="button" data-mode="object" aria-pressed="false">Pieces</button></div>
        <label class="s3-check"><input type="checkbox" checked> Room</label>
        <button type="button" class="s3-reset">Back to the photo's view</button></div>
      <div class="s3-panes">${pane("Left", "r4")}${pane("Right", "gt")}</div>
      <p class="s3-hint">Drag to orbit, scroll or pinch to zoom, right-drag or two fingers to pan; both views move together. The opening view is the photo's camera, where the projected photo looks like the photo itself: turn away to see the geometry. Click a piece to hide it.</p>
      <p class="s3-note"></p>
      <div class="ep-strip" role="group" aria-label="Dev scenes">${p.scenes.map((c, i) =>
        `<button type="button" data-i="${i}" aria-pressed="${i === 0}"><img src="${esc(c.photo)}" alt="" loading="lazy"><span>Scene ${esc(c.id)}<small>dev photo</small></span></button>`).join("")}</div>
      <p class="demo-note"><b>What the agent changed.</b> ${esc(p.changed)} ${esc(p.data)}</p>`;
    let alive = true, ro = null;
    const panes = [];
    sceneStop = () => {
      alive = false;
      if (ro) ro.disconnect();
      panes.forEach((q) => { q.controls.dispose(); q.renderer.dispose(); q.renderer.forceContextLoss(); });
    };
    loadThree().then(() => alive && init()).catch(() => stage.querySelectorAll(".s3-state").forEach((e) => (e.textContent = "The 3D viewer could not be loaded.")));

    function init() {
      const T = window.THREE, ASPECT = p.scenes[0].aspect;
      const loader = new T.GLTFLoader(), texLoader = new T.TextureLoader();
      const textures = {}, cache = new Map(), materials = new WeakMap();
      const photo = (c) => {
        if (!textures[c.id]) {
          const t = texLoader.load(c.photo, renderAll);
          t.flipY = false; t.encoding = T.sRGBEncoding; t.anisotropy = 4;
          textures[c.id] = t;
        }
        return textures[c.id];
      };
      const load = (c, ver) => {
        const key = c.id + "/" + ver;
        if (!cache.has(key)) cache.set(key, new Promise((ok, fail) => loader.load(c.versions[ver].glb, ok, undefined, fail)).then((g) => {
          const info = c.versions[ver].objects;
          let k = 0;
          g.scene.traverse((o) => {
            if (!o.isMesh) return;
            const name = o.name || (o.parent && o.parent.name) || "";
            const meta = info.find((x) => x.name === name || T.PropertyBinding.sanitizeNodeName(x.name) === name) || {};
            o.geometry.computeVertexNormals();
            const room = isRoom(meta.name || name), color = room ? "#b8bccc" : PALETTE[k++ % PALETTE.length];
            o.userData = { name: meta.name || name, room, color, facesIn: meta.faces_in || 0 };
            materials.set(o.geometry, { photo: new T.MeshBasicMaterial({ map: photo(c), side: T.DoubleSide }),
                                        object: new T.MeshLambertMaterial({ color, side: T.DoubleSide }) });
          });
          return g.scene;
        }));
        return cache.get(key);
      };

      const master = new T.PerspectiveCamera(50, ASPECT, 0.01, 200);
      stage.querySelectorAll(".s3-pane").forEach((el) => {
        const canvas = el.querySelector("canvas");
        const renderer = new T.WebGLRenderer({ canvas, antialias: true });
        renderer.outputEncoding = T.sRGBEncoding;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        const scene = new T.Scene();
        scene.add(new T.HemisphereLight(0xffffff, 0x51605b, 0.85));
        const cam = new T.PerspectiveCamera(50, ASPECT, 0.01, 200), sun = new T.DirectionalLight(0xffffff, 0.55);
        cam.add(sun); sun.position.set(0.4, 0.8, 0.2); scene.add(cam);
        panes.push({ el, canvas, renderer, scene, cam, controls: new T.OrbitControls(master, canvas), group: null, ver: null, hidden: new Set() });
      });
      panes[1].controls.target = panes[0].controls.target;
      panes.forEach((q) => q.controls.addEventListener("change", renderAll));

      function renderAll() {
        if (!alive) return;
        const bg = new T.Color(getComputedStyle(stage.querySelector(".s3-stage")).backgroundColor);
        panes.forEach((q) => {
          q.cam.position.copy(master.position); q.cam.quaternion.copy(master.quaternion);
          q.renderer.setClearColor(bg, 1);
          q.renderer.render(q.scene, q.cam);
        });
      }
      function resize() {
        panes.forEach((q) => {
          const w = q.canvas.parentElement.clientWidth, h = Math.round(w / ASPECT);
          q.renderer.setSize(w, h, false);
          q.cam.aspect = w / h; q.cam.updateProjectionMatrix();
        });
        renderAll();
      }
      ro = new ResizeObserver(resize);
      ro.observe(stage.querySelector(".s3-panes"));
      function resetView() {
        const d = state.sc.target || 3;
        master.position.set(0, 0, 0); master.up.set(0, 1, 0);
        panes[0].controls.target.set(0, 0, -d);
        master.lookAt(0, 0, -d);
        panes.forEach((q) => q.controls.update());
        renderAll();
      }
      function applyLook(q) {
        if (!q.group) return;
        q.group.traverse((o) => {
          if (!o.isMesh) return;
          o.material = materials.get(o.geometry)[state.mode];
          o.visible = !q.hidden.has(o.userData.name) && (state.room || !o.userData.room);
        });
      }
      function legend(q) {
        const ul = q.el.querySelector(".s3-legend");
        const items = [];
        if (q.group) q.group.traverse((o) => { if (o.isMesh && !o.userData.room) items.push(o.userData); });
        if (!items.length) { ul.innerHTML = `<li class="s3-empty">No furniture: only the room box</li>`; return; }
        ul.innerHTML = items.map((it) => {
          const tag = q.ver === "gt" ? "ground truth" : it.facesIn <= 500 ? `template · ${it.facesIn} faces` : "generated mesh";
          return `<li><button type="button" data-name="${esc(it.name)}" aria-pressed="${!q.hidden.has(it.name)}"><span class="sw" style="background:${it.color}"></span>${esc(it.name)}<span class="tag${it.facesIn <= 500 && q.ver !== "gt" ? " tpl" : ""}">${tag}</span></button></li>`;
        }).join("");
      }
      panes.forEach((q) => q.el.querySelector(".s3-legend").addEventListener("click", (ev) => {
        const b = ev.target.closest("button");
        if (!b) return;
        const n = b.dataset.name;
        q.hidden.has(n) ? q.hidden.delete(n) : q.hidden.add(n);
        b.setAttribute("aria-pressed", String(!q.hidden.has(n)));
        applyLook(q); renderAll();
      }));
      async function show(q, ver) {
        q.ver = ver;
        const c = state.sc, v = c.versions[ver];
        q.cam.fov = (2 * Math.atan(Math.tan((v.hfov * Math.PI) / 360) / ASPECT) * 180) / Math.PI;
        q.cam.updateProjectionMatrix();
        const st = q.el.querySelector(".s3-state");
        st.textContent = "Loading…"; st.hidden = false;
        const n = v.objects.filter((o) => !isRoom(o.name)).length;
        q.el.querySelector(".s3-stats").textContent = `${n} piece${n === 1 ? "" : "s"} · ${v.faces.toLocaleString("en")} faces`;
        try {
          const tmpl = await load(c, ver);
          if (!alive || q.ver !== ver || state.sc !== c) return;
          if (q.group) q.scene.remove(q.group);
          q.group = tmpl.clone(true);
          q.hidden = new Set();
          q.scene.add(q.group);
          applyLook(q); legend(q);
          st.hidden = true;
        } catch (e) {
          st.textContent = "Could not load this version.";
        }
        renderAll();
      }
      panes.forEach((q) => q.el.querySelector("select").addEventListener("change", (ev) => show(q, ev.target.value)));
      const selectScene = (i) => {
        state.sc = p.scenes[i];
        stage.querySelectorAll(".ep-strip button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.i === i)));
        stage.querySelector(".s3-note").textContent = state.sc.note || "";
        resetView();
        panes.forEach((q) => show(q, q.el.querySelector("select").value));
      };
      stage.querySelector(".ep-strip").addEventListener("click", (ev) => {
        const b = ev.target.closest("button");
        if (b && p.scenes[+b.dataset.i] !== state.sc) selectScene(+b.dataset.i);
      });
      stage.querySelector(".s3-seg").addEventListener("click", (ev) => {
        const b = ev.target.closest("button");
        if (!b) return;
        state.mode = b.dataset.mode;
        stage.querySelectorAll(".s3-seg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        panes.forEach(applyLook); renderAll();
      });
      stage.querySelector(".s3-check input").addEventListener("change", (ev) => { state.room = ev.target.checked; panes.forEach(applyLook); renderAll(); });
      stage.querySelector(".s3-reset").addEventListener("click", resetView);
      resize();
      selectScene(0);
    }
  }

  const RENDER = { "active-search": activeSearch, "visual-search": visualSearch, "robodojo": robotControl, "robocasa": robotControl, "3d-tracking": tracking, "ego-exo-memory": egoExo, "image-editing": imageEdit, "video-quality": videoQuality, "robolab": robotControl, "scene-from-photo": sceneViewer,
                   "arc-agi-2": arcPuzzles, "arc-agi-3": arcGames };

  function select(d, id) {
    const p = d.panels.find((x) => x.id === id);
    pauseAll();
    robotStop();
    ieStop();
    sceneStop(); sceneStop = () => {};
    tabsEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.id === id)));
    $(".demo-title").textContent = p.name;
    $(".demo-sub").textContent = ABOUT[p.id] || "";
    const what = p.what || `Test ${p.metric} · start → final`;
    if (p.id === "robodojo" || p.id === "robocasa") $(".demo-score").innerHTML = `${p.comparisons.length} episodes<span class="what">${new Set(p.comparisons.map((c) => c.model)).size} models · ${new Set(p.comparisons.map((c) => c.task)).size} tasks</span>`;
    else $(".demo-score").innerHTML = `${esc(d.model)} <b>${fmtScore(p, p.before)}</b><span class="to">→</span><span class="after">${fmtScore(p, p.after)}</span><span class="what">${esc(what)}</span>`;
    RENDER[p.id](p);
    card.classList.remove("swap");
    void card.offsetWidth;
    card.classList.add("swap");
  }

  fetch("data/demos.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((d) => {
      const ORDER = ["robodojo", "robocasa", "robolab", "scene-from-photo", "active-search", "arc-agi-3", "visual-search", "video-quality", "ego-exo-memory", "3d-tracking", "image-editing", "arc-agi-2"];
      d.panels = d.panels.filter((p) => RENDER[p.id]).sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
      tabsEl.innerHTML = d.panels.map((p) => `<button type="button" role="tab" data-id="${p.id}">${esc(p.name)}</button>`).join("");
      // the selected task is kept in the URL (demos.html#<task>), so the home page tiles can link straight to it
      // #robot-control, the tab before RoboDojo and RoboCasa had their own, opens RoboDojo
      const fromHash = () => { const h = decodeURIComponent(location.hash.slice(1)); return d.panels.find((p) => p.id === (h === "robot-control" ? "robodojo" : h))?.id; };
      tabsEl.addEventListener("click", (ev) => {
        const b = ev.target.closest("button");
        if (!b || b.getAttribute("aria-selected") === "true") return;
        select(d, b.dataset.id);
        history.replaceState(null, "", `#${b.dataset.id}`);
      });
      window.addEventListener("hashchange", () => { const id = fromHash(); if (id) select(d, id); });
      select(d, fromHash() || d.panels[0].id);
    })
    .catch(() => { root.hidden = true; });
})();
