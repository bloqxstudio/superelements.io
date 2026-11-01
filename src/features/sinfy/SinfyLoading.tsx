import React, { useEffect, useState } from 'react';
import { SinfyWordmark } from './SinfyBrand';

/** Aguarda a fonte da LP, com saída garantida mesmo sem rede. */
export function SinfyLoading() {
  const [phase, setPhase] = useState<'loading' | 'leaving' | 'done'>('loading');

  useEffect(() => {
    let active = true;
    let released = false;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    const release = () => {
      if (!active || released) return;
      released = true;
      clearTimeout(fallback);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setPhase('done');
      } else {
        setPhase('leaving');
        exitTimer = setTimeout(() => { if (active) setPhase('done'); }, 200);
      }
    };
    const fallback = setTimeout(release, 1800);
    if (document.fonts) {
      document.fonts.load('500 16px Inter').then(release, release);
    } else {
      release();
    }
    return () => {
      active = false;
      clearTimeout(fallback);
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, []);

  if (phase === 'done') return null;
  return <div className={`sinfy-loading${phase === 'leaving' ? ' is-leaving' : ''}`} role="status" aria-live="polite" aria-hidden={phase === 'leaving'}>
    <SinfyWordmark />
    <span className="sinfy-loading__track" aria-hidden="true"><i /></span>
    <span className="sinfy-loading__label">Carregando Sinfy</span>
  </div>;
}
