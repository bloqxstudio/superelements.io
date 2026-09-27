(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = document.querySelector('[data-header]');

  const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 24);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  if (!reducedMotion) {
    document.documentElement.classList.add('motion-ready');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const siblings = [...(entry.target.parentElement?.querySelectorAll(':scope > [data-reveal]') || [])];
        const index = Math.max(0, siblings.indexOf(entry.target));
        entry.target.animate(
          [
            { opacity: 0, transform: 'translateY(32px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 700, delay: Math.min(index * 90, 270), easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' },
        );
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -5% 0px' });
    document.querySelectorAll('[data-reveal]').forEach((element) => observer.observe(element));

    const stage = document.querySelector('[data-parallax-stage]');
    const floatingCards = document.querySelectorAll('[data-float-card]');
    stage?.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      const rect = stage.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      floatingCards.forEach((card, index) => {
        const depth = index === 0 ? 18 : -14;
        card.animate(
          { transform: `translate3d(${x * depth}px, ${y * depth}px, 0) rotate(${x * 1.5}deg)` },
          { duration: 450, fill: 'forwards', easing: 'cubic-bezier(.2,.7,.2,1)' },
        );
      });
    });
    stage?.addEventListener('pointerleave', () => floatingCards.forEach((card) => card.animate({ transform: 'translate3d(0,0,0) rotate(0)' }, { duration: 650, fill: 'forwards', easing: 'cubic-bezier(.16,1,.3,1)' })));

    document.querySelectorAll('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        if (event.pointerType === 'touch') return;
        const rect = card.getBoundingClientRect();
        const rotateY = ((event.clientX - rect.left) / rect.width - 0.5) * 7;
        const rotateX = -((event.clientY - rect.top) / rect.height - 0.5) * 7;
        card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
      });
      card.addEventListener('pointerleave', () => {
        card.style.transition = 'transform 500ms cubic-bezier(.16,1,.3,1)';
        card.style.transform = '';
        window.setTimeout(() => { card.style.transition = ''; }, 520);
      });
    });
  } else {
    document.querySelectorAll('[data-reveal]').forEach((element) => element.classList.add('is-visible'));
  }

  const buttons = [...document.querySelectorAll('[data-tab]')];
  const panels = [...document.querySelectorAll('[data-panel]')];
  const activateTab = (name) => {
    buttons.forEach((button) => {
      const active = button.dataset.tab === name;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => {
      const active = panel.dataset.panel === name;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
      if (active && !reducedMotion) panel.animate([{ opacity: 0, transform: 'scale(.985)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)' });
    });
  };
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => activateTab(button.dataset.tab));
    button.addEventListener('keydown', (event) => {
      if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
      event.preventDefault();
      const nextIndex = (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[nextIndex].focus();
      activateTab(buttons[nextIndex].dataset.tab);
    });
  });

  document.querySelector('[data-lead-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = form.querySelector('.form-feedback');
    const name = new FormData(form).get('nome')?.toString().trim().split(' ')[0] || 'Tudo certo';
    feedback.textContent = `${name}, esta é uma demonstração. Nenhum dado foi enviado.`;
    form.querySelector('button').textContent = 'Interesse registrado na demonstração';
  });
})();
