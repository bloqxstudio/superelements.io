import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadSectionRaw, toLibraryComponent, type PackComponent, type PackEntry } from './pack';

/**
 * Lista paginada de seções do pack: abre só os JSONs da página visível e
 * carrega a próxima quando o elemento de `sentinelRef` chega perto da tela.
 */
export const usePagedPack = (entries: PackEntry[], pageSize: number) => {
  const [limit, setLimit] = useState(pageSize);
  const [components, setComponents] = useState<Map<string, PackComponent>>(() => new Map());
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const sentinelRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => entries.slice(0, limit), [entries, limit]);
  const hasMore = limit < entries.length;

  useEffect(() => {
    const missing = visible.filter((e) => !components.has(e.id) && !failed.has(e.id));
    if (!missing.length) return;
    let cancelled = false;

    Promise.all(
      missing.map((entry) =>
        loadSectionRaw(entry)
          .then((raw) => ({ entry, component: toLibraryComponent(entry, raw) }))
          .catch((error) => {
            console.error(`[section-pack] ${entry.file} não carregou:`, error);
            return { entry, component: null };
          }),
      ),
    ).then((results) => {
      if (cancelled) return;
      setComponents((prev) => {
        const next = new Map(prev);
        for (const { entry, component } of results) if (component) next.set(entry.id, component);
        return next;
      });
      const errors = results.filter((r) => !r.component).map((r) => r.entry.id);
      if (errors.length) setFailed((prev) => new Set([...prev, ...errors]));
    });

    return () => {
      cancelled = true;
    };
  }, [visible, components, failed]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setLimit((l) => l + pageSize);
      },
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, limit, pageSize]);

  /** Volta para a primeira página (ao trocar filtro ou busca). */
  const reset = useCallback(() => setLimit(pageSize), [pageSize]);

  return { visible, components, failed, hasMore, sentinelRef, reset };
};
