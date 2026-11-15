import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { useMemo, useRef, useState } from "react";
import cropsJson from "../../data/crops.json";
import demoFieldJson from "../../fixtures/demo-field.json";
import { runSimulation } from "../../engine";
import { getFrostWeeks } from "../../engine/frost";
import { findBetterRotation } from "../../engine/optimize";
import { simulateStrategy } from "../../engine/simulate";
import { buildTimeline } from "../../engine/timeline";
import type { CropId, CropsById, FieldJson, Priorities, RotationSlot } from "../../engine/types";
import AppFooter from "../AppFooter/AppFooter";
import AppHeader from "../AppHeader/AppHeader";
import type { CoverCropOptionWithDelta } from "../CoverCropPicker/CoverCropPicker";
import {
  coverCropReason,
  fillFallowSlot,
  gapOwnsAFallowSlot,
  getCoverCropOptions,
  insertCoverCropSlot,
  removeCoverCropSlot,
} from "../CoverCropPicker/coverCropEdits";
import type { GapInfo } from "../CoverCropPicker/coverCropEdits";
import PlaybackControls from "../PlaybackControls/PlaybackControls";
import PrioritySliders from "../PrioritySliders/PrioritySliders";
import RotationLane from "../RotationLane/RotationLane";
import type { DragSwapData } from "../Timeline/useDragSwap";
import { usePlayback } from "../Timeline/usePlayback";
import Toolbar from "../Toolbar/Toolbar";
import type { OptimizerSuggestion, ScoredRotationStrategy } from "../types";
import { describeChanges } from "./describeChanges";
import { swapAlternateCrop, swapTemplateSlots } from "./timelineEdits";
import { useFlipReorder } from "./useFlipReorder";

const MIN_SUGGESTION_IMPROVEMENT = 1;

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

const noImprovementStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "13px",
  color: "var(--color-text-muted)",
  margin: "0 0 20px 0",
};

