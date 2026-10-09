// Task reel: each clip plays only while it is on screen, and none play under reduced motion.
(() => {
  const vids = document.querySelectorAll(".reel-tile video");
  if (!vids.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!("IntersectionObserver" in window)) { vids.forEach((v) => { v.preload = "auto"; v.play().catch(() => {}); }); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) { v.preload = "auto"; v.play().catch(() => {}); } else v.pause();
  }), { threshold: 0.15 });
  vids.forEach((v) => io.observe(v));
})();
