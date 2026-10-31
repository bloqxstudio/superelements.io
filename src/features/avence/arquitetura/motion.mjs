/** Behavior only. The native Elementor tree and CSS remain visible without JS. */
function architectureMotion() {
  const doc = document;
  const root = doc.documentElement;
  if (window.__horizonteRefined) return;
  window.__horizonteRefined = true;
  const $ = (query, scope = doc) => [...scope.querySelectorAll(query)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let cleanup = () => {};

  // Typography must also load in thumbnails and with reduced motion.
  if (!doc.getElementById('kn-fonts')) {
    const font = doc.createElement('link');
    font.id = 'kn-fonts';
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&display=swap';
    doc.head.append(font);
  }

  function start() {
    cleanup();
    if (reduced.matches || root.classList.contains('elementor-editor-active') ||
        doc.body.classList.contains('elementor-editor-active') || root.scrollHeight < innerHeight * 1.6) return;

    const animations = new Set();
    const observers = [];
    const removers = [];
    let stopped = false;
    const animate = (el, frames, options = {}) => {
      if (!el || stopped) return;
      const animation = el.animate(frames, { duration: 760, easing: 'cubic-bezier(.22,1,.36,1)', ...options });
      animations.add(animation);
      animation.finished.then(() => animations.delete(animation)).catch(() => {});
      return animation;
    };
    const onceVisible = (selector, callback, threshold = .08) => {
      const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        callback(entry.target);
      }), { threshold });
      $(selector).forEach(el => observer.observe(el));
      observers.push(observer);
    };

    // Nothing is hidden while waiting for a download or an observer callback.
    onceVisible('.kn-rv', el => {
      const lines = $('.kn-ln > span', el);
      (lines.length ? lines : [el]).forEach((line, index) => animate(line,
        [{ transform: 'translateY(22px)', opacity: .35 }, { transform: 'translateY(0)', opacity: 1 }],
        { delay: index * 65 }));
    });
    onceVisible('.kn-hero-img img', el => animate(el,
      [{ transform: 'scale(1.055)' }, { transform: 'scale(1)' }], { duration: 1250 }));
    onceVisible('.kn-wide,.kn-sketch,.kn-pj-ph', el => animate(el,
      [{ opacity: .6, transform: 'translateY(18px)' }, { opacity: 1, transform: 'translateY(0)' }]));
    onceVisible('.kn-orbit', el => animate(el,
      [{ transform: 'rotate(-8deg)' }, { transform: 'rotate(0)' }], { duration: 1400 }));
    onceVisible('.kn-disc', (el) => animate(el,
      [{ opacity: .4, scale: '.92' }, { opacity: 1, scale: '1' }], { duration: 600 }));

    // One scroll-linked signature: the architectural compass. Native scrolling,
    // no pinned multi-screen stories and no invisible overlapping text.
    const rings = $('.kn-ring');
    let frame = 0;
    const update = () => {
      frame = 0;
      rings.forEach(ring => {
        const box = ring.closest('.kn-scene').getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (innerHeight - box.top) / (innerHeight + box.height)));
        ring.style.setProperty('--rot', `${-18 + progress * 36}deg`);
      });
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    update();
    removers.push(() => {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
      rings.forEach(ring => ring.style.removeProperty('--rot'));
    });

    // Anchor behavior stays native. Keyboard and focus work without JavaScript.
    $('.kn-header a[href^="#"],.kn-footer a[href^="#"]').forEach(link => {
      const click = event => {
        const href = link.getAttribute('href');
        const target = href?.length > 1 && doc.getElementById(href.slice(1));
        if (!target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' });
        history.replaceState(null, '', href);
      };
      link.addEventListener('click', click);
      removers.push(() => link.removeEventListener('click', click));
    });
    cleanup = () => {
      stopped = true;
      observers.forEach(observer => observer.disconnect());
      animations.forEach(animation => animation.cancel());
      animations.clear();
      removers.forEach(remove => remove());
    };
  }

  const boot = () => {
    start();
    reduced.addEventListener('change', start);
    addEventListener('pagehide', () => { cleanup(); reduced.removeEventListener('change', start); }, { once: true });
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}

export const architectureMotionScript = `(${architectureMotion.toString()})();`;
