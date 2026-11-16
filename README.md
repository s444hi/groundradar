# Ground Radar

Ground Radar helps farmers and gardeners plan crop rotations. You trace your field on a satellite map and answer a short survey. Ground Radar then pulls NASA climate data, soil surveys and terrain for that exact spot and builds three rotation plans. An interactive simulation plays rotations forward season by season, so you can see how soil, water, pests and income are likely to change.

> **This supports, not replaces, your judgment.** Every score and estimate is a planning aid. Check it against local knowledge before you act on it.

## How it works

1. **Trace your field.** Search for a place, then draw the field's outline on a Mapbox satellite map. Turf works out the area and centre point.
2. **Answer the survey.** Choose farm or garden (suggested from the area you traced). Pick the crop you plan to grow and the one grown there last. Set how much you care about water, income, soil health and pests on 0–10 sliders. You can also add 3–6 ground photos and notes.
3. **Read your field report.** Ground Radar fetches climate, soil and elevation data for the field, reads your photos, and builds three crop rotation plans. The Results page explains each plan and the evidence behind it, shows a MODIS NDVI snapshot of the area, and has a Field Agronomist chat for follow-up questions.
4. **Run the simulation.** Press **Enter Simulation** to open the interactive rotation simulator (**← Back to Crop Plans** returns you to the report). It has:
   - three ranked rotation lanes, side by side
   - multi-year rotations with no length limit
   - drag to reorder crops within a season, or swap in an alternate crop
   - bare-soil gaps that open a cover-crop picker
   - priority sliders that re-score every lane live
   - **Find a better order**, which searches for a higher-scoring rotation
   - pixel-art growth playback, week by week
   - a breakdown panel with the reasoning, per-season score changes, confidence and things to check locally

## Data sources

