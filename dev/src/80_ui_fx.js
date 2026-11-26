/* ===== Glas-Animationen: Lichtstreif beim Antippen, gleitende Auswahl in Seitenleiste und Umschaltern ===== */
(function () {
'use strict';
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const SEL = '.btn,.chip,.seg button,.icon-btn,.rail nav button';
const sweep = el => { if (!el || reduce.matches) return; el.classList.remove('sweep'); void el.offsetWidth; el.classList.add('sweep'); };

document.addEventListener('pointerdown', e => {
  const b = e.target.closest && e.target.closest(SEL);
  if (!b || b.disabled) return;
  sweep(b.matches('.rail nav button') ? b.querySelector('.ic') : b);
}, { passive: true });
document.addEventListener('animationend', e => { if (e.animationName === 'qm-sweep') e.target.classList.remove('sweep'); });

/* Gleitende Glas-Auswahl: folgt dem Knopf mit .on (bzw. dessen Teil `part`) */
function glider(box, part) {
  if (box.querySelector(':scope > .glider')) return;
  const g = document.createElement('i'); g.className = 'glider'; g.setAttribute('aria-hidden', 'true');
  box.append(g); box.classList.add('has-glider');
  let last = null;
  const place = () => {
    const on = box.querySelector(':scope > button.on'), t = on && (part ? on.querySelector(part) : on);
    if (!t) { g.style.opacity = 0; last = null; return; }
    const b = box.getBoundingClientRect(), r = t.getBoundingClientRect();
    if (!b.width || !r.width) return;                                   // gerade versteckt
    const x = r.left - b.left - box.clientLeft, y = r.top - b.top - box.clientTop;
    const first = !last, moved = last && (Math.abs(x - last.x) > 1 || Math.abs(y - last.y) > 1);
    if (first) g.classList.add('instant');
    g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
    g.style.transform = `translate(${x}px,${y}px)`; g.style.opacity = 1;
    last = { x, y };
    if (first) { void g.offsetWidth; g.classList.remove('instant'); }
    else if (moved) sweep(g);
  };
  const mo = new MutationObserver(place);
  box.querySelectorAll(':scope > button').forEach(btn => mo.observe(btn, { attributes: true, attributeFilter: ['class'] }));
  new ResizeObserver(place).observe(box);
  place();
}
const init = () => {
  document.querySelectorAll('.seg').forEach(s => glider(s));
  const nav = document.querySelector('.rail nav'); if (nav) glider(nav, '.ic');
};
init();
window.TWApp.fx = { sweep, glider };
})();
