# Ground Radar: Simulation module

## Project
Ground Radar is a NASA Space Apps-style web app that helps farmers and gardeners explore crop rotations using NASA Earth data (NASA POWER, GPM, SMAP, ECOSTRESS, GRACE, Landsat/MODIS, SRTM), SoilGrids soil data, and farmer priorities. It supports, not replaces, farmer judgment.

## Built
- 3 ranked lanes
- Multi-year rotations (no length limit)
- Same-season drag-to-reorder
- Alternate-crop swaps
- Cover-crop picker on bare gaps
- Priority sliders
- Find a better order
- Pixel growth playback

## Team split
- Teammate: landing page, sign-in, dashboard steps (location, trace area, photo upload, survey), Results page, AI chatbot. Produces the field JSON described below.
- Me: the Simulation. Everything lives in `src/simulation/`. Do not edit files outside that folder without asking (exception: the shared `src/styles/theme.css` if I ask).

## Stack
React + TypeScript + Vite. Engine = pure TypeScript functions (no React, no network calls) so the teammate's Results page can call it too. Drag and drop: dnd-kit. Animation: HTML canvas + requestAnimationFrame. Tests: Vitest.

## Folder layout
```
src/styles/theme.css           shared colors, fonts, radii (CSS variables)
src/simulation/
  data/crops.json              shared crop list, the only source of crop traits
  fixtures/demo-field.json     teammate's demo field payload
  engine/                      types, frost, timeline, soil, scoring, simulate, confidence, flags, optimize
  engine/index.ts               runSimulation(fieldJson) - the public entry point for the Results page
  engine/__tests__/
  components/                  SimulationPage, ModeToggle, PrioritySliders, RotationCompare, RotationLane,
                               Timeline, CropCard, GapSlot, CoverCropPicker, ScoreBadge,
                               BreakdownPanel, Disclaimer
docs/design-reference.png      visual reference for the design system
```

## Input: field JSON from teammate
- field_profile: mode (farm|garden), location, area_acres, elevation_m, slope_percent, soil (texture_class, sand/silt/clay %, organic_carbon_g_kg, organic_matter_level, drainage_runoff_risk, nitrogen_level, pest_carryover_risk, pest_carryover_family). Levels are low|medium|high.
- survey_inputs: past_rotation and planned_rotation (slots with year, season warm_season|cool_season, crops = list of crop ids), priorities (water, income, soil_health, pests, each 0-10).
- climate_data: frost_dates (last_spring_frost and first_fall_frost as "MM-DD", frost_free_days), weekly_climatology (52 weeks: week, temp_low_c, temp_high_c, rainfall_mm, soil_moisture_m3_m3), long_term_trends, nasa_diagnostics_summary (includes typical_bare_soil_months).
- rotation_strategies (3): strategy_id, title, is_baseline, timeline slots (year, season, crops, alternate_crop_ids, is_mix, purpose), simulation_scores (my engine fills these), qualitative_analysis (why_suggested, nasa_evidence, benefits, information_gaps, local_risks_for_review).

## Output: what the engine fills into simulation_scores
All scores are 0-100 where higher = better:
- overall_success_score, water_efficiency_score, erosion_protection_score (renamed from erosion_risk_score), pest_break_score, season_fit_score, income_score
- soil_health_delta: change in soil health from start to end, -100 to +100
- estimated_irrigation_mm and nitrogen_balance_kg_ha: rough estimates, always labeled "estimate" in the UI
- confidence: level (High|Medium|Low) + reasons
- check_locally: list of flags
- seasons: per season, the year, season, crops, score, subscores, reasons (each with a point delta + plain-English text), and weather events (week + frost|drought|heavy_rain)

## Engine rules
1. Convert frost dates to week of year (1-52). Planting window = the crop's anchor frost week + its start/end offsets.
2. Starting soil (0-100 scales; low/medium/high = 25/50/75): nitrogen, moisture, organic matter from the field soil levels. Pest pressure per plant family starts from pest_carryover_family/risk plus the past rotation.
3. Repeat each strategy for 3 years by default so carryover shows.
4. Build a weekly timeline. A crop occupies its planting week through planting week + ceil(days_to_maturity / 7) - 1, i.e. exactly ceil(days_to_maturity / 7) weeks. Gaps and fallow count as bare soil.
5. Score each season. Every point change must produce a reason string.
   - Season fit: penalty if a non-frost-tolerant crop is in the ground during frost weeks, or it can't fit its planting window.
   - Water: crop water need vs. rainfall + soil moisture during its weeks.
   - Nitrogen: heavy feeders penalized on low nitrogen.
   - Pests: penalty if the same family was grown the previous season, scaled by pest pressure.
   - Erosion: bare weeks x heavy rain x slope. Deep roots and cover crops protect.
   - Income: from income_value.
