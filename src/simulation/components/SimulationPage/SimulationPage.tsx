import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { useMemo, useRef, useState } from "react";
import cropsJson from "../../data/crops.json";
import demoFieldJson from "../../fixtures/demo-field.json";
import { runSimulation } from "../../engine";
import { getFrostWeeks } from "../../engine/frost";
import { buildTimeline } from "../../engine/timeline";
import type { CropsById, FieldJson, RotationSlot } from "../../engine/types";
import AppFooter from "../AppFooter/AppFooter";
import AppHeader from "../AppHeader/AppHeader";
import PlaybackControls from "../PlaybackControls/PlaybackControls";
import RotationLane from "../RotationLane/RotationLane";
import type { DragSwapData } from "../Timeline/useDragSwap";
import { usePlayback } from "../Timeline/usePlayback";
import Toolbar from "../Toolbar/Toolbar";
import type { ScoredRotationStrategy } from "../types";
import { swapAlternateCrop, swapTemplateSlots } from "./timelineEdits";
import { useFlipReorder } from "./useFlipReorder";

const crops = cropsJson.crops as unknown as CropsById;
const originalDemoField = demoFieldJson as unknown as FieldJson;

const pageStyle: React.CSSProperties = {
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "32px 24px 48px",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  fontFamily: "var(--font-sans)",
};

function isSameTimeline(a: RotationSlot[], b: RotationSlot[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function SimulationPage() {
  const [fieldJson, setFieldJson] = useState<FieldJson>(originalDemoField);
  const frostWeeks = useMemo(() => getFrostWeeks(originalDemoField.climate_data.frost_dates), []);

  const scoredField = useMemo(() => runSimulation(fieldJson), [fieldJson]);
  const strategies = scoredField.rotation_strategies as ScoredRotationStrategy[];

  const weeklyTimelines = useMemo(
    () => strategies.map((strategy) => buildTimeline(strategy, crops, frostWeeks, 3)),
    [strategies, frostWeeks],
  );

  // One shared growth clock: every lane is driven by this same instance, so
  // they all grow in sync.
  const totalWeeks = weeklyTimelines[0].years * 52;
  const playback = usePlayback(totalWeeks);

  function applyTimelineChange(strategyIndex: number, newTimeline: RotationSlot[]) {
    setFieldJson((prev) => ({
      ...prev,
      rotation_strategies: prev.rotation_strategies.map((strategy, index) =>
        index === strategyIndex ? { ...strategy, timeline: newTimeline } : strategy,
      ),
    }));
    // An edit shows its result immediately rather than replaying the growth
    // animation from scratch.
    playback.jumpToEnd();
  }

  function handleSwapAlternate(strategyIndex: number, templateIndex: number) {
    applyTimelineChange(strategyIndex, swapAlternateCrop(fieldJson.rotation_strategies[strategyIndex].timeline, templateIndex));
  }

  function handleReset(strategyIndex: number) {
    applyTimelineChange(strategyIndex, originalDemoField.rotation_strategies[strategyIndex].timeline);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return; // dropping on bare soil (not droppable) or nowhere also lands here as `over: undefined`

    // Defense in depth on top of the UI's own highlight/dim and
    // swapTemplateSlots' own guard: only a same-season drop is a real swap.
    const activeData = active.data.current as DragSwapData | undefined;
    const overData = over.data.current as DragSwapData | undefined;
    if (!activeData || !overData || activeData.season !== overData.season) return;

    const [activeStrategyIndexStr, activeSlotIndexStr] = String(active.id).split(":");
    const [overStrategyIndexStr, overSlotIndexStr] = String(over.id).split(":");
    const activeStrategyIndex = Number(activeStrategyIndexStr);
    const overStrategyIndex = Number(overStrategyIndexStr);
    if (activeStrategyIndex !== overStrategyIndex) return; // no cross-lane swaps

    const timeline = fieldJson.rotation_strategies[activeStrategyIndex].timeline;
    const templateIndexA = Number(activeSlotIndexStr) % timeline.length;
    const templateIndexB = Number(overSlotIndexStr) % timeline.length;
    if (templateIndexA === templateIndexB) return;

    applyTimelineChange(activeStrategyIndex, swapTemplateSlots(timeline, templateIndexA, templateIndexB));
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Rank 1 = highest overall_success_score. Lanes render in rank order, and
  // useFlipReorder animates them sliding to a new position if an edit
  // changes the ranking.
  const rankedEntries = useMemo(
    () =>
      strategies
        .map((strategy, index) => ({ strategy, index }))
        .sort(
          (a, b) =>
            (b.strategy.simulation_scores.overall_success_score ?? 0) -
            (a.strategy.simulation_scores.overall_success_score ?? 0),
        ),
    [strategies],
  );

  const laneNodesRef = useRef<Map<string, HTMLDivElement>>(new Map());
  useFlipReorder(
    rankedEntries.map((entry) => entry.strategy.strategy_id),
    (id) => laneNodesRef.current.get(id) ?? null,
  );

  return (
    <>
      <AppHeader fieldProfile={originalDemoField.field_profile} />
      <div style={pageStyle}>
        <Toolbar />
        <PlaybackControls playback={playback} />
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          {rankedEntries.map(({ strategy, index }, rankPosition) => (
            <RotationLane
              key={strategy.strategy_id}
              ref={(node) => {
                if (node) laneNodesRef.current.set(strategy.strategy_id, node);
                else laneNodesRef.current.delete(strategy.strategy_id);
              }}
              strategy={strategy}
              weeklyTimeline={weeklyTimelines[index]}
              crops={crops}
              playback={playback}
              rank={rankPosition + 1}
              strategyIndex={index}
              templateLength={fieldJson.rotation_strategies[index].timeline.length}
              isEdited={!isSameTimeline(fieldJson.rotation_strategies[index].timeline, originalDemoField.rotation_strategies[index].timeline)}
              onSwapAlternate={(templateIndex) => handleSwapAlternate(index, templateIndex)}
              onReset={() => handleReset(index)}
            />
          ))}
        </DndContext>
      </div>
      <AppFooter />
    </>
  );
}
