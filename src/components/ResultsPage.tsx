import React, { useState } from 'react';
import {
  Droplets,
  Sprout,
  Mountain,
  CloudRain,
  ShieldCheck,
  TrendingUp,
  MessageSquare,
  Send,
  Play,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Satellite,
  Sparkles,
} from 'lucide-react';
import cropsData from '../simulation/data/crops.json';
import {
  askFieldAgronomistLive,
  type GroundRadarAnalysisResult,
  type RotationStrategy,
} from '../services/rotationGeneratorService';
import {
  logFieldChatTurn,
  recordSelectedSimulationStrategy,
  type SavedAnalysisRecord,
} from '../services/supabaseService';

export interface SimulationHandoffPayload {
  analysisId: string;
  fieldId: string;
  mode: 'farm' | 'garden';
  area_acres: number;
  coordinates: { latitude: number; longitude: number };
  selected_strategy: RotationStrategy;
  past_rotation: GroundRadarAnalysisResult['survey']['past_rotation'];
  soil: GroundRadarAnalysisResult['nasa_environment']['soil'];
  climate_summary: GroundRadarAnalysisResult['nasa_environment']['climate_summary'];
  weekly_series: GroundRadarAnalysisResult['nasa_environment']['weekly_series'];
}

interface ResultsPageProps {
  analysis: GroundRadarAnalysisResult;
  savedRecord: SavedAnalysisRecord;
  onBackToMap: () => void;
  onEnterSimulation: (payload: SimulationHandoffPayload) => void;
}

interface ChatMessage {
  role: 'assistant' | 'user';
  text: string;
}

