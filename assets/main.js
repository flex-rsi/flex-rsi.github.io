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

  // Hero chart: a point runs along each curve from left to right; the stretch it has passed lights up,
  // brightest at the point. Run, hold, fade, repeat; only while the chart is on screen.
  const chart = document.querySelector(".hero .curves");
  if (chart) {
    const tracks = [...chart.querySelectorAll(".track")].map((g, i) => {
      const path = g.querySelector(".curve");
      return { path, L: path.getTotalLength(), delay: 0.25 * i, lit: g.querySelector(".curve-lit"),
               dot: g.querySelector(".runner"), halo: g.querySelector(".halo"),
               rect: chart.querySelector(`#lit-clip-${i + 1} rect`), grad: chart.querySelector(`#lit-${i + 1}`) };
    });
    const RUN = 3.4, HOLD = 1.8, FADE = 0.7, IN = 0.35;
    const PERIOD = IN + 0.25 * (tracks.length - 1) + RUN + HOLD + FADE;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const place = (tr, p, a) => {
      const pt = tr.path.getPointAtLength(p * tr.L);
      const x = pt.x.toFixed(2), y = pt.y.toFixed(2);
      tr.rect.setAttribute("width", x);
      tr.grad.setAttribute("x2", Math.max(pt.x, 11).toFixed(2));
      tr.dot.setAttribute("cx", x); tr.dot.setAttribute("cy", y);
      tr.halo.setAttribute("cx", x); tr.halo.setAttribute("cy", y);
      tr.lit.style.opacity = a;
      tr.dot.style.opacity = a;
      tr.halo.style.opacity = (0.22 * a).toFixed(3);
    };
    if (reduced) {
      tracks.forEach((tr) => place(tr, 1, 1));
    } else {
      let t0 = null, raf = 0;
      const frame = (now) => {
        if (t0 === null) t0 = now;
        const t = ((now - t0) / 1000) % PERIOD;
        const a = t < IN ? t / IN : t > PERIOD - FADE ? (PERIOD - t) / FADE : 1;
        tracks.forEach((tr) => place(tr, ease(Math.min(1, Math.max(0, (t - IN - tr.delay) / RUN))), a));
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
