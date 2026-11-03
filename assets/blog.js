// Flex-RSI blog: the figures of the tech report, drawn as SVG and animated when they scroll into view.
// Each animation is a pure function of time, render(t) with t in seconds, so that it can be replayed, paused off
// screen and inspected: blog.html?t=2.5 draws every figure at t = 2.5 s and stops. Charts are rebuilt at the width
// of their container, so text keeps its size on a phone. The numbers are those of the report.
(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const params = new URLSearchParams(location.search);
  const SEEK = params.has("t") ? Number(params.get("t")) : null;
  const NS = "http://www.w3.org/2000/svg";

  // ---------------------------------------------------------------- helpers
  const S = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const T = (parent, x, y, text, attrs = {}) => { const e = S("text", { x, y, ...attrs }, parent); e.textContent = text; return e; };
  const H = (tag, cls, parent, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  };
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const seg = (t, a, b) => clamp((t - a) / (b - a));           // progress of t through [a, b]
  const out3 = (u) => 1 - Math.pow(1 - u, 3);
  const inOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const outBack = (u) => { const c = 1.4; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
  const fmt = (v, d = 1) => v.toFixed(d);

  const C = {
    accent: "#002fa7", ink: "#0b0d1a", muted: "#5e6472", faint: "#a3a8b3", grid: "#e3e6ec", paper: "#fbfbf9",
    open: "#d98e04", light: "#b8c3e6", ok: "#002fa7", bad: "#9aa0ad",
    area: { Perception: "#0e8c7f", Reasoning: "#6c4ab6", Action: "#002fa7", Reconstruction: "#d98e04", Creation: "#d1495b" },
  };
  const LOGOS = [[/claude|opus|sonnet/i, "claude"], [/qwen/i, "qwen"], [/gemini/i, "gemini"], [/gemma/i, "gemma"],
                 [/gpt/i, "gpt"], [/minimax/i, "minimax"], [/glm/i, "glm"], [/deepseek/i, "deepseek"]];
  // provider colours of the report's figures; a second model of the same provider takes a lighter shade
  const BRAND = [[/claude|opus|sonnet/i, "#D97757"], [/gemini/i, "#3A7BEA"], [/gemma/i, "#5B8DEF"], [/gpt/i, "#2F3542"],
                 [/qwen/i, "#7A63D8"], [/deepseek/i, "#4D6BFE"], [/glm/i, "#2B3A8C"], [/minimax/i, "#E2367B"]];
  const SHADE = { "GPT-6 Astra": "#14A07E", "Claude Sonnet 5.5": "#E3A07F", "Gemini 3.8 Flash": "#7FA9F2", "Qwen3.8-27B": "#A797E6" };
  const brand = (name) => SHADE[name] || (BRAND.find(([re]) => re.test(name)) || [0, C.accent])[1];
  const logo = (name) => { const h = LOGOS.find(([re]) => re.test(name)); return h ? `assets/model-logos/${h[1]}.svg` : null; };

  // ---------------------------------------------------------------- data (from the report)
  const TASKS = [   // the 20 main tasks: area, what the agent produces, how an episode is scored
    ["Visual Search", "Perception", "answer"], ["Video Quality", "Perception", "answer"],
    ["Ego-Exo Memory", "Reasoning", "answer"], ["Kinematics", "Reasoning", "answer"], ["Mass", "Reasoning", "answer"],
    ["ARC-AGI-1", "Reasoning", "answer"], ["ARC-AGI-2", "Reasoning", "answer"], ["ARC-AGI-3", "Reasoning", "binary"],
    ["Active Search", "Action", "scale"], ["RoboLab", "Action", "scale"], ["LIBERO-MAX", "Action", "binary"],
    ["LIBERO-PRO", "Action", "binary"], ["RoboDojo", "Action", "scale"], ["RoboCasa", "Action", "binary"],
    ["3D Tracking", "Reconstruction", "scale"], ["Scene from Photo", "Reconstruction", "scale"],
    ["Scene from Video", "Reconstruction", "scale"], ["Image Editing", "Creation", "scale"],
    ["Multi-turn Editing", "Creation", "scale"], ["Video Generation", "Creation", "scale"],
  ];
  const AREA_OF = Object.fromEntries(TASKS.map(([n, a]) => [n, a]));
  const KIND_OF = Object.fromEntries(TASKS.map(([n, , k]) => [n, k]));

  // median starter and median best validation score over the models of each task
  const GAINS = {
    "Visual Search": [80.0, 86.9], "Video Quality": [78.2, 85.1], "Ego-Exo Memory": [63.7, 72.5], "Kinematics": [27.7, 43.7],
    "Mass": [47.2, 61.1], "ARC-AGI-1": [91.9, 94.4], "ARC-AGI-2": [82.5, 82.5], "ARC-AGI-3": [3.8, 4.1],
    "Active Search": [23.0, 52.7], "RoboLab": [8.3, 45.8], "LIBERO-MAX": [31.2, 37.5], "LIBERO-PRO": [50.0, 52.5],
    "RoboDojo": [0.1, 24.4], "RoboCasa": [0.0, 12.5], "3D Tracking": [19.4, 62.2], "Scene from Photo": [7.7, 38.0],
    "Scene from Video": [17.3, 18.5], "Image Editing": [56.9, 68.0], "Multi-turn Editing": [68.3, 71.6], "Video Generation": [69.1, 82.0],
  };
  // best minus worst model, at the start and at the best validation score reached
  const APART = {
    "Visual Search": [31.3, 22.5], "Video Quality": [23.5, 16.7], "Ego-Exo Memory": [27.5, 25.0], "Kinematics": [14.2, 33.1],
    "Mass": [6.0, 5.8], "ARC-AGI-1": [31.2, 32.5], "ARC-AGI-2": [38.8, 40.0], "RoboDojo": [0.9, 68.9],
    "Active Search": [30.8, 34.4], "RoboLab": [29.2, 62.5], "Image Editing": [4.6, 13.9], "Multi-turn Editing": [0.4, 2.3],
    "Video Generation": [1.0, 20.2], "3D Tracking": [0.0, 55.6], "Scene from Photo": [0.0, 50.6], "Scene from Video": [0.0, 38.8],
    "RoboCasa": [5.0, 58.8], "LIBERO-MAX": [0.0, 18.8], "LIBERO-PRO": [0.0, 25.0], "ARC-AGI-3": [39.0, 49.3],
  };
  const BOARD = [["Claude Opus 5.5", 91.6, 0], ["Gemini 4 Argon", 89.0, 0], ["GPT-6.1 Sol", 77.0, 0], ["GPT-6 Astra", 65.5, 0],
                 ["Qwen3.8-Flash-Next", 49.1, 1], ["Gemini 3.8 Flash", 42.8, 0], ["Claude Sonnet 5.5", 42.3, 0],
                 ["DeepSeek-V4.1 Flash", 41.5, 1], ["GLM-5.3 Flash", 34.7, 1], ["Qwen3.8-27B", 34.4, 1],
                 ["Gemma-4-31B-it", 13.7, 1], ["MiniMax-M3", 12.8, 1]];
  // best closed-source minus best open-weight test score; strict = checked by a simulator, an exact match or physics
  const GAP = [["RoboCasa", 50.0, "strict"], ["ARC-AGI-2", 49.2, "strict"], ["ARC-AGI-3", 43.3, "strict"], ["RoboLab", 40.3, "strict"],
               ["RoboDojo", 37.3, "strict"], ["Scene from Video", 36.4, "strict"], ["Scene from Photo", 26.5, "strict"],
               ["LIBERO-PRO", 10.0, "except"], ["ARC-AGI-1", 8.8, "strict"], ["Image Editing", 4.2, "judge"], ["Video Generation", 2.5, "judge"],
               ["Multi-turn Editing", 1.0, "judge"], ["Mass", 0.8, "judge"], ["Video Quality", 0.1, "judge"], ["LIBERO-MAX", 0.0, "except"]];
  const PAIRS = [
    ["RoboCasa · Open Drawer", "DeepSeek-V4.1 Flash", 0.0, 40.0], ["RoboCasa · Turn On Sink Faucet", "Qwen3.8-Flash-Next", 0.0, 20.0],
    ["RoboCasa · Turn On Sink Faucet", "Claude Opus 5.5", 80.0, 80.0], ["Active Search", "Qwen3.8-27B", 50.7, 69.0],
    ["Active Search", "Qwen3.8-Flash-Next", 21.0, 59.3], ["3D Tracking", "Qwen3.8-27B", 45.9, 52.4], ["3D Tracking", "Qwen3.8-Flash-Next", 56.9, 58.9],
  ];
  // median share of the run's validation gain reached by each round (rounds 0-15) and the middle half
  const ROUNDS = {
    Perception: { n: 22, med: [0, 0, .75, .914, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      lo: [0, 0, 0, .565, .886, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], hi: [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
    Reasoning: { n: 35, med: [0, 0, .735, .961, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      lo: [0, 0, 0, .53, .648, .761, .913, .965, .965, 1, 1, 1, 1, 1, 1, 1], hi: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
    Creation: { n: 27, med: [0, 0, .624, .733, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      lo: [0, 0, 0, .324, .806, .855, .983, .983, .983, .983, 1, 1, 1, 1, 1, 1], hi: [0, .528, .786, .975, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
    Action: { n: 44, med: [0, .132, .5, .666, .851, .889, .953, .982, 1, 1, 1, 1, 1, 1, 1, 1],
      lo: [0, 0, .284, .35, .603, .647, .767, .886, .936, .937, 1, 1, 1, 1, 1, 1], hi: [0, .611, .846, .953, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
    Reconstruction: { n: 22, med: [0, 0, .146, .463, .578, .667, .753, .886, .959, .959, 1, 1, 1, 1, 1, 1],
      lo: [0, 0, 0, 0, 0, .105, .427, .59, .595, .722, .919, 1, 1, 1, 1, 1], hi: [0, .34, .602, .831, .946, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  };

  // Claude Opus 5.5 on Scene from Photo: best validation score after each round
  const RUN = [7.7, 56.5, 56.5, 62.2, 67.8, 67.8, 67.8, 67.8, 67.8];

  // ---------------------------------------------------------------- animations: build(stage, width) -> { dur, render(t) }
  const ANIMS = {};

  // ================================================================ hero: the RSI loop and a real run
  ANIMS.loop = (stage, W) => {
    const wide = W >= 760;
    const DW = 540, DH = 400, CW = 500, CH = 400;           // design sizes of the two panels
    const s1 = wide ? Math.min(W * 0.52 / DW, 1.2) : W / DW;
    const s2 = wide ? Math.min((W - DW * s1) / CW, 1.2) : W / CW;
    const height = wide ? Math.max(DH * s1, CH * s2) : DH * s1 + CH * s2 + 8;
    const svg = S("svg", { viewBox: `0 0 ${W} ${height}`, width: W, height }, stage);
    const defs = S("defs", {}, svg);
    const mk = S("marker", { id: "arr", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
    S("path", { d: "M0,0 L10,5 L0,10 z", fill: C.ink }, mk);

    // --- diagram
    const g = S("g", { transform: `translate(${wide ? 0 : 0},0) scale(${s1})` }, svg);
    const ex = { x: 70, y: 30, w: 230, h: 72 }, im = { x: 70, y: 298, w: 230, h: 72 }, hn = { x: 92, y: 128, w: 186, h: 146 };
    const vx = 452, vy = 200, vr = 46;
    const P1 = "M300,62 C392,62 452,92 452,154", P2 = "M452,246 C452,318 392,334 300,334", P3 = "M185,298 L185,274", P4 = "M185,128 L185,102";
    const pathEls = [P1, P2, P3, P4].map((d) => S("path", { d, fill: "none", stroke: C.ink, "stroke-width": 1.5, "marker-end": "url(#arr)" }, g));
    T(g, 392, 52, "candidate", { class: "sm", "text-anchor": "middle" });
    T(g, 392, 356, "kept or reverted", { class: "sm", "text-anchor": "middle" });
    T(g, 198, 291, "edits", { class: "sm" });
    T(g, 198, 120, "runs", { class: "sm" });

    const exBox = S("rect", { x: ex.x, y: ex.y, width: ex.w, height: ex.h, fill: C.accent }, g);
    T(g, ex.x + 16, ex.y + 31, "EXECUTOR", { "font-size": 17, "font-weight": 800, fill: "#fff", "letter-spacing": "-0.01em" });
    T(g, ex.x + 16, ex.y + 52, "edits and tests the solution", { "font-size": 12.5, fill: "rgba(255,255,255,.82)" });
    const exBar = S("rect", { x: ex.x, y: ex.y + ex.h - 5, width: 0, height: 5, fill: "#fff", opacity: .75 }, g);

    S("rect", { x: im.x, y: im.y, width: im.w, height: im.h, fill: C.paper, stroke: C.ink, "stroke-width": 1.5 }, g);
    T(g, im.x + 16, im.y + 31, "IMPROVER", { "font-size": 17, "font-weight": 800, "letter-spacing": "-0.01em" });
    T(g, im.x + 16, im.y + 52, "reads the round, edits the harness", { "font-size": 12.5, fill: C.muted });
    const imBar = S("rect", { x: im.x, y: im.y + im.h - 5, width: 0, height: 5, fill: C.accent }, g);

    // harness card: the files the improver may edit
    S("rect", { x: hn.x, y: hn.y, width: hn.w, height: hn.h, fill: "#fff", stroke: C.ink, "stroke-width": 1.5 }, g);
    S("rect", { x: hn.x, y: hn.y, width: hn.w, height: 22, fill: C.ink }, g);
    const hnTitle = T(g, hn.x + 10, hn.y + 15, "HARNESS · v1", { class: "mono", "font-size": 11, fill: "#fff", "letter-spacing": "0.06em" });
    const FILES = ["executor_prompt.md", "tools/experiment.py", "workflow.py", "accept_rule.py", "lessons.md", "improver_prompt.md"];
    const lines = FILES.map((f, i) => {
      const y = hn.y + 30 + i * 19;
      const bg = S("rect", { x: hn.x + 1, y, width: hn.w - 2, height: 17, fill: "#14a07e", opacity: 0 }, g);
      const mark = T(g, hn.x + 8, y + 12.5, " ", { class: "mono", "font-size": 11, fill: "#0b7a5e", "font-weight": 600 });
      T(g, hn.x + 20, y + 12.5, f, { class: "mono", "font-size": 11, fill: C.ink });
      return { bg, mark };
    });
    const selfTag = T(g, hn.x + hn.w + 8, hn.y + 30 + 5 * 19 + 12.5, "edits itself", { class: "sm", fill: C.accent, opacity: 0 });

    // validation gate
    S("path", { d: `M${vx},${vy - vr} L${vx + vr},${vy} L${vx},${vy + vr} L${vx - vr},${vy} z`, fill: C.paper, stroke: C.ink, "stroke-width": 1.5 }, g);
    const gateFill = S("path", { d: `M${vx},${vy - vr} L${vx + vr},${vy} L${vx},${vy + vr} L${vx - vr},${vy} z`, fill: C.accent, opacity: 0 }, g);
    const gateTxt = T(g, vx, vy + 4.5, "VAL", { class: "mono", "font-size": 13, "text-anchor": "middle", "font-weight": 600 });
    const verdict = T(g, vx - vr - 12, vy - 4, "", { class: "mono", "font-size": 11.5, "text-anchor": "end", "font-weight": 700 });
    const verdict2 = T(g, vx - vr - 12, vy + 12, "", { class: "mono", "font-size": 11.5, "text-anchor": "end" });
    const roundLbl = T(g, 530, 30, "ROUND", { class: "mono", "font-size": 10.5, "text-anchor": "end", fill: C.muted, "letter-spacing": "0.08em" });
    const roundNum = T(g, 530, 66, "0", { "font-size": 38, "font-weight": 800, "text-anchor": "end", "letter-spacing": "-0.04em" });
    const reviewTag = T(g, 530, 86, "", { class: "mono", "font-size": 10.5, "text-anchor": "end", fill: C.accent });
    const token = S("rect", { x: -5, y: -5, width: 10, height: 10, fill: C.accent, opacity: 0 }, g);
    const lens = pathEls.map((p) => p.getTotalLength());

    // --- chart and reconstruction
    const ox = wide ? DW * s1 : 0, oy = wide ? 0 : DH * s1 + 8;
    const c = S("g", { transform: `translate(${ox},${oy}) scale(${s2})` }, svg);
    const L = 44, R = 480, TOP = 44, BOT = 196, Y = (v) => BOT - (v / 80) * (BOT - TOP), X = (r) => L + (r / 8) * (R - L);
    T(c, L, 18, "VALIDATION SCORE", { class: "mono", "font-size": 11, "letter-spacing": "0.08em" });
    T(c, L, 33, "Claude Opus 5.5 · Scene from Photo", { class: "sm" });
    const big = T(c, R, 34, "7.7", { "font-size": 30, "font-weight": 800, "text-anchor": "end", fill: C.accent, "letter-spacing": "-0.03em" });
    for (const v of [0, 20, 40, 60, 80]) {
      S("line", { x1: L, x2: R, y1: Y(v), y2: Y(v), class: "gridl" }, c);
      T(c, L - 8, Y(v) + 4, v, { class: "tick", "text-anchor": "end" });
    }
    for (let r = 0; r <= 8; r++) T(c, X(r), BOT + 16, r, { class: "tick", "text-anchor": "middle" });
    const step = S("path", { d: "", fill: "none", stroke: C.accent, "stroke-width": 2.5, "stroke-linejoin": "miter" }, c);
    const marks = RUN.map((v, r) => {
      const kept = r === 0 || v > RUN[r - 1];
      const m = kept ? S("rect", { x: -5, y: -5, width: 10, height: 10, fill: C.accent, opacity: 0 }, c)
                     : S("circle", { r: 4.5, fill: C.paper, stroke: C.faint, "stroke-width": 1.5, opacity: 0 }, c);
      return { m, kept };
    });
    S("circle", { r: 0 }, c);
    // thumbnails: the input photo and the current solution
    const tw = 212, th = 158, ty = 240;
    T(c, L, ty - 8, "INPUT PHOTO", { class: "mono", "font-size": 10.5, "letter-spacing": "0.08em", fill: C.muted });
    S("image", { href: "assets/blog/d027-photo.jpg", x: L, y: ty, width: tw, height: th, preserveAspectRatio: "xMidYMid slice" }, c);
    S("rect", { x: L, y: ty, width: tw, height: th, fill: "none", stroke: C.ink, "stroke-width": 1.5 }, c);
    const sx = L + tw + 24;
    const solLbl = T(c, sx, ty - 8, "SOLUTION · STARTER", { class: "mono", "font-size": 10.5, "letter-spacing": "0.08em", fill: C.muted });
    S("rect", { x: sx, y: ty, width: tw, height: th, fill: "#fff" }, c);
    const empty = S("g", {}, c);       // the starter returns an empty room box
    const bx = sx + 46, by = ty + 34, bw = 120, bh = 90, d = 26;
    S("path", { d: `M${bx},${by} h${bw} v${bh} h-${bw} z M${bx + d},${by - d * .6} h${bw} v${bh} M${bx},${by} l${d},-${d * .6} M${bx + bw},${by} l${d},-${d * .6} M${bx + bw},${by + bh} l${d},-${d * .6}`,
        fill: "none", stroke: C.faint, "stroke-width": 1.2 }, empty);
    T(empty, sx + tw / 2, ty + th - 12, "empty room box", { class: "sm", "text-anchor": "middle" });
    const img1 = S("image", { href: "assets/blog/d027-r1.jpg", x: sx, y: ty, width: tw, height: th, preserveAspectRatio: "xMidYMid meet", opacity: 0 }, c);
    const img4 = S("image", { href: "assets/blog/d027-r4.jpg", x: sx, y: ty, width: tw, height: th, preserveAspectRatio: "xMidYMid meet", opacity: 0 }, c);
    S("rect", { x: sx, y: ty, width: tw, height: th, fill: "none", stroke: C.ink, "stroke-width": 1.5 }, c);

    const N = 8, R0 = 0.5, RD = 1.6, F = RD / 2.5, dur = R0 + N * RD + 2.6;   // phases are timed on a 2.5 s round, scaled by F
    const at = (el, i, u) => { const p = pathEls[i].getPointAtLength(lens[i] * u); el.setAttribute("x", p.x - 5); el.setAttribute("y", p.y - 5); };
    const EDITS = (k) => (k % 4 === 0 ? [3, 5] : [[0, 1], [2, 4], [1, 0]][k % 3]);   // every four rounds the improver reviews itself

    function render(t) {
      const k = Math.min(N, Math.floor((t - R0) / RD) + 1);          // current round (1..N), 0 before the first
      const u = (t - R0 - (k - 1) * RD) / F;                         // time within the round, on the 2.5 s scale
      const done = t >= R0 + N * RD;
      roundNum.textContent = Math.max(0, k);
      // executor and improver activity
      exBar.setAttribute("width", k >= 1 && !done && u < 0.9 ? ex.w * seg(u, 0, 0.8) : 0);
      imBar.setAttribute("width", k >= 1 && !done && u < 2.45 ? im.w * seg(u, 1.9, 2.3) : 0);
      exBox.setAttribute("fill", k >= 1 && !done && u < 0.85 ? "#0a3fc4" : C.accent);
      // token along the loop
      let tok = 0;
      if (k >= 1 && !done) {
        if (u >= 0.8 && u < 1.2) { at(token, 0, inOut(seg(u, 0.8, 1.2))); tok = 1; }
        else if (u >= 1.55 && u < 1.9) { at(token, 1, inOut(seg(u, 1.55, 1.9))); tok = 1; }
        else if (u >= 2.3 && u < 2.42) { at(token, 2, seg(u, 2.3, 2.42)); tok = 1; }
        else if (u >= 2.42 && u < 2.5) { at(token, 3, seg(u, 2.42, 2.5)); tok = 1; }
      }
      token.setAttribute("opacity", tok);
      // validation gate and verdict of the current round
      const kept = k >= 1 && RUN[k] > RUN[k - 1];
      const judging = k >= 1 && !done && u >= 1.2 && u < 1.55;
      gateFill.setAttribute("opacity", judging ? 0.15 + 0.15 * Math.sin(u * 40) : (k >= 1 && !done && u >= 1.55 && u < 2.3 && kept ? 0.9 : 0));
      gateTxt.setAttribute("fill", k >= 1 && !done && u >= 1.55 && u < 2.3 && kept ? "#fff" : C.ink);
      if (k >= 1 && (u >= 1.55 || done)) {
        verdict.textContent = kept ? "KEPT" : "REVERTED";
        verdict2.textContent = kept ? `${fmt(RUN[k - 1])} → ${fmt(RUN[k])}` : "no gain";
        for (const v of [verdict, verdict2]) {
          v.setAttribute("fill", kept ? C.accent : C.muted);
          v.setAttribute("opacity", done ? 1 : seg(u, 1.55, 1.7));
        }
      } else { verdict.setAttribute("opacity", 0); verdict2.setAttribute("opacity", 0); }
      // harness edits
      const ver = Math.max(1, k >= 1 && (u >= 2.1 || done) ? k + 1 : k);
      hnTitle.textContent = `HARNESS · v${ver}`;
      const ed = k >= 1 && !done ? EDITS(k) : [];
      lines.forEach((ln, i) => {
        const on = ed.includes(i) ? clamp(Math.sin(Math.PI * seg(u, 1.95, 2.5))) : 0;
        ln.bg.setAttribute("opacity", 0.22 * on);
        ln.mark.textContent = on > 0.05 ? (i % 2 ? "~" : "+") : " ";
      });
      const self = k >= 1 && !done && k % 4 === 0 ? clamp(Math.sin(Math.PI * seg(u, 1.95, 2.5))) : 0;
      selfTag.setAttribute("opacity", self);
      reviewTag.textContent = k >= 1 && !done && k % 4 === 0 && u > 1.9 ? "self-review" : "";
      // the step curve: round r is drawn once its verdict is in
      let dpath = `M${X(0)},${Y(RUN[0])}`, cur = RUN[0];
      marks[0].m.setAttribute("x", X(0) - 5); marks[0].m.setAttribute("y", Y(RUN[0]) - 5); marks[0].m.setAttribute("opacity", 1);
      for (let r = 1; r <= N; r++) {
        const tr = R0 + (r - 1) * RD;                                // start of round r
        const h = done ? 1 : out3(seg(t, tr + 1.2 * F, tr + 1.55 * F));      // horizontal run to round r
        const v = done ? 1 : out3(seg(t, tr + 1.55 * F, tr + 1.95 * F));     // rise if kept
        if (h <= 0) { marks[r].m.setAttribute("opacity", 0); continue; }
        const x = lerp(X(r - 1), X(r), h);
        dpath += ` H${x}`;
        const y = lerp(RUN[r - 1], RUN[r], v);
        if (h >= 1 && RUN[r] !== RUN[r - 1]) dpath += ` V${Y(y)}`;
        cur = h >= 1 ? y : cur;
        const m = marks[r];
        if (m.kept) { m.m.setAttribute("x", X(r) - 5); m.m.setAttribute("y", Y(y) - 5); }
        else { m.m.setAttribute("cx", X(r)); m.m.setAttribute("cy", Y(RUN[r])); }
        m.m.setAttribute("opacity", h >= 1 ? 1 : 0);
      }
      step.setAttribute("d", dpath);
      big.textContent = fmt(cur);
      // the reconstruction of the current solution
      const r1 = done ? 1 : seg(t, R0 + 1.55 * F, R0 + 1.95 * F), r4 = done ? 1 : seg(t, R0 + 3 * RD + 1.55 * F, R0 + 3 * RD + 1.95 * F);
      img1.setAttribute("opacity", r1 * (1 - r4));
      img4.setAttribute("opacity", r4);
      empty.setAttribute("opacity", 1 - r1);
      solLbl.textContent = r4 > 0.5 ? "SOLUTION · ROUND 4" : r1 > 0.5 ? "SOLUTION · ROUND 1" : "SOLUTION · STARTER";
      // fade out before the loop restarts
      svg.style.opacity = t > dur - 0.5 ? String(1 - seg(t, dur - 0.5, dur)) : t < 0.3 ? String(seg(t, 0, 0.3)) : "1";
    }
    return { dur, render, final: R0 + N * RD + 1 };
  };

  // ================================================================ the task grid, regrouped three ways
  const GROUPINGS = {
    area: ["Perception", "Reasoning", "Action", "Reconstruction", "Creation"].map((a) => ({ key: a, title: a, sub: "", test: (n) => AREA_OF[n] === a })),
    kind: [
      { key: "answer", title: "A single answer", sub: "the starter passes each question to the model", test: (n) => KIND_OF[n] === "answer" },
      { key: "build", title: "The agent builds it", sub: "a program, a robot policy or a pipeline", test: (n) => KIND_OF[n] !== "answer" },
    ],
    score: [
      { key: "answer", title: "A single answer", sub: "", test: (n) => KIND_OF[n] === "answer" },
      { key: "scale", title: "Built · scored on a scale", sub: "", test: (n) => KIND_OF[n] === "scale" },
      { key: "binary", title: "Built · success or failure only", sub: "", test: (n) => KIND_OF[n] === "binary" },
    ],
  };
  function tasksGrid(stage) {
    const tiles = new Map();
    for (const [name, area] of TASKS) {
      const el = H("span", "tile", null, `${name}`);
      el.style.setProperty("--c", C.area[area]);
      tiles.set(name, el);
    }
    const wrap = H("div", "tg-groups", stage);
    let mode = null;
    function lay(m, animate) {
      if (m === mode) return;
      const first = new Map([...tiles].map(([n, el]) => [n, el.getBoundingClientRect()]));
      wrap.innerHTML = "";
      const gs = GROUPINGS[m];
      const narrow = stage.clientWidth < 640;
      wrap.style.gridTemplateColumns = narrow ? "1fr" : `repeat(${gs.length}, minmax(0, 1fr))`;
      for (const gdef of gs) {
        const gEl = H("div", "tg-group", wrap);
        const names = TASKS.map(([n]) => n).filter(gdef.test);
        H("p", "tg-title", gEl, `${gdef.title}<i>${names.length}</i>`);
        if (gdef.sub) { const sub = H("p", "sm-sub", gEl, gdef.sub); sub.style.cssText = "margin:-4px 0 8px;font-size:12px;color:var(--ink-3)"; }
        const box = H("div", "tg-tiles", gEl);
        for (const n of names) box.appendChild(tiles.get(n));
      }
      mode = m;
      stage.parentElement.querySelectorAll("[data-group]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.group === m)));
      if (!animate || reduced) return;
      let i = 0;
      for (const [n, el] of tiles) {
        const a = first.get(n), b = el.getBoundingClientRect();
        if (!a || !a.width) continue;
        const dx = a.left - b.left, dy = a.top - b.top;
        el.style.transition = "none";
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        el.getBoundingClientRect();
        el.style.transition = `transform 0.75s cubic-bezier(0.22, 1, 0.36, 1) ${Math.min(i++, 19) * 0.018}s`;
        el.style.transform = "";
      }
    }
    const fit = () => {
      stage.style.minHeight = "";
      let h = 0;
      for (const m of ["kind", "score", "area"]) { mode = null; lay(m, false); h = Math.max(h, stage.offsetHeight); }
      stage.style.minHeight = `${h}px`;
    };
    fit();
    let user = false, timers = [];
    stage.parentElement.querySelectorAll("[data-group]").forEach((b) => b.addEventListener("click", () => {
      user = true; timers.forEach(clearTimeout); lay(b.dataset.group, true);
    }));
    window.addEventListener("resize", () => { const m = mode; fit(); mode = null; lay(m, false); });
    return {
      autoplay() {            // walk through the three groupings once, unless the reader has clicked
        if (user || reduced) return;
        timers.push(setTimeout(() => !user && lay("kind", true), 2200));
        timers.push(setTimeout(() => !user && lay("score", true), 4800));
      },
      seek(t) { lay(t < 2.2 ? "area" : t < 4.8 ? "kind" : "score", false); },
    };
  }

  // ================================================================ leaderboard bars
  ANIMS.board = (stage, W) => {
    const narrow = W < 560, rowH = 31, top = 12, lab = narrow ? 150 : 210, valW = 46;
    const height = top + BOARD.length * rowH + 22;
    const svg = S("svg", { viewBox: `0 0 ${W} ${height}`, width: W, height }, stage);
    const x0 = lab + 14, x1 = W - valW - 14, X = (v) => x0 + (v / 100) * (x1 - x0);
    for (const v of [0, 25, 50, 75, 100]) {
      S("line", { x1: X(v), x2: X(v), y1: top - 4, y2: top + BOARD.length * rowH, class: "gridl" }, svg);
      T(svg, X(v), height - 6, v, { class: "tick", "text-anchor": "middle" });
    }
    const rows = BOARD.map(([name, v, open], i) => {
      const y = top + i * rowH;
      const lg = logo(name);
      if (lg) S("image", { href: lg, x: 14, y: y + 7, width: 16, height: 16 }, svg);
      const nm = T(svg, 38, y + 20, name, { "font-size": narrow ? 12 : 13.5, "font-weight": i < 1 ? 700 : 500 });
      if (open && !narrow) { const tg = T(svg, 0, y + 19, "OPEN", { class: "mono", "font-size": 9.5, fill: C.muted, "letter-spacing": "0.06em" }); tg.dataset.after = "1"; tg._nm = nm; }
      const bar = S("rect", { x: x0, y: y + 6, height: rowH - 12, width: 0, fill: brand(name) }, svg);
      const val = T(svg, x0, y + 20, "", { class: "mono", "font-size": 12, "font-weight": 600 });
      return { bar, val, v, i };
    });
    requestAnimationFrame(() => svg.querySelectorAll("[data-after]").forEach((tg) => {   // the OPEN tag sits after the name
      try { tg.setAttribute("x", 38 + tg._nm.getComputedTextLength() + 8); } catch { tg.remove(); }
    }));
    const dur = 0.3 + BOARD.length * 0.07 + 1.1;
    return { dur, render(t) {
      for (const r of rows) {
        const u = out3(seg(t, 0.2 + r.i * 0.07, 0.2 + r.i * 0.07 + 1.0)), v = r.v * u;
        r.bar.setAttribute("width", X(v) - x0);
        r.val.setAttribute("x", X(v) + 6);
        r.val.textContent = u > 0 ? fmt(v) : "";
      }
    } };
  };

  // ================================================================ where models pull apart
  ANIMS.apart = (stage, W) => {
    const H0 = Math.min(Math.max(W * 0.78, 300), 470);
    const svg = S("svg", { viewBox: `0 0 ${W} ${H0}`, width: W, height: H0 }, stage);
    const L = 56, R = W - 18, TOP = 18, B = H0 - 48, M = 72;
    const X = (v) => L + (v / M) * (R - L), Y = (v) => B - (v / M) * (B - TOP);
    for (const v of [0, 20, 40, 60]) {
      S("line", { x1: X(v), x2: X(v), y1: TOP, y2: B, class: "gridl" }, svg);
      S("line", { x1: L, x2: R, y1: Y(v), y2: Y(v), class: "gridl" }, svg);
      T(svg, X(v), B + 16, v, { class: "tick", "text-anchor": "middle" });
      T(svg, L - 8, Y(v) + 4, v, { class: "tick", "text-anchor": "end" });
    }
    T(svg, (L + R) / 2, H0 - 8, "Best minus worst model, before self-improvement", { class: "sm", "text-anchor": "middle" });
    const yl = T(svg, 0, 0, "… after self-improvement", { class: "sm", "text-anchor": "middle", transform: `translate(14,${(TOP + B) / 2}) rotate(-90)` });
    const diag = S("line", { x1: X(0), y1: Y(0), x2: X(M - 4), y2: Y(M - 4), stroke: C.muted, "stroke-width": 1.2, "stroke-dasharray": "5 4" }, svg);
    const dlab = T(svg, X(M - 8), Y(M - 8) + 18, "no change", { class: "sm", "text-anchor": "end", transform: `rotate(-${Math.atan2(B - TOP, R - L) * 180 / Math.PI} ${X(M - 8)} ${Y(M - 8) + 18})` });
    const LABELS = { "RoboDojo": [8, 4, "start"], "RoboCasa": [8, 4, "start"], "RoboLab": [8, 4, "start"], "3D Tracking": [8, 4, "start"],
                     "Scene from Photo": [8, 4, "start"], "Scene from Video": [8, 4, "start"], "ARC-AGI-3": [8, -6, "start"],
                     "ARC-AGI-2": [8, 4, "start"], "Kinematics": [8, 4, "start"], "Visual Search": [8, 12, "start"] };
    const order = Object.keys(APART).sort((a, b) => (APART[b][1] - APART[b][0]) - (APART[a][1] - APART[a][0]));
    const dots = order.map((n, i) => {
      const [s, e] = APART[n], build = KIND_OF[n] !== "answer", col = build ? C.accent : C.faint;
      const trail = S("line", { x1: X(s), x2: X(s), y1: Y(s), y2: Y(s), stroke: col, "stroke-width": 2, opacity: .35 }, svg);
      const dot = S("circle", { cx: X(s), cy: Y(s), r: 6, fill: col, stroke: "#fff", "stroke-width": 1.5, opacity: 0 }, svg);
      let lab = null;
      if (LABELS[n] && W >= 380) {
        const [dx, dy, anc] = LABELS[n];
        lab = T(svg, X(s) + dx, Y(e) + dy, n, { "font-size": 12, "font-weight": 600, fill: build ? C.ink : C.muted, "text-anchor": anc, opacity: 0 });
      }
      return { n, s, e, i, trail, dot, lab };
    });
    const dur = 4.4;
    const dl = Math.hypot(X(M - 4) - X(0), Y(M - 4) - Y(0));
    diag.setAttribute("stroke-dasharray", `${dl}`);
    return { dur, render(t) {
      diag.setAttribute("stroke-dashoffset", dl * (1 - out3(seg(t, 0, 0.7))));
      diag.setAttribute("stroke-dasharray", t >= 0.7 ? "5 4" : `${dl}`);
      dlab.setAttribute("opacity", seg(t, 0.5, 0.9));
      for (const d of dots) {
        const a = seg(t, 0.6 + d.i * 0.02, 0.9 + d.i * 0.02);
        const u = outBack(seg(t, 1.3 + d.i * 0.08, 2.3 + d.i * 0.08));
        const y = lerp(d.s, d.e, u);
        d.dot.setAttribute("opacity", a);
        d.dot.setAttribute("cy", Y(y));
        d.trail.setAttribute("y2", Y(y));
        if (d.lab) d.lab.setAttribute("opacity", seg(t, 2.6 + d.i * 0.05, 3.1 + d.i * 0.05));
      }
    } };
  };

  // ================================================================ starter vs best, grouped by what the agent produces
  ANIMS.gains = (stage, W) => {
    const narrow = W < 560, lab = narrow ? 118 : 168, gw = 52, rowH = 25, headH = 34;
    const groups = [["The solution is a single answer", "answer"], ["The agent builds it · scored on a scale", "scale"],
                    ["The agent builds it · success or failure only", "binary"]];
    const items = [];
    for (const [title, k] of groups) {
      items.push({ head: title });
      const ns = TASKS.map(([n]) => n).filter((n) => KIND_OF[n] === k).sort((a, b) => (GAINS[b][1] - GAINS[b][0]) - (GAINS[a][1] - GAINS[a][0]));
      for (const n of ns) items.push({ n });
    }
    const height = 30 + items.reduce((h, it) => h + (it.head ? headH : rowH), 0) + 26;
    const svg = S("svg", { viewBox: `0 0 ${W} ${height}`, width: W, height }, stage);
    const x0 = lab + 10, x1 = W - gw - 10, X = (v) => x0 + (v / 100) * (x1 - x0);
    const key = S("g", {}, svg);
    S("circle", { cx: x0 + 6, cy: 12, r: 5, fill: "#fff", stroke: C.muted, "stroke-width": 1.5 }, key);
    T(key, x0 + 16, 16, "starter", { class: "sm" });
    S("circle", { cx: x0 + 76, cy: 12, r: 5.5, fill: C.muted }, key);
    T(key, x0 + 86, 16, "best reached", { class: "sm" });
    T(svg, W - 10, 16, "gain", { class: "sm", "text-anchor": "end" });
    let y = 30, ri = 0;
    const rows = [];
    const bottom = height - 26;
    for (const v of [0, 25, 50, 75, 100]) {
      S("line", { x1: X(v), x2: X(v), y1: 30, y2: bottom, class: "gridl" }, svg);
      T(svg, X(v), height - 8, v, { class: "tick", "text-anchor": "middle" });
    }
    for (const it of items) {
      if (it.head) {
        S("line", { x1: 0, x2: W, y1: y + 6, y2: y + 6, stroke: C.ink, "stroke-width": 1.5, opacity: .9 }, svg);
        T(svg, 14, y + 25, it.head.toUpperCase(), { "font-size": 11.5, "font-weight": 700, "letter-spacing": "0.04em" });
        y += headH; continue;
      }
      const [a, b] = GAINS[it.n], col = C.area[AREA_OF[it.n]], cy = y + rowH / 2;
      T(svg, 14, cy + 4.5, it.n, { "font-size": narrow ? 12 : 13 });
      const bar = S("line", { x1: X(a), x2: X(a), y1: cy, y2: cy, stroke: col, "stroke-width": 5, opacity: .3, "stroke-linecap": "round" }, svg);
      const s0 = S("circle", { cx: X(a), cy, r: 5, fill: "#fff", stroke: col, "stroke-width": 1.6, opacity: 0 }, svg);
      const s1 = S("circle", { cx: X(a), cy, r: 6, fill: col, opacity: 0 }, svg);
      const g = T(svg, W - 10, cy + 4.5, "", { class: "mono", "font-size": 12, "font-weight": 600, "text-anchor": "end", fill: col });
      rows.push({ a, b, bar, s0, s1, g, i: ri++ });
      y += rowH;
    }
    const dur = 0.6 + rows.length * 0.06 + 1.2;
    return { dur, render(t) {
      for (const r of rows) {
        const ap = seg(t, 0.05 + r.i * 0.03, 0.35 + r.i * 0.03);
        const u = out3(seg(t, 0.5 + r.i * 0.06, 1.5 + r.i * 0.06)), v = lerp(r.a, r.b, u);
        r.s0.setAttribute("opacity", ap); r.s1.setAttribute("opacity", ap);
        r.s1.setAttribute("cx", X(v)); r.bar.setAttribute("x2", X(v));
        r.g.textContent = ap > 0 ? `+${fmt(v - r.a, 0)}` : "";
      }
    } };
  };

  // ================================================================ the same candidates, two evaluators (illustration)
  ANIMS.ladder = (stage, W) => {
    const narrow = W < 700, laneH = narrow ? 168 : 128, top = 14;
    const height = top + 2 * laneH + 10;
    const svg = S("svg", { viewBox: `0 0 ${W} ${height}`, width: W, height }, stage);
    const P = [0.24, 0.42, 0.6, 0.8, 1.0];
    const lanes = [
      { title: "Scored on a scale", sub: "every step forward counts", score: (p) => Math.round(p * 100) },
      { title: "Success or failure only", sub: "only a full success counts", score: (p) => (p >= 1 ? 100 : 0) },
    ];
    const lw = narrow ? 0 : 200, cw = narrow ? W - 28 : 230;
    const tx0 = narrow ? 18 : lw + 10, tx1 = narrow ? W - 18 : W - cw - 34;
    const STAGES = [["reach", 1 / 3], ["grasp", 2 / 3], ["place", 1]];
    const L = lanes.map((ln, li) => {
      const y0 = top + li * laneH;
      const g = S("g", {}, svg);
      if (li) S("line", { x1: 0, x2: W, y1: y0 - 2, y2: y0 - 2, stroke: C.ink, "stroke-width": 1.5 }, g);
      T(g, 14, y0 + 24, ln.title.toUpperCase(), { "font-size": 12.5, "font-weight": 800, "letter-spacing": "0.02em" });
      T(g, 14, y0 + 42, ln.sub, { class: "sm" });
      const ty = narrow ? y0 + 64 : y0 + 62;
      S("line", { x1: tx0, x2: tx1, y1: ty, y2: ty, stroke: C.grid, "stroke-width": 8 }, g);
      const prog = S("line", { x1: tx0, x2: tx0, y1: ty, y2: ty, stroke: li ? C.faint : C.accent, "stroke-width": 8 }, g);
      for (const [nm, f] of STAGES) {
        const x = lerp(tx0, tx1, f);
        S("line", { x1: x, x2: x, y1: ty - 10, y2: ty + 10, stroke: C.ink, "stroke-width": 1.5 }, g);
        T(g, x, ty + 26, nm, { class: "sm", "text-anchor": f === 1 ? "end" : "middle" });
      }
      const ghosts = P.map((p) => S("line", { x1: lerp(tx0, tx1, p), x2: lerp(tx0, tx1, p), y1: ty - 6, y2: ty + 6, stroke: C.muted, "stroke-width": 2, opacity: 0 }, g));
      const bot = S("rect", { x: tx0 - 7, y: ty - 7, width: 14, height: 14, fill: C.ink }, g);
      // evaluator: candidate chips and the kept score
      const cx0 = narrow ? 18 : W - cw - 14, cy0 = narrow ? y0 + 124 : y0 + 46;
      const chips = P.map((p, k) => {
        const x = cx0 + k * 34;
        const r = S("rect", { x, y: cy0, width: 30, height: 30, fill: "#fff", stroke: C.grid, "stroke-width": 1.5 }, g);
        const v = T(g, x + 15, cy0 + 19.5, "", { class: "mono", "font-size": 11, "text-anchor": "middle", "font-weight": 700 });
        return { r, v };
      });
      T(g, cx0, cy0 - 10, "CANDIDATES", { class: "mono", "font-size": 10, fill: C.muted, "letter-spacing": "0.08em" });
      const bx = cx0 + 5 * 34 + 10;
      T(g, bx, cy0 - 10, "KEPT", { class: "mono", "font-size": 10, fill: C.muted, "letter-spacing": "0.08em" });
      const best = T(g, bx, cy0 + 26, "0", { "font-size": 28, "font-weight": 800, fill: li ? C.muted : C.accent, "letter-spacing": "-0.03em" });
      return { ln, li, prog, bot, ghosts, chips, best, ty };
    });
    const K0 = 0.4, KD = 1.5, dur = K0 + P.length * KD + 0.6;
    return { dur, render(t) {
      const k = clamp(Math.floor((t - K0) / KD), 0, P.length - 1), u = t - K0 - k * KD;
      for (const ln of L) {
        let p = 0;
        if (t >= K0) p = P[k] * inOut(seg(u, 0, 0.8));
        if (t >= K0 + P.length * KD) p = P[P.length - 1];
        const x = lerp(tx0, tx1, p);
        ln.prog.setAttribute("x2", x);
        ln.bot.setAttribute("x", x - 7);
        let bestV = 0;
        P.forEach((pp, j) => {
          const shown = t >= K0 + j * KD + 0.9;
          ln.ghosts[j].setAttribute("opacity", shown && j < P.length - 1 ? 0.45 : 0);
          const sc = ln.ln.score(pp), keptJ = sc > bestV;
          const ch = ln.chips[j];
          if (shown) {
            ch.v.textContent = keptJ ? sc : "×";
            ch.r.setAttribute("fill", keptJ ? (ln.li ? C.ink : C.accent) : "#fff");
            ch.r.setAttribute("stroke", keptJ ? (ln.li ? C.ink : C.accent) : C.faint);
            ch.v.setAttribute("fill", keptJ ? "#fff" : C.faint);
            if (keptJ) bestV = sc;
          } else { ch.v.textContent = ""; ch.r.setAttribute("fill", "#fff"); ch.r.setAttribute("stroke", C.grid); }
        });
        ln.best.textContent = bestV;
        ln.best.setAttribute("fill", bestV ? C.accent : C.muted);
      }
    } };
  };

  // ================================================================ median gain by evaluator, closed vs open
  ANIMS.feedback = (stage, W) => {
    const nb = W < 560, height = nb ? 318 : 300, L = 52, R = W - 16, TOP = nb ? 58 : 40, B = height - 52;
    const svg = S("svg", { viewBox: `0 0 ${W} ${height}`, width: W, height }, stage);
    const Y = (v) => B - (v / 32) * (B - TOP);
    for (const v of [0, 10, 20, 30]) {
      S("line", { x1: L, x2: R, y1: Y(v), y2: Y(v), class: "gridl" }, svg);
      T(svg, L - 8, Y(v) + 4, v, { class: "tick", "text-anchor": "end" });
    }
    T(svg, L, 16, "MEDIAN VALIDATION GAIN (POINTS)", { class: "mono", "font-size": 10.5, fill: C.muted, "letter-spacing": "0.08em" });
    const kx = nb ? L : R - 250, ky = nb ? 24 : 6;
    S("rect", { x: kx, y: ky, width: 12, height: 12, fill: C.accent }, svg); T(svg, kx + 18, ky + 10, "closed-source", { class: "sm" });
    S("rect", { x: kx + 120, y: ky, width: 12, height: 12, fill: C.open }, svg); T(svg, kx + 138, ky + 10, "open-weight", { class: "sm" });
    const G = [["Scored on a scale", "9 tasks", 28.4, 9.9], ["Success or failure only", "4 tasks", 16.9, 1.6]];
    const gw = (R - L) / 2, bw = Math.min(84, gw / 3.6);
    const bars = [];
    G.forEach(([name, n, cv, ov], gi) => {
      const cx = L + gw * gi + gw / 2;
      T(svg, cx, B + 22, name, { "font-size": 13.5, "font-weight": 700, "text-anchor": "middle" });
      T(svg, cx, B + 40, n, { class: "sm", "text-anchor": "middle" });
      [[cv, C.accent, -1], [ov, C.open, 1]].forEach(([v, col, side], j) => {
        const x = cx + side * (bw / 2 + 6) - bw / 2;
        const r = S("rect", { x, y: B, width: bw, height: 0, fill: col }, svg);
        const lab = T(svg, x + bw / 2, B - 8, "", { class: "mono", "font-size": 13, "font-weight": 700, "text-anchor": "middle" });
        bars.push({ r, lab, v, i: gi * 2 + j });
      });
    });
    S("line", { x1: L, x2: R, y1: B, y2: B, stroke: C.ink, "stroke-width": 1.5 }, svg);
    return { dur: 2.2, render(t) {
      for (const b of bars) {
        const u = out3(seg(t, 0.15 + b.i * 0.18, 1.15 + b.i * 0.18)), v = b.v * u;
        b.r.setAttribute("y", Y(v)); b.r.setAttribute("height", B - Y(v));
        b.lab.setAttribute("y", Y(v) - 8); b.lab.textContent = u > 0 ? fmt(v) : "";
      }
    } };
  };

  // ================================================================ closed minus open, by how strictly the output is checked
  ANIMS.gap = (stage, W) => {
    const narrow = W < 560, lab = narrow ? 124 : 160, rowH = 25, top = 34;
    const height = top + GAP.length * rowH + 26;
    const svg = S("svg", { viewBox: `0 0 ${W} ${height}`, width: W, height }, stage);
    const x0 = lab + 12, x1 = W - 96, X = (v) => x0 + (v / 55) * (x1 - x0);
    const gk = narrow ? 14 : x0;
    S("rect", { x: gk, y: 8, width: 12, height: 12, fill: C.accent }, svg); T(svg, gk + 18, 18, "strict check", { class: "sm" });
    S("rect", { x: gk + 110, y: 8, width: 12, height: 12, fill: C.light }, svg); T(svg, gk + 128, 18, "judge or tolerance", { class: "sm" });
    for (const v of [0, 10, 20, 30, 40, 50]) {
      S("line", { x1: X(v), x2: X(v), y1: top - 4, y2: top + GAP.length * rowH, class: "gridl" }, svg);
      T(svg, X(v), height - 8, v, { class: "tick", "text-anchor": "middle" });
    }
    const rows = GAP.map(([n, v, k], i) => {
      const y = top + i * rowH, cy = y + rowH / 2;
      T(svg, 14, cy + 4.5, n, { "font-size": narrow ? 12 : 13, fill: k === "judge" ? C.muted : C.ink });
      const col = k === "judge" ? C.light : C.accent;
      const bar = S("rect", { x: x0, y: y + 5, height: rowH - 10, width: 0, fill: col, opacity: k === "except" ? 0.55 : 1 }, svg);
      const val = T(svg, x0, cy + 4.5, "", { class: "mono", "font-size": 12, "font-weight": 600 });
      const ex = k === "except" ? T(svg, x0, cy + 4.5, "robot, the exception", { class: "sm", opacity: 0 }) : null;
      return { bar, val, ex, v, i };
    });
    const dur = 0.4 + GAP.length * 0.07 + 1.8;
    return { dur, render(t) {
      for (const r of rows) {
        const u = out3(seg(t, 0.2 + r.i * 0.07, 1.2 + r.i * 0.07)), v = r.v * u;
        r.bar.setAttribute("width", Math.max(0, X(v) - x0));
        r.val.setAttribute("x", X(v) + 6); r.val.textContent = u > 0 ? fmt(v) : "";
        if (r.ex) { r.ex.setAttribute("x", X(v) + 48); r.ex.setAttribute("opacity", seg(t, 1.6 + r.i * 0.07, 2.0 + r.i * 0.07)); }
      }
    } };
  };

  // ================================================================ physics check: objects dropped into a simulator (illustration)
  ANIMS.topple = (stage, W) => {
    // two scenes stacked; every object that falls over has a free stretch of floor on the side it falls to
    const SH = 178, height = 2 * SH + 6, iw = W - 32, room = Math.min(SH - 64, iw * 0.2);
    const svg = S("svg", { viewBox: `0 0 ${W} ${height}`, width: W, height }, stage);
    // objects: x share, width share (of the scene's width), height share (of the room height), kind
    const OBJ = [[.00, .10, .52, "box"], [.25, .16, .35, "table"], [.58, .03, .87, "lamp"], [.83, .11, .60, "chair"]];
    // per object: null = stays put; otherwise how high it floats (share of the room), the angle it tips to and how
    // far it slides once the simulation starts
    const scenes = [
      { title: "Claude Opus 5.5", stat: "70.7% of objects stay stable", beh: [null, null, { dy: -.12, rot: 90, slide: 0 }, null] },
      { title: "Open-weight models", stat: "0% of objects stay stable",
        beh: [{ dy: -.30, rot: 90, slide: 0 }, { dy: -.18, rot: 90, slide: 0 }, { dy: -.10, rot: 90, slide: 0 }, { dy: -.45, rot: 0, slide: 14 }] },
    ];
    const parts = [], stats = [], col = C.area.Reconstruction;
    scenes.forEach((sc, si) => {
      const oy = si * SH, floorY = oy + SH - 24;
      const cp = S("clipPath", { id: `scene${si}` }, S("defs", {}, svg));
      S("rect", { x: 0, y: oy + 1, width: W, height: SH - 2 }, cp);
      if (si) S("line", { x1: 0, x2: W, y1: oy, y2: oy, stroke: C.ink, "stroke-width": 1.5 }, svg);
      T(svg, 16, oy + 24, sc.title.toUpperCase(), { "font-size": 12, "font-weight": 800, "letter-spacing": "0.02em" });
      stats.push(T(svg, W - 16, oy + 24, sc.stat, { class: "mono", "font-size": 11.5, "text-anchor": "end", fill: si ? C.muted : C.accent, opacity: 0 }));
      const g = S("g", { "clip-path": `url(#scene${si})` }, svg);
      S("line", { x1: 12, x2: W - 12, y1: floorY, y2: floorY, stroke: C.ink, "stroke-width": 2 }, g);
      for (let x = 18; x < W - 12; x += 12) S("line", { x1: x, x2: x - 7, y1: floorY + 1, y2: floorY + 8, stroke: C.faint, "stroke-width": 1 }, g);
      OBJ.forEach(([xs, ws, hs, kind], oi) => {
        const w = ws * iw, h = hs * room, x = 16 + xs * iw, b = sc.beh[oi];
        const og = S("g", {}, g);
        if (kind === "box") S("rect", { x: 0, y: -h, width: w, height: h, fill: col }, og);
        if (kind === "table") { S("rect", { x: 0, y: -h, width: w, height: h * .22, fill: col }, og); S("rect", { x: 3, y: -h, width: 5, height: h, fill: col }, og); S("rect", { x: w - 8, y: -h, width: 5, height: h, fill: col }, og); }
        if (kind === "lamp") { S("rect", { x: w * .3, y: -h, width: w * .4, height: h, fill: col }, og); S("path", { d: `M${-w * .4},${-h * .76} L${w * 1.4},${-h * .76} L${w * 1.1},${-h} L${-w * .1},${-h} z`, fill: col }, og); S("rect", { x: -w * .3, y: -4, width: w * 1.6, height: 4, fill: col }, og); }
        if (kind === "chair") { S("rect", { x: 0, y: -h * .5, width: w, height: h * .14, fill: col }, og); S("rect", { x: w - 6, y: -h, width: 6, height: h, fill: col }, og); S("rect", { x: 2, y: -h * .5, width: 5, height: h * .5, fill: col }, og); }
        const mark = T(g, x + w / 2, floorY - h - 10, b ? "×" : "✓", { "font-size": 15, "font-weight": 800, "text-anchor": "middle", fill: b ? C.muted : C.accent, opacity: 0 });
        const ext = kind === "lamp" ? [-.4 * w, 1.4 * w] : [0, w];   // horizontal extent of the drawing
        parts.push({ og, x, w, h, b, oi, mark, ext, floorY });
      });
    });
    const dur = 4.2;
    return { dur, render(t) {
      stats.forEach((st) => st.setAttribute("opacity", seg(t, 3.1, 3.5)));
      for (const p of parts) {
        const a = seg(t, 0.05 + p.oi * 0.06, 0.35 + p.oi * 0.06), s0 = 1.0 + p.oi * 0.08;
        let y = p.floorY, rot = 0, dx = 0, fade = 0;
        if (p.b) {
          const f = seg(t, s0, s0 + 0.45);
          y = p.floorY + p.b.dy * room * (1 - f * f);               // fall onto the floor
          const tip = out3(seg(t, s0 + 0.4, s0 + 1.2));
          rot = p.b.rot * tip; dx = p.b.slide * tip; fade = Math.max(tip, f);
        }
        const pivot = rot > 0 ? p.ext[1] : p.ext[0];
        // lowest point of the rotated drawing, so that nothing passes through the floor
        const a0 = rot * Math.PI / 180, cs = Math.cos(a0), sn = Math.sin(a0);
        let low = -Infinity;
        for (const cx of p.ext) for (const cy of [-p.h, 0]) low = Math.max(low, (cx - pivot) * sn + cy * cs);
        if (low > 0) y -= low;
        p.og.setAttribute("transform", `translate(${p.x + dx},${y}) rotate(${rot} ${pivot} 0)`);
        p.og.setAttribute("opacity", a * (1 - 0.4 * fade));
        const lying = Math.abs(rot) > 45;
        p.mark.setAttribute("opacity", seg(t, 2.8, 3.1));
        p.mark.setAttribute("x", p.x + dx + (lying ? p.ext[1] + p.h / 2 : p.w / 2));
        p.mark.setAttribute("y", p.floorY - (lying ? p.w : p.h) - 10);
      }
    } };
  };

  // physics component of Scene from Video, as HTML bars next to the illustration
  ANIMS.physics = (stage) => {
    const D = [["Claude Opus 5.5", 70.7], ["GPT-6 Astra", 37.7], ["Qwen3.8-Flash-Next", 0], ["Qwen3.8-27B", 0], ["MiniMax-M3", 0], ["Gemma-4-31B-it", 0]];
    const rows = D.map(([n, v], i) => {
      const c = brand(n);
      const r = H("div", "mb-row", stage, `<span>${n}</span><span class="mb-track"><span class="mb-fill"></span></span><span class="mb-val"></span>`);
      const fill = r.querySelector(".mb-fill"), val = r.querySelector(".mb-val");
      fill.style.setProperty("--c", c); fill.style.transition = "none";
      return { fill, val, v, i };
    });
    return { dur: 2.2, render(t) {
      for (const r of rows) {
        const u = out3(seg(t, 0.2 + r.i * 0.1, 1.2 + r.i * 0.1));
        r.fill.style.width = `${r.v * u}%`;
        r.val.textContent = u > 0 ? `${fmt(r.v * u)}%` : "";
      }
    } };
  };

  // ================================================================ frozen vs self-improving harness
  ANIMS.pairs = (stage, W) => {
    const narrow = W < 640, lab = narrow ? 170 : 200, rowH = 30, headH = 30, top = 30;
    const groups = [];
    for (const p of PAIRS) { const g = groups.find((x) => x.task === p[0]); g ? g.rows.push(p) : groups.push({ task: p[0], rows: [p] }); }
    const height = top + groups.length * headH + PAIRS.length * rowH + 28;
    const svg = S("svg", { viewBox: `0 0 ${W} ${height}`, width: W, height }, stage);
    const x0 = lab + 12, x1 = W - 70, X = (v) => x0 + (v / 100) * (x1 - x0), bottom = height - 26;
    const kx = narrow ? 14 : x0;
    S("circle", { cx: kx + 6, cy: 13, r: 5.5, fill: "#fff", stroke: C.muted, "stroke-width": 1.6 }, svg);
    T(svg, kx + 16, 17, "frozen", { class: "sm" });
    S("circle", { cx: kx + 76, cy: 13, r: 6, fill: C.muted }, svg);
    T(svg, kx + 86, 17, "self-improving harness", { class: "sm" });
    T(svg, W - 12, 17, "Δ test", { class: "sm", "text-anchor": "end" });
    for (const v of [0, 25, 50, 75, 100]) {
      S("line", { x1: X(v), x2: X(v), y1: top, y2: bottom, class: "gridl" }, svg);
      T(svg, X(v), height - 8, v, { class: "tick", "text-anchor": "middle" });
    }
    let y = top, i = 0;
    const rows = [];
    for (const g of groups) {
      S("line", { x1: 0, x2: W, y1: y + 4, y2: y + 4, stroke: C.ink, "stroke-width": 1.5 }, svg);
      T(svg, 14, y + 22, g.task.toUpperCase(), { "font-size": 11.5, "font-weight": 700, "letter-spacing": "0.04em" });
      y += headH;
      for (const [, model, a, b] of g.rows) {
        const cy = y + rowH / 2, lg = logo(model);
        if (lg) S("image", { href: lg, x: 14, y: cy - 8, width: 16, height: 16 }, svg);
        T(svg, 36, cy + 4.5, model, { "font-size": narrow ? 12 : 13 });
        const col = brand(model);
        const line = S("line", { x1: X(a), x2: X(a), y1: cy, y2: cy, stroke: col, "stroke-width": 2.5, opacity: .45 }, svg);
        const f = S("circle", { cx: X(a), cy, r: 6, fill: "#fff", stroke: col, "stroke-width": 1.6, opacity: 0 }, svg);
        const s = S("circle", { cx: X(a), cy, r: 6.5, fill: col, opacity: 0 }, svg);
        const d = T(svg, W - 12, cy + 4.5, "", { class: "mono", "font-size": 12.5, "font-weight": 700, "text-anchor": "end", fill: b > a ? C.ink : C.muted });
        rows.push({ a, b, line, f, s, d, i: i++ });
        y += rowH;
      }
    }
    const dur = 0.6 + PAIRS.length * 0.16 + 1.3;
    return { dur, render(t) {
      for (const r of rows) {
        const ap = seg(t, 0.1 + r.i * 0.05, 0.4 + r.i * 0.05);
        const u = out3(seg(t, 0.7 + r.i * 0.16, 1.8 + r.i * 0.16)), v = lerp(r.a, r.b, u);
        r.f.setAttribute("opacity", ap);
        r.s.setAttribute("opacity", u > 0 ? 1 : 0); r.s.setAttribute("cx", X(v));
        r.line.setAttribute("x2", X(v));
        const dv = v - r.a;
        r.d.textContent = u > 0 ? (dv > 0.05 ? `+${fmt(dv)}` : "0.0") : "";
      }
    } };
  };

  // ================================================================ share of the gain reached by each round
  ANIMS.rounds = (stage, W) => {
    const height = Math.min(Math.max(W * 0.5, 280), 400);
    const svg = S("svg", { viewBox: `0 0 ${W} ${height}`, width: W, height }, stage);
    const L = 52, R = W - 18, TOP = 16, B = height - 44, K = 15;
    const X = (r) => L + (r / K) * (R - L), Y = (v) => B - v * (B - TOP);
    for (const v of [0, .25, .5, .75, 1]) {
      S("line", { x1: L, x2: R, y1: Y(v), y2: Y(v), class: "gridl" }, svg);
      T(svg, L - 8, Y(v) + 4, `${v * 100}%`, { class: "tick", "text-anchor": "end" });
    }
    for (let r = 0; r <= K; r += 3) T(svg, X(r), B + 16, r, { class: "tick", "text-anchor": "middle" });
    T(svg, (L + R) / 2, height - 8, "Round", { class: "sm", "text-anchor": "middle" });
    S("line", { x1: L, x2: R, y1: Y(.9), y2: Y(.9), stroke: C.muted, "stroke-width": 1, "stroke-dasharray": "4 4" }, svg);
    T(svg, R, Y(.9) - 6, "90% of the gain", { class: "sm", "text-anchor": "end" });
    const clipId = "rclip";
    const cp = S("clipPath", { id: clipId }, S("defs", {}, svg));
    const clipR = S("rect", { x: 0, y: 0, width: L, height }, cp);
    const lines = S("g", { "clip-path": `url(#${clipId})` }, svg);
    const order = ["Perception", "Reasoning", "Creation", "Action", "Reconstruction"];
    const hits = [];
    for (const a of order) {
      const { lo, hi } = ROUNDS[a];
      const band = hi.map((v, r) => `${r ? "L" : "M"}${X(r)},${Y(v)}`).join(" ") + " " + lo.map((v, r) => `L${X(r)},${Y(v)}`).reverse().join(" ") + " z";
      S("path", { d: band, fill: C.area[a], opacity: 0.06 }, lines);
    }
    for (const a of order) {
      const m = ROUNDS[a].med, col = C.area[a];
      S("path", { d: m.map((v, r) => `${r ? "L" : "M"}${X(r)},${Y(v)}`).join(" "), fill: "none", stroke: col, "stroke-width": 2.6, "stroke-linejoin": "round" }, lines);
      const r9 = m.findIndex((v) => v >= 0.9);
      const dot = S("circle", { cx: X(r9), cy: Y(m[r9]), r: 5, fill: col, stroke: "#fff", "stroke-width": 1.5, opacity: 0 }, svg);
      hits.push({ a, r9, dot, col });
    }
    const scan = S("line", { x1: L, x2: L, y1: TOP, y2: B, stroke: C.ink, "stroke-width": 1, opacity: 0 }, svg);
    const scanT = T(svg, L, TOP + 10, "", { class: "mono", "font-size": 11, fill: C.ink });
    const legend = S("g", {}, svg);
    const narrowR = W < 560;
    order.forEach((a, i) => {
      const h = hits.find((x) => x.a === a);
      const lx = narrowR ? X(4.4) : X(8.6), ly = Y(.62) + i * 18;
      S("rect", { x: lx, y: ly - 8, width: 14, height: 3, fill: C.area[a] }, legend);
      T(legend, lx + 20, ly - 3, narrowR ? `${a} · round ${h.r9}` : `${a} · 90% by round ${h.r9}`, { "font-size": narrowR ? 11 : 12, "font-weight": 600, fill: C.area[a] });
      if (!narrowR) T(legend, lx + 20 + 196, ly - 3, `${ROUNDS[a].n} runs`, { class: "sm" });
    });
    const D0 = 0.2, D1 = 3.2, dur = 4.0;
    return { dur, render(t) {
      const u = seg(t, D0, D1), r = u * K, x = X(r);
      clipR.setAttribute("width", x + 4);
      scan.setAttribute("x1", x); scan.setAttribute("x2", x); scan.setAttribute("opacity", u > 0 && u < 1 ? 0.5 : 0);
      scanT.setAttribute("x", x + 6); scanT.textContent = u > 0 && u < 1 ? `round ${Math.floor(r)}` : "";
      for (const h of hits) {
        const on = r >= h.r9 ? 1 : 0;
        h.dot.setAttribute("opacity", on);
      }
      legend.setAttribute("opacity", seg(t, D1 - 0.2, D1 + 0.4));
    } };
  };

  // ---------------------------------------------------------------- runner
  const insts = [];
  document.querySelectorAll("[data-anim]").forEach((stage) => {
    const def = ANIMS[stage.dataset.anim];
    if (!def) return;
    const inst = { stage, def, name: stage.dataset.anim, t: 0, playing: false, started: false, loop: stage.dataset.loop === "1", api: null, w: 0 };
    inst.build = () => {
      stage.innerHTML = "";
      inst.w = stage.clientWidth;
      inst.api = def(stage, inst.w);
      inst.api.render(inst.t);
    };
    inst.build();
    insts.push(inst);
  });
  let raf = 0;
  const frame = (now) => {
    raf = 0;
    let any = false;
    for (const i of insts) {
      if (!i.playing) continue;
      let t = (now - i.t0) / 1000;
      if (i.loop) t %= i.api.dur;
      else if (t >= i.api.dur) { t = i.api.dur; i.playing = false; }
      i.t = t; i.api.render(t);
      any = any || i.playing;
    }
    if (any) raf = requestAnimationFrame(frame);
  };
  const play = (i) => { i.t0 = performance.now() - i.t * 1000; i.playing = true; if (!raf) raf = requestAnimationFrame(frame); };

  const tasksStage = document.querySelector(".tasks-stage");
  const tg = tasksStage ? tasksGrid(tasksStage) : null;

  if (SEEK != null) {
    for (const i of insts) { i.t = i.loop ? SEEK % i.api.dur : Math.min(SEEK, i.api.dur); i.api.render(i.t); }
    if (tg) tg.seek(SEEK);
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
  } else if (reduced || !("IntersectionObserver" in window)) {
    for (const i of insts) { i.t = i.api.final ?? i.api.dur; i.api.render(i.t); }
  } else {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const i = insts.find((x) => x.stage === e.target);
        if (!i) continue;
        if (e.isIntersecting) {
          if (!i.started) { i.started = true; i.t = 0; }
          if (i.loop || i.t < i.api.dur) play(i);
        } else if (i.loop) i.playing = false;
      }
    }, { threshold: 0.3 });
    insts.forEach((i) => io.observe(i.stage));
    if (tg) {
      const io2 = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { tg.autoplay(); io2.disconnect(); } }, { threshold: 0.5 });
      io2.observe(tasksStage);
    }
  }
  document.querySelectorAll("[data-replay]").forEach((b) => b.addEventListener("click", () => {
    insts.filter((i) => b.dataset.replay.split(" ").includes(i.name) || b.closest(".fig")?.contains(i.stage)).forEach((i) => { i.t = 0; play(i); });
  }));
  let rz = 0;
  window.addEventListener("resize", () => {
    clearTimeout(rz);
    rz = setTimeout(() => insts.forEach((i) => { if (i.stage.clientWidth !== i.w) i.build(); }), 150);
  });

  // count-up numbers
  const stats = document.querySelectorAll("[data-to]");
  const showStat = (el, u) => {
    const to = Number(el.dataset.to), d = Number(el.dataset.dec || 0);
    el.textContent = `${(to * u).toFixed(d).replace("-", "−")}${el.dataset.suffix || ""}`;
  };
  if (SEEK != null || reduced || !("IntersectionObserver" in window)) stats.forEach((el) => showStat(el, 1));
  else {
    const io3 = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      io3.unobserve(e.target);
      const t0 = performance.now();
      const stepF = (now) => { const u = out3(seg((now - t0) / 1000, 0, 1.2)); showStat(e.target, u); if (u < 1) requestAnimationFrame(stepF); };
      requestAnimationFrame(stepF);
    }), { threshold: 0.6 });
    stats.forEach((el) => io3.observe(el));
  }

  // contents: mark the section being read
  const tocLinks = [...document.querySelectorAll(".toc-list a")];
  const tocSecs = tocLinks.map((a) => document.querySelector(a.getAttribute("href")));
  const onToc = () => {
    let k = 0;
    tocSecs.forEach((sec, i) => { if (sec && sec.getBoundingClientRect().top < innerHeight * 0.35) k = i; });
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) k = tocLinks.length - 1;
    tocLinks.forEach((a, i) => a.classList.toggle("active", i === k && scrollY > 200));
  };
  if (tocLinks.length) { onToc(); addEventListener("scroll", onToc, { passive: true }); }

  // reading progress under the nav
  const bar = document.querySelector(".read-progress");
  if (bar) {
    const onS = () => {
      const h = document.documentElement.scrollHeight - innerHeight;
      bar.style.setProperty("--p", h > 0 ? String(clamp(scrollY / h)) : "0");
    };
    onS();
    addEventListener("scroll", onS, { passive: true });
  }
  // before / after clips play while on screen
  const vids = document.querySelectorAll(".ba video");
  if ("IntersectionObserver" in window && !reduced && SEEK == null) {
    const io4 = new IntersectionObserver((es) => es.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) { v.preload = "auto"; v.play().catch(() => {}); } else v.pause();
    }), { threshold: 0.35 });
    vids.forEach((v) => io4.observe(v));
  }
})();
