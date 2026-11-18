// Fades blocks marked [data-reveal] up into view as they scroll in. Only blocks
// below the fold are hidden first, so nothing on screen flickers at load. Does
// nothing for visitors who ask for less motion, or without IntersectionObserver.
const motionOk = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
const blocks = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];

/** Once shown, hand styles back to the block (its own hover transitions). */
function settle(block: Element) {
  window.setTimeout(() => block.classList.remove('reveal', 'revealed'), 800);
}

if (motionOk && 'IntersectionObserver' in window && blocks.length > 0) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      settle(entry.target);
      entry.target.classList.add('revealed');
    }
  });
  for (const block of blocks) {
    if (block.getBoundingClientRect().top < window.innerHeight) continue;
    block.classList.add('reveal');
    observer.observe(block);
  }
}
