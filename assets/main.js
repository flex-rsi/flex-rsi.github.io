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
