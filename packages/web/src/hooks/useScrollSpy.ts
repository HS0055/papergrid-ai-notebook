import { useState, useEffect } from 'react';

/**
 * Returns the ID of the section currently most visible in the viewport.
 * Uses IntersectionObserver for performance (no scroll listener).
 */
export function useScrollSpy(sectionIds: string[], offset = 100): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const visibleMap = new Map<string, number>();

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              visibleMap.set(id, entry.intersectionRatio);
            } else {
              visibleMap.delete(id);
            }

            // Find the section with highest intersection ratio
            let maxRatio = 0;
            let maxId: string | null = null;
            visibleMap.forEach((ratio, sId) => {
              if (ratio > maxRatio) {
                maxRatio = ratio;
                maxId = sId;
              }
            });
            setActiveId(maxId);
          });
        },
        {
          rootMargin: `-${offset}px 0px -40% 0px`,
          threshold: [0, 0.25, 0.5, 0.75, 1],
        },
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => {
      observers.forEach((obs) => obs.disconnect());
    };
  }, [sectionIds, offset]);

  return activeId;
}
