import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

/**
 * A single timeline segment that's both a drag source and a drop target
 * (so dropping crop A onto crop B's slot swaps them, and either side can
 * initiate the drag). `id` encodes "<strategyIndex>:<expandedSlotIndex>" —
 * SimulationPage's onDragEnd resolves both sides back to template slot
 * indices and performs the actual swap.
 */
export function useDragSwap(id: string) {
  const draggable = useDraggable({ id });
  const droppable = useDroppable({ id });

  function setNodeRef(node: HTMLElement | null) {
    draggable.setNodeRef(node);
    droppable.setNodeRef(node);
  }

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(draggable.transform),
    cursor: "grab",
    zIndex: draggable.isDragging ? 10 : undefined,
    outline: droppable.isOver ? "2px dashed var(--color-olive)" : undefined,
    outlineOffset: droppable.isOver ? "-2px" : undefined,
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