// Helper: Convert week number (1-52) into an easy-to-read Month + Week label
function formatWeekToReadableDate(week: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const clamped = Math.min(52, Math.max(1, week));
  const monthIndex = Math.min(11, Math.floor(((clamped - 1) / 52) * 12));
  const weekOfMonth = ((clamped - 1) % 4) + 1;
  const suffix = weekOfMonth === 1 ? 'Early' : weekOfMonth === 2 ? 'Mid' : 'Late';
  return `${suffix} ${months[monthIndex]}`;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({
  analysis,
  savedRecord,
  onBackToMap,
  onEnterSimulation,
}) => {
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(
    analysis.strategies[0]?.id || ''
  );

  const selectedStrategy =
    analysis.strategies.find((s) => s.id === selectedStrategyId) || analysis.strategies[0];

  const cropsMap = cropsData.crops as Record<string, { display_name: string; family: string }>;

  const formatCropNames = (ids: string[]) =>
    ids.map((id) => cropsMap[id]?.display_name || id).join(' + ');

  const { soil, climate_summary } = analysis.nasa_environment;
  const { field_profile } = analysis;

  // Plain-English interpretations of NASA & USDA metrics
  const moisturePct = Math.round(climate_summary.mean_soil_moisture * 100);
  const moistureLabel =
    moisturePct >= 60
      ? 'Naturally Moist Soil'
      : moisturePct >= 40
      ? 'Balanced Soil Moisture'
      : 'Dry-Prone Soil';
  const moistureAdvice =
    moisturePct >= 60
      ? 'Your ground holds water well—avoid over-watering and watch for soggy roots.'
      : moisturePct >= 40
      ? 'Good natural water balance. Mulch and cover crops will keep summer moisture steady.'
      : 'Your plot dries out quickly. Drip irrigation and moisture-trapping cover crops are key.';

  const soilAdvice =
    soil.organic_matter_level === 'high'
      ? `Rich organic matter (${soil.drainage_class.toLowerCase()})—great nutrient-holding capacity.`
      : soil.organic_matter_level === 'medium'
      ? `${soil.drainage_class} with moderate organic matter. Cover crops will boost fertility.`
      : `${soil.drainage_class}, but low in organic matter—compost and legumes will rebuild topsoil.`;

  const springFrostText = formatWeekToReadableDate(climate_summary.last_spring_frost_week);
  const fallFrostText = formatWeekToReadableDate(climate_summary.first_fall_frost_week);

  const slopeHeadline =
    field_profile.slope_percent >= 5
      ? 'Noticeable Hillside'
      : field_profile.slope_percent >= 2
      ? 'Gentle Slope'
      : 'Flat Ground';
  const slopeAdvice =
    field_profile.drainage_runoff_risk === 'high'
      ? 'Higher rainwater runoff risk—keep roots anchored year-round to prevent topsoil wash.'
      : field_profile.drainage_runoff_risk === 'medium'
      ? 'Moderate drainage speed—winter cover crops will help rainwater soak in evenly.'
      : 'Minimal erosion risk—rainwater stays where it falls across your plot.';

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: `Welcome! I reviewed your ${field_profile.area_acres}-acre ${field_profile.mode} using NASA satellites and local soil surveys. You have ${soil.texture_class.toLowerCase()} soil with a frost-free growing season from ${springFrostText} to ${fallFrostText}. Ask me anything in plain language about what to plant, when to seed, or how to care for your soil!`,
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleAskQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || isChatLoading) return;

    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setChatInput('');
    setIsChatLoading(true);

    const reply = await askFieldAgronomistLive(trimmed, analysis, selectedStrategy);
    setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    setIsChatLoading(false);

    if (savedRecord.persistedToCloud) {
      void logFieldChatTurn(savedRecord.analysisId, trimmed, reply);
    }
  };

  const handleLaunchSimulation = () => {
    if (!selectedStrategy) return;
    if (savedRecord.persistedToCloud) {
      void recordSelectedSimulationStrategy(savedRecord.analysisId, selectedStrategy.id);
    }
    onEnterSimulation({
      analysisId: savedRecord.analysisId,
      fieldId: savedRecord.fieldId,
      mode: field_profile.mode,
      area_acres: field_profile.area_acres,
      coordinates: analysis.nasa_environment.coordinates,
      selected_strategy: selectedStrategy,
      past_rotation: analysis.survey.past_rotation,
      soil,
      climate_summary,
      weekly_series: analysis.nasa_environment.weekly_series,
    });
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Action Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-card)',
          padding: '18px 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={onBackToMap}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-subtle)',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={15} />
            Trace Another Field
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--color-olive)',
                  backgroundColor: 'var(--color-pale-green)',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)',
                }}
              >
                {field_profile.area_acres} ACRES •{' '}
                {field_profile.mode === 'farm' ? 'COMMERCIAL FARM' : 'HOME / COMMUNITY GARDEN'}
              </span>
              {savedRecord.persistedToCloud && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--color-sim-good)',
                  }}
                >
                  <CheckCircle2 size={13} /> Saved to Your Account
                </span>
              )}
              {field_profile.vision_ai_verified && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--color-olive)',
                  }}
                >
                  <Sparkles size={13} /> Field Photos Analyzed
                </span>
              )}
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '26px',
                fontWeight: 400,
                margin: '4px 0 0 0',
              }}
            >
              Your Personalized Field Health & Crop Plan
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLaunchSimulation}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            borderRadius: 'var(--radius-pill)',
            border: 'none',
            backgroundColor: 'var(--color-olive)',
            color: 'var(--color-text-on-dark)',
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Play size={16} fill="currentColor" />
          Enter Simulation
        </button>
      </div>

      {/* Section 1: 4 Plain-English Field Condition Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Soil Card */}
        <div
          style={{
            backgroundColor: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-olive)', marginBottom: '6px' }}>
              <Sprout size={18} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>YOUR SOIL TYPE</span>
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', marginBottom: '6px' }}>
              {soil.texture_class} Soil
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text)', margin: 0, lineHeight: 1.45 }}>
              {soilAdvice}
            </p>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}>
            Mix: {soil.sand_pct}% Sand • {soil.silt_pct}% Silt • {soil.clay_pct}% Clay
          </div>
        </div>

        {/* Moisture Card */}
        <div
          style={{
            backgroundColor: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-olive)', marginBottom: '6px' }}>
              <Droplets size={18} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>WATER & MOISTURE</span>
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', marginBottom: '6px' }}>
              {moistureLabel}
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text)', margin: 0, lineHeight: 1.45 }}>
              {moistureAdvice}
            </p>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}>
            NASA SMAP Root-Zone Wetness: {moisturePct}%
          </div>
        </div>

        {/* Growing Season Card */}
        <div
          style={{
            backgroundColor: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-olive)', marginBottom: '6px' }}>
              <CloudRain size={18} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>GROWING SEASON</span>
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', marginBottom: '6px' }}>
              {climate_summary.frost_free_weeks} Frost-Free Weeks
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text)', margin: 0, lineHeight: 1.45 }}>
              Safe outdoor planting runs from <strong>{springFrostText}</strong> until <strong>{fallFrostText}</strong>.
            </p>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}>
            Avg Rain: {climate_summary.annual_rainfall_mm} mm/yr • Avg Temp: {climate_summary.mean_temp_c}°C
          </div>
        </div>

        {/* Slope & Drainage Card */}
        <div
          style={{
            backgroundColor: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-olive)', marginBottom: '6px' }}>
              <Mountain size={18} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>SLOPE & RUNOFF</span>
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', marginBottom: '6px' }}>
              {slopeHeadline} ({field_profile.slope_percent}%)
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text)', margin: 0, lineHeight: 1.45 }}>
              {slopeAdvice}
            </p>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}>
            Elevation: {field_profile.elevation_m}m • Runoff Risk: {field_profile.drainage_runoff_risk.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Section 2: What We Observed From Your Photos & Satellites */}
      <div
        style={{
          backgroundColor: 'var(--color-cream)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-card)',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Camera size={16} style={{ color: 'var(--color-olive)' }} />
              <strong style={{ fontSize: '15px', color: 'var(--color-olive)' }}>
                What We Found From Your {savedRecord.photoUrls.length} Field Photos + NASA Satellites
              </strong>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--color-text)', margin: 0, lineHeight: 1.55 }}>
              {field_profile.ground_truth_diagnosis}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {savedRecord.photoUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Field angle ${i + 1}`}
                style={{
                  width: '68px',
                  height: '56px',
                  objectFit: 'cover',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border)',
                }}
              />
            ))}

            <div
              style={{
                position: 'relative',
                width: '96px',
                height: '56px',
                borderRadius: '10px',
                overflow: 'hidden',
                border: '1px solid var(--color-olive)',
                backgroundColor: '#1f291e',
              }}
              title="NASA MODIS Satellite Vegetation Health View"
            >
              <img
                src={analysis.nasa_environment.satellite_layers.modis_ndvi_snapshot_url}
                alt="NASA Satellite Vegetation View"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <span
                style={{
                  position: 'absolute',
                  bottom: '2px',
                  left: '4px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  color: '#fff',
                  backgroundColor: 'rgba(0,0,0,0.65)',
                  padding: '1px 4px',
                  borderRadius: '4px',
                }}
              >
                NASA VIEW
              </span>
            </div>
          </div>
        </div>

        {/* Simple Tips to Double-Check in Person */}
        <div
          style={{
            borderTop: '1px solid var(--color-border)',
            paddingTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--color-olive)',
              fontWeight: 600,
            }}
          >
            <AlertTriangle size={13} /> QUICK THINGS TO DOUBLE-CHECK IN PERSON:
          </span>
          {analysis.check_locally.map((tip, idx) => (
            <p key={idx} style={{ fontSize: '13px', color: 'var(--color-text)', margin: 0 }}>
              • {tip}
            </p>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
            <Satellite size={13} style={{ color: 'var(--color-olive)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Powered by NASA POWER, SMAP, SRTM, MODIS & {soil.source_label}
            </span>
          </div>
        </div>
      </div>

      {/* Section 3: 3 Ranked Crop Rotation Strategies */}
      <div>
        <div style={{ marginBottom: '14px' }}>
          <h3
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '26px',
              fontWeight: 400,
              margin: '0 0 4px 0',
            }}
          >
            Your Top 3 Crop Rotation Plans (2-Year Schedule)
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', margin: 0 }}>
            Click any plan below to select it, then press <strong>Enter Simulation</strong> to watch how your soil and harvest perform season by season.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '18px',
          }}
        >
          {analysis.strategies.map((strategy, index) => {
            const isSelected = strategy.id === selectedStrategy?.id;
            return (
              <div
                key={strategy.id}
                onClick={() => setSelectedStrategyId(strategy.id)}
                style={{
                  backgroundColor: 'var(--color-bg)',
                  border: isSelected
                    ? '2px solid var(--color-olive)'
                    : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-card)',
                  padding: '22px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '10px',
                    }}
                  >
                    <span
                      style={{
                        backgroundColor: index === 0 ? 'var(--color-pale-green)' : 'var(--color-cream)',
                        color: 'var(--color-olive)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-pill)',
                      }}
                    >
                      {index === 0 ? '★ BEST MATCH' : `OPTION #${index + 1}`} • {strategy.badge}
                    </span>

                    {isSelected && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          color: 'var(--color-olive)',
                          fontWeight: 600,
                        }}
                      >
                        ✓ SELECTED
                      </span>
                    )}
                  </div>

                  <h4
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '22px',
                      fontWeight: 400,
                      margin: '0 0 8px 0',
                    }}
                  >
                    {strategy.name}
                  </h4>

                  <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '0 0 14px 0', lineHeight: 1.5 }}>
                    {strategy.summary}
                  </p>

                  {/* Plain-English Benefit Highlights */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      backgroundColor: 'var(--color-bg-subtle)',
                      padding: '12px',
                      borderRadius: '14px',
                      marginBottom: '14px',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Droplets size={14} style={{ color: 'var(--color-olive)' }} />
                      <span>Saves ~{strategy.expected_benefits.water_savings_pct}% water</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sprout size={14} style={{ color: 'var(--color-olive)' }} />
                      <span>+{strategy.expected_benefits.soil_organic_gain_pct}% richer soil</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldCheck size={14} style={{ color: 'var(--color-olive)' }} />
                      <span>-{strategy.expected_benefits.pest_risk_reduction_pct}% pest pressure</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <TrendingUp size={14} style={{ color: 'var(--color-olive)' }} />
                      <span>{strategy.expected_benefits.estimated_yield_index}% harvest score</span>
                    </div>
                  </div>

                  {/* Season-by-Season Planting Timeline */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {strategy.schedule.map((slot, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '13px',
                          padding: '7px 12px',
                          borderRadius: '8px',
                          backgroundColor: idx % 2 === 0 ? 'var(--color-cream)' : 'var(--color-bg-subtle)',
                        }}
                      >
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          Year {slot.year} ({slot.season === 'warm_season' ? 'Spring / Summer' : 'Fall / Winter'})
                        </span>
                        <strong style={{ color: 'var(--color-text)' }}>
                          {formatCropNames(slot.crops)}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>

                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-text-muted)',
                    borderTop: '1px solid var(--color-border)',
                    paddingTop: '10px',
                    margin: 0,
                    lineHeight: 1.45,
                  }}
                >
                  <strong>Why this works for you:</strong> {strategy.agronomist_rationale}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 4: Friendly AI Field Agronomist Chat-Box */}
      <div
        style={{
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-card)',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <MessageSquare size={18} style={{ color: 'var(--color-olive)' }} />
          <h3
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '22px',
              fontWeight: 400,
              margin: 0,
            }}
          >
            Have Questions? Ask Your Field Agronomist
          </h3>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '0 0 12px 0' }}>
          Get plain-language answers tailored to your exact soil, local weather, and uploaded field photos.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          {[
            'When should I plant my first seeds this spring?',
            'How often will I need to water with this plan?',
            'What did you notice in my field photos?',
          ].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handleAskQuestion(preset)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-subtle)',
                fontSize: '12px',
                color: 'var(--color-text)',
                cursor: 'pointer',
              }}
            >
              {preset}
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxHeight: '220px',
            overflowY: 'auto',
            padding: '12px',
            backgroundColor: 'var(--color-bg-subtle)',
            borderRadius: '14px',
            marginBottom: '12px',
          }}
        >
          {messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '82%',
                backgroundColor: m.role === 'user' ? 'var(--color-olive)' : 'var(--color-bg)',
                color: m.role === 'user' ? 'var(--color-text-on-dark)' : 'var(--color-text)',
                border: m.role === 'user' ? 'none' : '1px solid var(--color-border)',
                padding: '10px 14px',
                borderRadius: '14px',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              {m.text}
            </div>
          ))}
          {isChatLoading && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-olive)' }}>
              Checking your field data...
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAskQuestion(chatInput);
          }}
          style={{ display: 'flex', gap: '10px' }}
        >
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask anything—e.g., 'Can I plant tomatoes earlier?' or 'How do cover crops help?'"
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg)',
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
            }}
          />
          <button
            type="submit"
            disabled={isChatLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 20px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              backgroundColor: 'var(--color-olive)',
              color: 'var(--color-text-on-dark)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Send size={14} />
            Ask
          </button>
        </form>
      </div>
    </div>
  );
};