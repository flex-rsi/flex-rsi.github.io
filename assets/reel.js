// "At a glance": two full-width rows of demo tiles drifting slowly in opposite directions and looping without a
// seam (each row's tiles are repeated until a copy is wider than the screen). Hovering or focusing a tile eases the
// motion to a stop and leaving eases it back; the rows only move while the band is on screen. Clips play only
// while visible. With reduced motion the rows stay still and scroll by hand.
(() => {
  const band = document.querySelector(".glance");
  if (!band) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const area = band.querySelector(".glance-rows");
  const rows = [...band.querySelectorAll(".glance-row")].map((row, i) => ({ row, track: row.querySelector(".glance-track"), dir: i % 2 ? 1 : -1 }));

  const clips = "IntersectionObserver" in window && !reduced
    ? new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause())), { threshold: 0.2 })
    : null;
  if (reduced) { band.classList.add("still"); return; }

  rows.forEach((r) => {
    const tiles = [...r.track.children];
    r.first = tiles[0];
    const setW = r.track.scrollWidth;
    const copies = Math.max(1, Math.ceil(Math.max(window.screen.width, window.innerWidth, 1920) / setW));
    for (let k = 0; k < copies; k++) {
      tiles.forEach((t) => {
        const c = t.cloneNode(true);
        c.setAttribute("aria-hidden", "true");
        c.tabIndex = -1;
        r.track.append(c);
      });
    }
    r.clone = r.track.children[tiles.length];
    r.x = r.dir > 0 ? 0 : setW * 0.35;            // start the two rows out of step
    if (clips) r.track.querySelectorAll("video").forEach((v) => clips.observe(v));
  });
  // Whole-pixel motion: clips are drawn on the pixel grid, so a row moved by fractions of a pixel makes them
  // jitter against their frames and captions. Tiles get whole-pixel widths (so a copy of the set is a whole
  // number of pixels wide) and every step is rounded to the screen's device pixels.
  const measure = () => rows.forEach((r) => {
    const tiles = [...r.track.children];
    tiles.forEach((t) => (t.style.width = ""));
    const ws = tiles.map((t) => Math.round(t.getBoundingClientRect().width));
    tiles.forEach((t, i) => (t.style.width = `${ws[i]}px`));
    r.w = r.clone.offsetLeft - r.first.offsetLeft;
  });
  measure();
  window.addEventListener("resize", measure, { passive: true });

  const SPEED = 30;                                  // px per second: a pixel every other frame at 60 Hz
  const snap = (x) => { const d = window.devicePixelRatio || 1; return Math.round(x * d) / d; };
  let v = SPEED, target = SPEED, last = 0, raf = 0;
  const frame = (now) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    v += (target - v) * Math.min(1, dt * 5);
    rows.forEach((r) => {
      r.x = (r.x + v * dt) % r.w;
      r.track.style.transform = `translate3d(${snap(r.dir < 0 ? -r.x : r.x - r.w)}px, 0, 0)`;
    });
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  area.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") target = 0; });
  area.addEventListener("pointerleave", () => (target = SPEED));
  area.addEventListener("focusin", () => (target = 0));
  area.addEventListener("focusout", () => (target = SPEED));
  let onScreen = !("IntersectionObserver" in window);
  const run = () => (onScreen && !document.hidden ? start() : stop());
  if (!onScreen) new IntersectionObserver((es) => { onScreen = es[es.length - 1].isIntersecting; run(); }).observe(band);
  document.addEventListener("visibilitychange", run);
  run();
})();
