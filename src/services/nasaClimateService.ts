export interface WeeklyClimatePoint {
  week: number;
  temp_low_c: number;
  temp_high_c: number;
  rainfall_mm: number;
  soil_moisture: number; // 0 to 1 fractional wetness (NASA POWER GWETROOT / SMAP proxy)
}

export interface NasaFieldEnvironment {
  coordinates: { latitude: number; longitude: number };
  elevation_m: number;
  slope_percent: number;
  soil: {
    sand_pct: number;
    silt_pct: number;
    clay_pct: number;
    texture_class: string;
    organic_carbon_g_kg: number;
    organic_matter_level: 'low' | 'medium' | 'high';
  };
  climate_summary: {
    annual_rainfall_mm: number;
    mean_temp_c: number;
    mean_soil_moisture: number;
    last_spring_frost_week: number;
    first_fall_frost_week: number;
    frost_free_weeks: number;
  };
  weekly_series: WeeklyClimatePoint[];
  data_sources: string[];
}

function classifySoilTexture(sand: number, silt: number, clay: number): string {
  if (clay >= 40) return 'Clay';
  if (sand >= 70 && clay < 15) return 'Sandy Loam';
  if (silt >= 50 && clay < 27) return 'Silt Loam';
  if (clay >= 27 && clay < 40) return 'Clay Loam';
  return 'Loam';
}

export async function fetchNasaFieldEnvironment(
  latitude: number,
  longitude: number,
  geoJson?: GeoJSON.FeatureCollection
): Promise<NasaFieldEnvironment> {
  const lat = Number(latitude.toFixed(4));
  const lng = Number(longitude.toFixed(4));

  // Fetch NASA POWER Climatology, SoilGrids, and SRTM Elevation in parallel
  const [powerData, soilData, terrainData] = await Promise.all([
    fetchNasaPowerClimatology(lat, lng),
    fetchSoilGridsProperties(lat, lng),
    fetchSrtmSlopeAndElevation(lat, lng, geoJson),
  ]);

  return {
    coordinates: { latitude: lat, longitude: lng },
    elevation_m: terrainData.elevation_m,
    slope_percent: terrainData.slope_percent,
    soil: soilData,
    climate_summary: powerData.summary,
    weekly_series: powerData.weekly_series,
    data_sources: [
      'NASA POWER Agroclimatology (T2M_MIN, T2M_MAX, PRECTOTCORR, GWETROOT)',
      'ISRIC SoilGrids 250m (Sand/Silt/Clay & Soil Organic Carbon)',
      'NASA SRTM 30m Digital Elevation Model',
    ],
  };
}

