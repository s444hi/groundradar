import { useDndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useCallback } from "react";
import type { Season } from "../../engine/types";

export interface DragSwapData {
  season: Season;
}

/**
 * A single timeline segment that's both a drag source and a drop target
 * (so dropping crop A onto crop B's slot swaps them, and either side can
 * initiate the drag). `id` encodes "<strategyIndex>:<expandedSlotIndex>" —
 * SimulationPage's onDragEnd resolves both sides back to template slot
 * indices and performs the actual swap. `data.season` lets this hook (via
 * dnd-kit's global drag context, no prop-drilling needed) highlight itself
 * while a same-lane, same-season drag is in progress — the only case that
 * can actually be swapped — and dim itself otherwise, so "highlighted"
 * always means "would really do something if dropped here."
 */
export function useDragSwap(id: string, data: DragSwapData) {
  const draggable = useDraggable({ id, data });
  const droppable = useDroppable({ id, data });
  const { active } = useDndContext();

  // Must stay referentially stable across renders: a new ref-callback
  // identity makes React detach/reattach the DOM node on every render, and
  // this component now re-renders on every pointer-move while any drag is
  // active (via useDndContext), which was otherwise silently corrupting
  // dnd-kit's own tracking of the active drag mid-gesture.
  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      draggable.setNodeRef(node);
      droppable.setNodeRef(node);
    },
    // Only the two setNodeRef functions themselves matter here, and dnd-kit
    // keeps those specific references stable across renders — depending on
    // the whole draggable/droppable objects would defeat the memoization,
    // since those objects are recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draggable.setNodeRef, droppable.setNodeRef],
  );

  const activeData = active?.data.current as DragSwapData | undefined;
  const isSelf = active?.id === id;
  const dragInProgress = active != null;
  // id encodes "<strategyIndex>:<expandedSlotIndex>" — cross-lane drops are
  // already a no-op in SimulationPage's onDragEnd, so a cross-lane target
  // should never show as a valid (highlighted) drop zone either.
  const sameLane = active != null && String(active.id).split(":")[0] === id.split(":")[0];
  const highlight = dragInProgress && !isSelf && sameLane && activeData?.season === data.season;
  const dim = dragInProgress && !isSelf && !highlight;

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(draggable.transform),
    cursor: "grab",
    zIndex: draggable.isDragging ? 10 : undefined,
    opacity: dim ? 0.35 : 1,
    outline: droppable.isOver && highlight ? "2px solid var(--color-olive)" : highlight ? "2px dashed var(--color-olive)" : undefined,
    outlineOffset: "-2px",
    transition: "opacity 120ms ease",
  };

  return {
    setNodeRef,
    attributes: draggable.attributes,
    listeners: draggable.listeners,
    style,
    isDragging: draggable.isDragging,
    isOver: droppable.isOver,
  };
}
