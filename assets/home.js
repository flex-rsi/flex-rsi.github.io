// Home page facts from data/results.json: the hero's track index, the overview numbers (counted the same way as
// the leaderboard overview) and each track card's tasks, every one a link into the leaderboard.
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const countUp = (els) => {
    if (reduced) { els.forEach((el) => (el.textContent = el.dataset.n)); return; }
    const t0 = performance.now(), dur = 1200;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      els.forEach((el) => (el.textContent = Math.round(e * +el.dataset.n)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  fetch("data/results.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((d) => {
      const byCat = {};
      d.tasks.forEach((t) => (byCat[t.category] = byCat[t.category] || []).push(t));
      const board = (cat, task) => `leaderboard.html#results/${cat}${task ? `/${task}` : ""}`;

      document.querySelectorAll(".hero-index a[data-cat]").forEach((a) => {
        const n = (byCat[a.dataset.cat] || []).length;
        if (!n) return;
        a.classList.add("live");
        a.href = board(a.dataset.cat);
        a.querySelector(".hi-meta").textContent = `${n} task${n > 1 ? "s" : ""}`;
      });

      const std = (t) => t.rows.filter((r) => !r.extra);
      const n = {
        models: new Set(d.tasks.flatMap((t) => std(t).map((r) => r.model))).size,
        tasks: d.tasks.length,
        runs: d.tasks.reduce((k, t) => k + std(t).length, 0),
        rounds: d.tasks.reduce((k, t) => k + std(t).reduce((j, r) => j + (r.rounds || 0), 0), 0),
      };
      const stats = [...document.querySelectorAll("[data-stat]")];
      stats.forEach((el) => (el.dataset.n = n[el.dataset.stat]));
      if ("IntersectionObserver" in window && !reduced) {
        const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); countUp(stats); } }, { threshold: 0.6 });
        stats.forEach((el) => io.observe(el));
      } else countUp(stats);

      document.querySelectorAll(".track[data-cat]").forEach((card) => {
        const ts = byCat[card.dataset.cat] || [];
        if (!ts.length) return;
        card.insertAdjacentHTML("afterbegin", `<span class="status live">${ts.length} task${ts.length > 1 ? "s" : ""}</span>`);
        card.insertAdjacentHTML("beforeend", `<ul class="track-tasks">${ts.map((t) =>
          `<li><a href="${board(t.category, t.id)}">${esc(t.track)}</a></li>`).join("")}</ul>`);
      });
    })
    .catch(() => {});
})();