async function fetchNasaPowerClimatology(lat: number, lng: number) {
  try {
    // NASA POWER Climatology API provides multi-year daily/monthly averages without API keys
    const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M_MIN,T2M_MAX,PRECTOTCORR,GWETROOT&community=AG&longitude=${lng}&latitude=${lat}&format=JSON`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`NASA POWER HTTP ${res.status}`);
    const json = await res.json();

    const params = json?.properties?.parameter || {};
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    // Expand 12 monthly climatology values into a smooth 52-week series for the simulation engine
    const weekly_series: WeeklyClimatePoint[] = [];
    for (let w = 1; w <= 52; w++) {
      const monthIdx = Math.min(11, Math.floor(((w - 1) / 52) * 12));
      const mKey = months[monthIdx];

      const tMin = Number(params.T2M_MIN?.[mKey] ?? 10);
      const tMax = Number(params.T2M_MAX?.[mKey] ?? 24);
      const dailyRainMm = Number(params.PRECTOTCORR?.[mKey] ?? 2.2);
      const wetness = Number(params.GWETROOT?.[mKey] ?? 0.52);

      weekly_series.push({
        week: w,
        temp_low_c: Number(tMin.toFixed(1)),
        temp_high_c: Number(tMax.toFixed(1)),
        rainfall_mm: Number((dailyRainMm * 7).toFixed(1)),
        soil_moisture: Number(Math.min(1, Math.max(0.05, wetness)).toFixed(2)),
      });
    }

    // Estimate frost window from weeks where minimum temperature drops below 1.5°C
    let lastSpringFrost = 14;
    for (let w = 1; w <= 26; w++) {
      if (weekly_series[w - 1].temp_low_c <= 1.5) lastSpringFrost = w;
    }
    let firstFallFrost = 44;
    for (let w = 27; w <= 52; w++) {
      if (weekly_series[w - 1].temp_low_c <= 1.5) {
        firstFallFrost = w;
        break;
      }
    }

    const annualRain = weekly_series.reduce((acc, pt) => acc + pt.rainfall_mm, 0);
    const meanTemp =
      weekly_series.reduce((acc, pt) => acc + (pt.temp_low_c + pt.temp_high_c) / 2, 0) / 52;
    const meanMoisture =
      weekly_series.reduce((acc, pt) => acc + pt.soil_moisture, 0) / 52;

    return {
      weekly_series,
      summary: {
        annual_rainfall_mm: Math.round(annualRain),
        mean_temp_c: Number(meanTemp.toFixed(1)),
        mean_soil_moisture: Number(meanMoisture.toFixed(2)),
        last_spring_frost_week: lastSpringFrost,
        first_fall_frost_week: firstFallFrost,
        frost_free_weeks: Math.max(12, firstFallFrost - lastSpringFrost),
      },
    };
  } catch (err) {
    console.warn('NASA POWER fallback activated:', err);
    // Temperate agricultural baseline fallback if offline or rate-limited
    const weekly_series: WeeklyClimatePoint[] = Array.from({ length: 52 }, (_, idx) => {
      const w = idx + 1;
      const seasonal = Math.sin(((w - 14) / 52) * 2 * Math.PI);
      return {
        week: w,
        temp_low_c: Number((8 + seasonal * 10).toFixed(1)),
        temp_high_c: Number((20 + seasonal * 12).toFixed(1)),
        rainfall_mm: Number((16 - seasonal * 6).toFixed(1)),
        soil_moisture: Number((0.52 - seasonal * 0.14).toFixed(2)),
      };
    });

    return {
      weekly_series,
      summary: {
        annual_rainfall_mm: 832,
        mean_temp_c: 14.2,
        mean_soil_moisture: 0.52,
        last_spring_frost_week: 14,
        first_fall_frost_week: 44,
        frost_free_weeks: 30,
      },
    };
  }
}

async function fetchSoilGridsProperties(lat: number, lng: number) {
  try {
    const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lng}&lat=${lat}&property=sand&property=silt&property=clay&property=soc&depth=0-5cm&value=mean`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SoilGrids HTTP ${res.status}`);
    const json = await res.json();

    const layers = json?.properties?.layers || [];
    const getVal = (name: string, fallback: number) => {
      const layer = layers.find((l: { name: string }) => l.name === name);
      const raw = layer?.depths?.[0]?.values?.mean;
      return typeof raw === 'number' ? raw / 10 : fallback; // SoilGrids stores g/kg -> %
    };

    const sand = Math.round(getVal('sand', 40));
    const silt = Math.round(getVal('silt', 38));
    const clay = Math.round(getVal('clay', 22));
    const soc = Number(getVal('soc', 18).toFixed(1));

    const organic_matter_level: 'low' | 'medium' | 'high' =
      soc < 12 ? 'low' : soc > 25 ? 'high' : 'medium';

    return {
      sand_pct: sand,
      silt_pct: silt,
      clay_pct: clay,
      texture_class: classifySoilTexture(sand, silt, clay),
      organic_carbon_g_kg: soc,
      organic_matter_level,
    };
  } catch (err) {
    console.warn('SoilGrids fallback activated:', err);
    return {
      sand_pct: 42,
      silt_pct: 36,
      clay_pct: 22,
      texture_class: 'Loam',
      organic_carbon_g_kg: 17.5,
      organic_matter_level: 'medium' as const,
    };
  }
}

async function fetchSrtmSlopeAndElevation(
  lat: number,
  lng: number,
  geoJson?: GeoJSON.FeatureCollection
) {
  try {
    // Sample centroid + 1 offset corner to estimate local terrain slope from SRTM
    const ring =
      geoJson?.features?.[0]?.geometry?.type === 'Polygon'
        ? geoJson.features[0].geometry.coordinates[0]
        : null;

    const p2Lat = ring && ring[0] ? ring[0][1] : lat + 0.001;
    const p2Lng = ring && ring[0] ? ring[0][0] : lng + 0.001;

    const url = `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}|${p2Lat},${p2Lng}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SRTM Elevation HTTP ${res.status}`);
    const json = await res.json();

    const e1 = Number(json?.results?.[0]?.elevation ?? 120);
    const e2 = Number(json?.results?.[1]?.elevation ?? e1 + 1.5);
    const runMeters = Math.max(30, Math.hypot((p2Lat - lat) * 111320, (p2Lng - lng) * 85000));
    const slope = Number(Math.min(25, Math.max(0.5, (Math.abs(e2 - e1) / runMeters) * 100)).toFixed(1));

    return { elevation_m: Math.round(e1), slope_percent: slope };
  } catch {
    return { elevation_m: 145, slope_percent: 2.4 };
  }
}