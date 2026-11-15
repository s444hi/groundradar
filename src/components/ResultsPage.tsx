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
} from 'lucide-react';
import cropsData from '../simulation/data/crops.json';
import type {
  GroundRadarAnalysisResult,
  RotationStrategy,
} from '../services/rotationGeneratorService';
import type { SavedAnalysisRecord } from '../services/supabaseService';

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

  // Context-aware Agronomist Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: `I analyzed your ${analysis.field_profile.area_acres}-acre ${analysis.field_profile.mode} at ${analysis.field_profile.latitude}°, ${analysis.field_profile.longitude}° using NASA POWER, SoilGrids (${analysis.field_profile.soil_texture}), and SRTM elevation (${analysis.field_profile.slope_percent}% slope). Ask me anything about planting dates, cover crops, irrigation, or why "${selectedStrategy?.name}" ranked #1 for your priorities.`,
    },
  ]);
  const [chatInput, setChatInput] = useState('');

  const generateAgronomistReply = (question: string): string => {
    const q = question.toLowerCase();
    const { climate_summary, soil } = analysis.nasa_environment;
    const { field_profile } = analysis;

    if (q.includes('frost') || q.includes('when') || q.includes('plant') || q.includes('date')) {
      return `Based on NASA POWER climatology for ${field_profile.latitude}°, ${field_profile.longitude}°, your last spring frost occurs around Week ${climate_summary.last_spring_frost_week} and your first fall frost arrives around Week ${climate_summary.first_fall_frost_week} (${climate_summary.frost_free_weeks} frost-free weeks). Plant warm-season crops 1–2 weeks after Week ${climate_summary.last_spring_frost_week}, and seed cool-season cover crops 6–8 weeks before Week ${climate_summary.first_fall_frost_week}.`;
    }

    if (q.includes('water') || q.includes('irrigat') || q.includes('moisture') || q.includes('drought')) {
      const pct = Math.round(climate_summary.mean_soil_moisture * 100);
      return `NASA POWER root-zone wetness averages ${pct}% with ${climate_summary.annual_rainfall_mm} mm of annual precipitation across ${soil.texture_class} soil (${soil.sand_pct}% sand / ${soil.clay_pct}% clay). "${selectedStrategy.name}" saves ~${selectedStrategy.expected_benefits.water_savings_pct}% water by keeping living mulch/cover roots active between cash harvests.`;
    }

    if (q.includes('soil') || q.includes('nitrogen') || q.includes('fertilizer') || q.includes('carbon')) {
      return `ISRIC SoilGrids reports ${soil.texture_class} with ${soil.organic_carbon_g_kg} g/kg Soil Organic Carbon (${soil.organic_matter_level} organic matter). Incorporating nitrogen-fixing legumes and overwintering cover in "${selectedStrategy.name}" is projected to boost soil organic matter by +${selectedStrategy.expected_benefits.soil_organic_gain_pct}% over a 2-year cycle.`;
    }

    if (q.includes('pest') || q.includes('disease') || q.includes('family')) {
      return `"${selectedStrategy.name}" reduces soil-borne pest and pathogen pressure by ~${selectedStrategy.expected_benefits.pest_risk_reduction_pct}% by separating botanical families across warm and cool seasons so host-specific nematodes and fungal spores cannot overwinter on continuous roots.`;
    }

    return `For your ${field_profile.soil_texture} plot (${field_profile.slope_percent}% slope, ${field_profile.drainage_runoff_risk} runoff risk), "${selectedStrategy.name}" balances your priority weights with a ${selectedStrategy.expected_benefits.estimated_yield_index}/100 yield index. Click "Enter Simulation" to test week-by-week moisture, nitrogen, and frost stress across Year 1 and Year 2!`;
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    const reply = generateAgronomistReply(trimmed);
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: trimmed },
      { role: 'assistant', text: reply },
    ]);
    setChatInput('');
  };

  const handleLaunchSimulation = () => {
    if (!selectedStrategy) return;
    onEnterSimulation({
      analysisId: savedRecord.analysisId,
      fieldId: savedRecord.fieldId,
      mode: analysis.field_profile.mode,
      area_acres: analysis.field_profile.area_acres,
      coordinates: analysis.nasa_environment.coordinates,
      selected_strategy: selectedStrategy,
      past_rotation: analysis.survey.past_rotation,
      soil: analysis.nasa_environment.soil,
      climate_summary: analysis.nasa_environment.climate_summary,
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
            New Field
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                {analysis.field_profile.area_acres} ACRES •{' '}
                {analysis.field_profile.mode.toUpperCase()}
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
                  <CheckCircle2 size={13} /> Saved to Supabase
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
              NASA Satellite & Soil Agronomic Report
            </h2>
          </div>
        </div>

        {/* Primary CTA: Enter Simulation */}
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

      {/* Section 1: 4 Live NASA & SoilGrids Telemetry Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
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
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-olive)', marginBottom: '8px' }}>
            <Sprout size={18} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>ISRIC SOILGRIDS 250M</span>
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', marginBottom: '4px' }}>
            {analysis.nasa_environment.soil.texture_class}
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>
            {analysis.nasa_environment.soil.sand_pct}% Sand • {analysis.nasa_environment.soil.silt_pct}% Silt •{' '}
            {analysis.nasa_environment.soil.clay_pct}% Clay ({analysis.nasa_environment.soil.organic_carbon_g_kg} g/kg SOC)
          </p>
        </div>

        {/* Soil Moisture Card */}
        <div
          style={{
            backgroundColor: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-olive)', marginBottom: '8px' }}>
            <Droplets size={18} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>NASA ROOT-ZONE MOISTURE</span>
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', marginBottom: '4px' }}>
            {Math.round(analysis.nasa_environment.climate_summary.mean_soil_moisture * 100)}% Wetness
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>
            Mean annual root-zone fractional water content (GWETROOT)
          </p>
        </div>

        {/* Climate & Frost Card */}
        <div
          style={{
            backgroundColor: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-olive)', marginBottom: '8px' }}>
            <CloudRain size={18} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>NASA POWER CLIMATE</span>
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', marginBottom: '4px' }}>
            {analysis.nasa_environment.climate_summary.annual_rainfall_mm} mm/yr
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>
            {analysis.nasa_environment.climate_summary.frost_free_weeks} frost-free weeks (Wk{' '}
            {analysis.nasa_environment.climate_summary.last_spring_frost_week}–Wk{' '}
            {analysis.nasa_environment.climate_summary.first_fall_frost_week})
          </p>
        </div>

        {/* Terrain & Runoff Card */}
        <div
          style={{
            backgroundColor: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-olive)', marginBottom: '8px' }}>
            <Mountain size={18} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>NASA SRTM 30M TERRAIN</span>
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', marginBottom: '4px' }}>
            {analysis.field_profile.slope_percent}% Slope
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>
            {analysis.field_profile.elevation_m}m elevation •{' '}
            <strong style={{ textTransform: 'capitalize' }}>
              {analysis.field_profile.drainage_runoff_risk}
            </strong>{' '}
            runoff risk
          </p>
        </div>
      </div>

      {/* Section 2: Ground-Truth Photos & Local Verification Banner */}
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
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Camera size={16} style={{ color: 'var(--color-olive)' }} />
              <strong style={{ fontSize: '14px', color: 'var(--color-olive)' }}>
                Ground-Truth Synthesis ({savedRecord.photoUrls.length} Field Photos)
              </strong>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text)', margin: 0, lineHeight: 1.5 }}>
              {analysis.field_profile.ground_truth_diagnosis}
            </p>
          </div>

          {savedRecord.photoUrls.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {savedRecord.photoUrls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Field angle ${i + 1}`}
                  style={{
                    width: '64px',
                    height: '52px',
                    objectFit: 'cover',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Check Locally Callouts */}
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
            <AlertTriangle size={13} /> CHECK LOCALLY ON YOUR PLOT:
          </span>
          {analysis.check_locally.map((tip, idx) => (
            <p key={idx} style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>
              • {tip}
            </p>
          ))}
        </div>
      </div>

      {/* Section 3: 3 Ranked Crop Rotation Strategies */}
      <div>
        <h3
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '26px',
            fontWeight: 400,
            margin: '0 0 14px 0',
          }}
        >
          Recommended 2-Year Crop Rotation Strategies
        </h3>

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
                      #{index + 1} • {strategy.badge}
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

                  <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '0 0 14px 0', lineHeight: 1.45 }}>
                    {strategy.summary}
                  </p>

                  {/* Metrics Pills */}
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
                      <span>-{strategy.expected_benefits.water_savings_pct}% Water</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sprout size={14} style={{ color: 'var(--color-olive)' }} />
                      <span>+{strategy.expected_benefits.soil_organic_gain_pct}% Soil Carbon</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldCheck size={14} style={{ color: 'var(--color-olive)' }} />
                      <span>-{strategy.expected_benefits.pest_risk_reduction_pct}% Pest Risk</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <TrendingUp size={14} style={{ color: 'var(--color-olive)' }} />
                      <span>{strategy.expected_benefits.estimated_yield_index}/100 Yield</span>
                    </div>
                  </div>

                  {/* 4-Season Schedule */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {strategy.schedule.map((slot, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '12px',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          backgroundColor: idx % 2 === 0 ? 'var(--color-cream)' : 'var(--color-bg-subtle)',
                        }}
                      >
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                          Yr {slot.year} • {slot.season === 'warm_season' ? 'Warm' : 'Cool'}
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
                  {strategy.agronomist_rationale}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 4: Context-Aware AI Agronomist Chat-Box */}
      <div
        style={{
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-card)',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <MessageSquare size={18} style={{ color: 'var(--color-olive)' }} />
          <h3
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '22px',
              fontWeight: 400,
              margin: 0,
            }}
          >
            Ask Your Field Agronomist
          </h3>
        </div>

        {/* Quick Question Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          {[
            'When is my safe planting window after frost?',
            'How does this rotation save water on my soil?',
            'How does it improve nitrogen & soil organic matter?',
          ].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                const reply = generateAgronomistReply(preset);
                setMessages((prev) => [
                  ...prev,
                  { role: 'user', text: preset },
                  { role: 'assistant', text: reply },
                ]);
              }}
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

        {/* Chat History */}
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
                lineHeight: 1.45,
              }}
            >
              {m.text}
            </div>
          ))}
        </div>

        {/* Input Box */}
        <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask about frost dates, soil pH/texture, cover crops, or irrigation..."
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