function isSameTimeline(a: RotationSlot[], b: RotationSlot[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface OpenGap {
  key: string; // "<strategyIndex>:<expandedSlotIndex>", matching the drag id scheme
  strategyIndex: number;
  templateIndex: number;
  gapInfo: GapInfo;
}

export default function SimulationPage() {
  const [fieldJson, setFieldJson] = useState<FieldJson>(originalDemoField);
  const [prioritiesOpen, setPrioritiesOpen] = useState(false);
  const [openGap, setOpenGap] = useState<OpenGap | null>(null);
  const [suggestions, setSuggestions] = useState<Record<number, OptimizerSuggestion>>({});
  const [optimizerRanWithNoImprovement, setOptimizerRanWithNoImprovement] = useState(false);
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
    // Any edit to this lane (drag, alternate swap, reset, cover crop, or
    // accepting the suggestion itself) invalidates whatever "Find a better
    // order" suggestion was pending for it — it was computed against the
    // timeline this just replaced.
    setSuggestions((prev) => {
      if (!(strategyIndex in prev)) return prev;
      const next = { ...prev };
      delete next[strategyIndex];
      return next;
    });
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

  function handlePrioritiesChange(newPriorities: Priorities) {
    setFieldJson((prev) => ({
      ...prev,
      survey_inputs: { ...prev.survey_inputs, priorities: newPriorities },
    }));
    // Every pending suggestion's before/after scores (and possibly the
    // move itself) were computed under the old weighting.
    setSuggestions({});
    setOptimizerRanWithNoImprovement(false);
    // Same "show the result immediately" behavior as a timeline edit.
    playback.jumpToEnd();
  }

  function handleResetPriorities() {
    handlePrioritiesChange(originalDemoField.survey_inputs.priorities);
  }

  function handleToggleGap(gapKey: string, templateIndex: number, gapInfo: GapInfo) {
    if (openGap?.key === gapKey) {
      setOpenGap(null);
      return;
    }
    const strategyIndex = Number(gapKey.split(":")[0]);
    setOpenGap({ key: gapKey, strategyIndex, templateIndex, gapInfo });
  }

  function handleClosePicker() {
    setOpenGap(null);
  }

  // Computed only for whichever gap is currently open (at most one at a
  // time): each candidate's predicted overall_success_score change comes
  // from actually running the engine on a hypothetical edited timeline, not
  // an estimate.
  const pickerOptions = useMemo<CoverCropOptionWithDelta[]>(() => {
    if (!openGap) return [];
    const strategy = fieldJson.rotation_strategies[openGap.strategyIndex];
    const candidateIds = getCoverCropOptions(openGap.gapInfo, crops, frostWeeks, fieldJson.field_profile.mode);
    const currentScore = strategies[openGap.strategyIndex].simulation_scores.overall_success_score ?? 0;
    const isFallow = gapOwnsAFallowSlot(strategy.timeline, openGap.templateIndex, crops);

    return candidateIds.map((cropId) => {
      const alternateIds = candidateIds.filter((id) => id !== cropId);
      const newTimeline = isFallow
        ? fillFallowSlot(strategy.timeline, openGap.templateIndex, cropId, alternateIds)
        : insertCoverCropSlot(strategy.timeline, openGap.templateIndex, cropId, alternateIds, crops);
      const result = simulateStrategy({
        strategy: { ...strategy, timeline: newTimeline },
        crops,
        soil: fieldJson.field_profile.soil,
        pastRotation: fieldJson.survey_inputs.past_rotation,
        frostDates: fieldJson.climate_data.frost_dates,
        weeklyClimatology: fieldJson.climate_data.weekly_climatology,
        slopePercent: fieldJson.field_profile.slope_percent,
        priorities: fieldJson.survey_inputs.priorities,
      });
      const newScore = result.overall_success_score ?? 0;
      return { cropId, reason: coverCropReason(crops[cropId]), scoreDelta: newScore - currentScore };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openGap, fieldJson, strategies]);

  function handlePickCoverCrop(cropId: CropId) {
    if (!openGap) return;
    const { strategyIndex, templateIndex, gapInfo } = openGap;
    const timeline = fieldJson.rotation_strategies[strategyIndex].timeline;
    const candidateIds = getCoverCropOptions(gapInfo, crops, frostWeeks, fieldJson.field_profile.mode);
    const alternateIds = candidateIds.filter((id) => id !== cropId);
    const isFallow = gapOwnsAFallowSlot(timeline, templateIndex, crops);
    const newTimeline = isFallow
      ? fillFallowSlot(timeline, templateIndex, cropId, alternateIds)
      : insertCoverCropSlot(timeline, templateIndex, cropId, alternateIds, crops);
    applyTimelineChange(strategyIndex, newTimeline);
    setOpenGap(null);
  }

  function handleRemoveCoverCrop(strategyIndex: number, templateIndex: number) {
    const timeline = fieldJson.rotation_strategies[strategyIndex].timeline;
    const originalTimeline = originalDemoField.rotation_strategies[strategyIndex].timeline;
    applyTimelineChange(strategyIndex, removeCoverCropSlot(timeline, originalTimeline, templateIndex, crops));
  }

  function handleFindBetterOrder() {
    const nextSuggestions: Record<number, OptimizerSuggestion> = {};

    fieldJson.rotation_strategies.forEach((strategy, strategyIndex) => {
      const startingScore = strategies[strategyIndex].simulation_scores.overall_success_score ?? 0;
      const result = findBetterRotation(strategy, {
        crops,
        soil: fieldJson.field_profile.soil,
        pastRotation: fieldJson.survey_inputs.past_rotation,
        frostDates: fieldJson.climate_data.frost_dates,
        weeklyClimatology: fieldJson.climate_data.weekly_climatology,
        slopePercent: fieldJson.field_profile.slope_percent,
        priorities: fieldJson.survey_inputs.priorities,
        mode: fieldJson.field_profile.mode,
      });

      if (!result.improved || result.overallScore - startingScore < MIN_SUGGESTION_IMPROVEMENT) return;

      const changedTemplateIndices = new Set<number>();
      for (let i = 0; i < strategy.timeline.length; i++) {
        if (JSON.stringify(strategy.timeline[i].crops) !== JSON.stringify(result.strategy.timeline[i].crops)) {
          changedTemplateIndices.add(i);
        }
      }

      nextSuggestions[strategyIndex] = {
        newTimeline: result.strategy.timeline,
        beforeScore: startingScore,
        afterScore: result.overallScore,
        changes: describeChanges(strategy.timeline, result.strategy.timeline, crops),
        changedTemplateIndices,
        proposedTimeline: buildTimeline({ ...strategy, timeline: result.strategy.timeline }, crops, frostWeeks, 3),
      };
    });

    setSuggestions(nextSuggestions);
    setOptimizerRanWithNoImprovement(Object.keys(nextSuggestions).length === 0);
  }

  function handleAcceptSuggestion(strategyIndex: number) {
    const suggestion = suggestions[strategyIndex];
    if (!suggestion) return;
    applyTimelineChange(strategyIndex, suggestion.newTimeline);
  }

  function handleDismissSuggestion(strategyIndex: number) {
    setSuggestions((prev) => {
      const next = { ...prev };
      delete next[strategyIndex];
      return next;
    });
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
        <Toolbar
          prioritiesOpen={prioritiesOpen}
          onTogglePriorities={() => setPrioritiesOpen((open) => !open)}
          onFindBetterOrder={handleFindBetterOrder}
        />
        {prioritiesOpen && (
          <PrioritySliders
            priorities={fieldJson.survey_inputs.priorities}
            onChange={handlePrioritiesChange}
            onReset={handleResetPriorities}
          />
        )}
        {optimizerRanWithNoImprovement && (
          <p style={noImprovementStyle}>These are already the best orders we can find.</p>
        )}
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
              openGapKey={openGap?.key ?? null}
              pickerOptions={pickerOptions}
              onToggleGap={handleToggleGap}
              onClosePicker={handleClosePicker}
              onPickCoverCrop={handlePickCoverCrop}
              onRemoveCoverCrop={(templateIndex) => handleRemoveCoverCrop(index, templateIndex)}
              suggestion={suggestions[index] ?? null}
              onAcceptSuggestion={() => handleAcceptSuggestion(index)}
              onDismissSuggestion={() => handleDismissSuggestion(index)}
            />
          ))}
        </DndContext>
      </div>
      <AppFooter />
    </>
  );
}
