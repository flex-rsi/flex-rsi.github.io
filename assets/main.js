// Flex-RSI page interactions: scroll reveal, nav state, counters, copy, gentle parallax.
(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Reveal on scroll, staggering siblings that enter together.
  const reveals = document.querySelectorAll(".reveal");
  if (reduced || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver((entries) => {
      let i = 0;
      entries.filter((e) => e.isIntersecting).forEach((e) => {
        e.target.style.setProperty("--d", `${Math.min(i++, 6) * 0.08}s`);
        e.target.classList.add("in");
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    reveals.forEach((el) => io.observe(el));
  }

  // Frosted nav once the page has scrolled.
  const nav = document.getElementById("nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 24);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Highlight the nav link of the section in view.
  const links = new Map([...document.querySelectorAll(".nav-links a")].map((a) => [a.getAttribute("href").slice(1), a]));
  if ("IntersectionObserver" in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.remove("active"));
        links.get(e.target.id)?.classList.add("active");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    document.querySelectorAll("main section[id]").forEach((s) => spy.observe(s));
  }

  // Count up the overview numbers when they appear.
  const counters = document.querySelectorAll("[data-count]");
  const runCount = (el) => {
    const target = Number(el.dataset.count);
    if (reduced) { el.textContent = target; return; }
    const t0 = performance.now(), dur = 1200;
    const step = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if ("IntersectionObserver" in window) {
    const co = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { runCount(e.target); co.unobserve(e.target); } });
    }, { threshold: 0.6 });
    counters.forEach((c) => co.observe(c));
  } else {
    counters.forEach(runCount);
  }

  // Hero chart: the agent mark beside performance-over-rounds curves, on one clock. Each round is one
  // eased step: the mark turns a quarter, every curve advances one round (its passed stretch lit,
  // brightest at the point), the round counter and the round tick update. Eight rounds, hold, fade,
  // repeat; only while the chart is on screen.
  const chart = document.querySelector(".hero .curves");
  const dial = document.querySelector(".hero .mark-spin"), counter = document.querySelector(".hero .ar-n");
  if (chart && dial && counter) {
    const X0 = +chart.dataset.x0, X1 = +chart.dataset.x1, ROUNDS = +chart.dataset.rounds;
    const ticks = [...chart.querySelectorAll(".rtick")].map((g) => ({ g, x: +g.dataset.x }));
    const runs = [...chart.querySelectorAll(".run")].map((g, i) => {
      const path = g.querySelector(".curve"), L = path.getTotalLength();
      const samples = Array.from({ length: 241 }, (_, k) => path.getPointAtLength((k / 240) * L));  // x grows along each curve
      return { samples, lit: g.querySelector(".curve-lit"), dot: g.querySelector(".runner"), halo: g.querySelector(".halo"),
               rect: chart.querySelector(`#lit-clip-${i + 1} rect`), grad: chart.querySelector(`#lit-${i + 1}`) };
    });
    const at = (run, x) => {                    // point of a curve at a given x
      const s = run.samples;
      const k = s.findIndex((p) => p.x >= x);
      if (k <= 0) return k === 0 ? s[0] : s[s.length - 1];
      const a = s[k - 1], b = s[k], f = (x - a.x) / (b.x - a.x || 1);
      return { x, y: a.y + (b.y - a.y) * f };
    };
    const RUN = 4.4, IN = 0.3, HOLD = 0.6, FADE = 0.5;
    const PERIOD = IN + RUN + HOLD + FADE;
    // one step per round, the steps longest at the two ends and shortest in the middle (slow, fast, slow)
    const w = Array.from({ length: ROUNDS }, (_, i) => 1 + 0.9 * ((2 * i - (ROUNDS - 1)) / (ROUNDS - 1)) ** 2);
    const W = w.reduce((x, y) => x + y, 0), dur = w.map((v) => (RUN * v) / W);
    const starts = dur.reduce((acc, d, i) => (acc.push(acc[i] + d), acc), [0]);
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    let shown = -1;
    const draw = (r, a) => {                    // r: rounds done, fractional
      const x = X0 + (X1 - X0) * (r / ROUNDS);
      runs.forEach((run) => {
        const pt = at(run, x), px = pt.x.toFixed(2), py = pt.y.toFixed(2);
        run.rect.setAttribute("width", px);
        run.grad.setAttribute("x2", Math.max(pt.x, X0 + 1).toFixed(2));
        run.dot.setAttribute("cx", px); run.dot.setAttribute("cy", py);
        run.halo.setAttribute("cx", px); run.halo.setAttribute("cy", py);
        run.lit.style.opacity = a; run.dot.style.opacity = a; run.halo.style.opacity = (0.22 * a).toFixed(3);
      });
      dial.setAttribute("transform", `rotate(${(r * 90).toFixed(2)} 60 60)`);
      const n = Math.min(ROUNDS, Math.floor(r + 1e-3));
      if (n !== shown) {
        shown = n;
        counter.textContent = n;
        counter.classList.remove("bump"); void counter.offsetWidth; if (n) counter.classList.add("bump");
      }
      ticks.forEach((k) => k.g.classList.toggle("on", a > 0.5 && x >= k.x - 0.5));
    };
    if (reduced) {
      draw(ROUNDS, 1);
    } else {
      let t0 = null, raf = 0;
      const frame = (now) => {
        if (t0 === null) t0 = now;
        const t = ((now - t0) / 1000) % PERIOD;
        const a = t < IN ? t / IN : t > PERIOD - FADE ? (PERIOD - t) / FADE : 1;
        const tt = t - IN;
        let r = ROUNDS;
        if (tt <= 0) r = 0;
        else if (tt < RUN) {
          let k = 0;
          while (k < ROUNDS - 1 && tt >= starts[k + 1]) k++;
          r = k + ease((tt - starts[k]) / dur[k]);
        }
        draw(r, a);
        raf = requestAnimationFrame(frame);
      };
      const start = () => { if (!raf) { t0 = null; raf = requestAnimationFrame(frame); } };
      const stop = () => { cancelAnimationFrame(raf); raf = 0; };
      if ("IntersectionObserver" in window) {
        new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? start() : stop())), { threshold: 0.2 }).observe(chart);
      } else start();
    }
  }

  // Copy BibTeX.
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = document.querySelector(btn.dataset.copy)?.innerText ?? "";
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "Copied";
        btn.classList.add("done");
        setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("done"); }, 1600);
      } catch { btn.textContent = "Select & copy"; }
    });
  });

  // Placeholder links do nothing yet.
  document.querySelectorAll('[aria-disabled="true"]').forEach((a) => a.addEventListener("click", (e) => e.preventDefault()));

  // The background bands lean slightly towards the pointer (eased, rAF-driven).
  if (!reduced && window.matchMedia("(pointer: fine)").matches) {
    const orbs = [...document.querySelectorAll(".bands")].map((el) => ({ el, k: 26 }));
    let tx = 0, ty = 0, x = 0, y = 0, running = false;
    const tick = () => {
      x += (tx - x) * 0.04; y += (ty - y) * 0.04;
      orbs.forEach(({ el, k }) => {
        el.style.setProperty("--px", `${(x * k).toFixed(2)}px`);
        el.style.setProperty("--py", `${(y * k).toFixed(2)}px`);
      });
      if (Math.abs(tx - x) + Math.abs(ty - y) > 0.001) requestAnimationFrame(tick); else running = false;
    };
    window.addEventListener("pointermove", (e) => {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
      if (!running) { running = true; requestAnimationFrame(tick); }
    }, { passive: true });
  }
})();
