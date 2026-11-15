import { useLayoutEffect, useRef } from "react";

const REORDER_TRANSITION = "transform 350ms ease";

/**
 * Animates DOM nodes sliding to their new position when `orderedIds`
 * changes order (FLIP: First/Last/Invert/Play) — used so lanes visibly move
 * to their new rank instead of instantly jumping when an edit re-sorts them.
 * `getNode(id)` must return the same element across renders for a given id.
 */
export function useFlipReorder(orderedIds: string[], getNode: (id: string) => HTMLElement | null): void {
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const orderKey = orderedIds.join(",");

  useLayoutEffect(() => {
    const nextRects = new Map<string, DOMRect>();
    for (const id of orderedIds) {
      const node = getNode(id);
      if (node) nextRects.set(id, node.getBoundingClientRect());
    }

    for (const id of orderedIds) {
      const node = getNode(id);
      const prevRect = prevRectsRef.current.get(id);
      const nextRect = nextRects.get(id);
      if (!node || !prevRect || !nextRect) continue;

      const deltaY = prevRect.top - nextRect.top;
      if (deltaY === 0) continue;

      node.style.transition = "none";
      node.style.transform = `translateY(${deltaY}px)`;
      // Force a reflow so the "start" transform above actually applies
      // before we transition to the resting position.
      void node.offsetHeight;
      node.style.transition = REORDER_TRANSITION;
      node.style.transform = "translateY(0)";
    }

    prevRectsRef.current = nextRects;
    // orderKey (not orderedIds/getNode) is the real dependency — only react
    // when the actual order changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey]);
}