| Data | Source | Used for |
| --- | --- | --- |
| Climate | [NASA POWER](https://power.larc.nasa.gov/) Agroclimatology climatology API (min/max temperature, precipitation, surface and root-zone wetness, solar radiation, evapotranspiration) | Frost weeks, the weekly climate timeline, water balance |
| Vegetation | NASA GIBS MODIS Terra 8-day NDVI | Satellite snapshot on the Results page |
| Soil | USDA NRCS SSURGO (Soil Data Access), falling back to [ISRIC SoilGrids](https://soilgrids.org/) 250 m outside its coverage | Texture, sand/silt/clay, organic carbon, drainage |
| Terrain | SRTM elevation via the [Open-Elevation](https://open-elevation.com/) API | Elevation and slope |
| Photos and chat | Google Gemini 2.5 Flash, called through a Supabase Edge Function | Reading field photos, Field Agronomist answers |
| Accounts and storage | [Supabase](https://supabase.com/) | Sign-in, saved fields and analyses, photos, chat logs |

Apart from the Mapbox map, every data source has a fallback. If a service is down or a key is missing, Ground Radar uses built-in defaults or the next source in line and keeps going.

## Getting started

You need Node.js 20.19+ or 22.12+ (Vite 8 requires one of these) and npm.

```bash
git clone https://github.com/s444hi/groundradar.git
cd groundradar
npm install
cp .env.example .env   # then fill in your keys (see below)
npm run dev
```

Then open the local URL Vite prints, usually <http://localhost:5173>.

### Environment variables

| Variable | Used for | Without it |
| --- | --- | --- |
| `VITE_MAPBOX_ACCESS_TOKEN` | The satellite map and location search | The map won't load. **This is the one key you need.** |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Sign-in, saving fields, and reaching the Gemini function | Use **Try Live Demo as Guest**. Results stay in the browser and aren't saved, and photo diagnosis and chat use the built-in fallback. |

`.env` is gitignored. Anything prefixed `VITE_` is bundled into the client JavaScript, so only keys that are meant to be public go there. The Mapbox token is a public token, so restrict it to your app's URLs in your Mapbox account. The Supabase anon key is protected by Row Level Security, so turn RLS on for every table. The Gemini key is **not** a `VITE_` variable: it's stored as a Supabase secret and never reaches the browser (see below).

### Supabase setup (optional)

The app uses Supabase email/password auth, three tables, one storage bucket and one Edge Function:

- `fields`: the traced polygon, location, area and mode
- `field_analyses`: the survey, NASA environment, soil, plans and the selected simulation strategy
- `field_chat_logs`: Field Agronomist questions and answers
- `field-photos` storage bucket (public URLs): uploaded ground photos
- `gemini` Edge Function ([`supabase/functions/gemini/`](supabase/functions/gemini/)): forwards photo-reading and chat requests to Gemini using a server-side key

There's no migration in the repo yet. The columns match the inserts in [`src/services/supabaseService.ts`](src/services/supabaseService.ts).

To turn on Gemini, deploy the function and give it your key with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <your-project-ref>
supabase secrets set GEMINI_API_KEY=<your-gemini-key>
supabase functions deploy gemini
```

Until the function is deployed, photo diagnosis and chat replies are built from the field's NASA and soil data instead.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run Vitest in watch mode (`npx vitest run` for a single pass) |
| `npm run lint` | Lint with oxlint |

## Project structure

```
src/
  App.tsx                     the three-step flow: trace → results → simulation
  components/                 sign-in, map tracer, survey, Results page
  services/
    nasaClimateService.ts     NASA POWER, GIBS, soil and elevation lookups
    rotationGeneratorService.ts  builds the three plans; photo reading and chat via the gemini function
    supabaseService.ts        auth client, saving fields, analyses, photos and chat
  simulation/
    engine/                   the simulation: pure TypeScript, no React or network, unit-tested
    components/               the simulation UI
    data/crops.json           the only source of crop traits (cash crops, cover crops and fallow)
    fixtures/demo-field.json  the demo field the simulation runs on
  styles/theme.css            shared colors, fonts and radii as CSS variables
supabase/functions/gemini/    Edge Function that holds the Gemini key server-side
docs/design-reference.png     visual reference for the design system
CLAUDE.md                     full engine rules, data contract and design system
```

## The simulation engine

The entry point is `runSimulation(fieldJson)` in [`src/simulation/engine/index.ts`](src/simulation/engine/index.ts). It is deterministic, so the same field always gives the same scores. For each rotation it:

1. converts the field's frost dates to weeks of the year and works out each crop's planting window
2. sets starting nitrogen, moisture, organic matter and pest pressure from the soil data and past rotation
3. repeats the rotation for 3 years so carryover effects show up
4. builds a weekly timeline, counting gaps and fallow as bare soil
5. scores every season on season fit, water, nitrogen, pests, erosion and income, with a plain-English reason for every point gained or lost
6. updates the soil between seasons (legumes add nitrogen, heavy feeders drain it, cover crops build organic matter, repeated plant families build pest pressure)
7. weights the scores by your priorities, then rates its confidence and lists what to check locally

**Find a better order** is a local search. It tries swapping pairs of seasons and putting cover crops into bare gaps, keeps any change that raises the overall score, and stops when nothing improves. The full rules are in [`CLAUDE.md`](CLAUDE.md).

## Known limitations

- **The simulation doesn't use your traced field yet.** It runs on the built-in demo field in `src/simulation/fixtures/demo-field.json`, a 4.2-acre farm near Folsom, California, with its own three strategies. Connecting the Results-page plans to the simulation is the next step.
- The Results-page plans are 2-year schedules. The simulation repeats each rotation for 3 years.
- Irrigation and nitrogen figures are rough estimates and are labelled that way in the UI.
- Soil and climate data come from coarse global datasets, so confidence drops for very small plots.

## Team

- **Saahithya Venkatraghavan**: the rotation simulation and its engine (`src/simulation/`)
- **Anannya Gairola**: sign-in, field tracing, the survey, the NASA and soil data pipeline, the Results page and the Field Agronomist chat

## ACCESS DEPLOYED WEB-APP : https://groundradar-5lh7-dpai8aecf-tiyags-projects.vercel.app