6. Update soil after each season: nitrogen fixers add nitrogen, heavy feeders drain it, cover crops add organic matter, repeating a family raises that family's pest pressure, other families let it decay.
7. Mixes (is_mix) combine both crops' effects (e.g., clover's nitrogen + rye's erosion protection). Fallow = bare. Alternates are swappable in the UI.
8. Priority weighting: water -> water; soil_health -> nitrogen + erosion; pests -> pests; income -> income. Season fit always counts at full weight.
9. Confidence drops for small plots relative to NASA data resolution, crops missing from crops.json, or extreme weather weeks.
10. check_locally starts from the strategy's local_risks_for_review, then adds flags for: market prices (income priority >= 7), specific pests (a family repeats), irrigation access (water need exceeds rainfall).
11. Optimizer ("Find a better order"): local search. Try swapping pairs of slots and inserting cover crops into bare gaps, keep any change that raises overall_success_score, stop when nothing improves. No brute force, since rotation length has no limit.
12. Deterministic: same input always gives the same output. No randomness.

## UI rules
- Rotation mode shows 3 lanes side by side (the teammate's 3 strategies).
- Lanes: score badge + rank, draggable crop cards, swap button for alternates, brown bare-soil gaps that open a cover crop picker, play button.
- If a user edits a lane, show: "You changed this rotation, so the explanation is for the original."
- Priority sliders re-score all lanes live.
- BreakdownPanel: teammate's qualitative_analysis on top, my per-season reasons, confidence, and check_locally flags below.
- Always show the disclaimer: "This supports, not replaces, your judgment."

## Design system (match docs/design-reference.png)
Look: calm, editorial, earthy. Lots of white space, big serif headlines, olive/sage greens, pill buttons, soft rounded cards, hairline dividers, almost no shadows.

Colors:
- Background: #FFFFFF (page), #F7F6F2 (subtle section background)
- Text: #111111 (main), #6B6B66 (muted), #FFFFFF (on dark/olive)
- Primary olive (buttons, active states): #4B5A23, hover #3C4A1B
- Sage (panels, lane backgrounds): #95A07A
- Pale green (pills, tags, highlights): #DDE8C4
- Cream (cards, neutral blocks): #ECE6D8
- Border/dividers: #E5E4DE
- Sky (dino/timeline background, gradients): #C9D6E0 to #9FB4C4
- Sim colors: good #5F7A2E, warning #C9A23A (ochre), risk #B5543A (terracotta), bare soil #8B6B4A, cover crops #95A07A, water/rain #7FA1B8

Fonts (Google Fonts):
- Headlines + big numbers: "Newsreader" (serif), weight 400, letter-spacing -0.02em
- UI + body text: "DM Sans", weights 400/500
- Small data labels (weeks, years, units): "DM Mono"

Shapes and spacing:
- Buttons: fully rounded pills (999px radius), olive background, white text
- Cards and lanes: 20px radius, 1px #E5E4DE border, no heavy shadows
- Tags/pills: pale green background, olive text
- Section padding 24-48px, max content width ~1200px

Sim styling:
- Score badges use big Newsreader numerals, like the "78%" in the reference
- Lanes sit on sage or cream cards; the selected lane gets an olive border
- Timeline: crop cards as cream rounded blocks, bare gaps as brown striped blocks, cover crops in sage
- Charts: thin lines, small dot markers, DM Mono labels, no gridline clutter

## Conventions
- Never hard-code crop facts in code. Always read crops.json.
- Use theme.css variables for every color, font, and radius. No hard-coded hex values in components.
- Keep the engine pure and unit-tested.
- Show crop trait values and estimates as estimates in the UI.
- Commit after each build step.
- Never add Co-Authored-By or any other attribution lines to commit messages.