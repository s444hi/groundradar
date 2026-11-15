import React, { useState } from 'react';
import './styles/theme.css';
import { FieldTracerMap, type TracedFieldData } from './components/FieldTracerMap';
import { FieldSurveyModal, type SurveyModalOutput } from './components/FieldSurveyModal';
import {
  ResultsPage,
  type SimulationHandoffPayload,
} from './components/ResultsPage';
import { fetchNasaFieldEnvironment } from './services/nasaClimateService';
import {
  generateRotationAnalysis,
  type GroundRadarAnalysisResult,
} from './services/rotationGeneratorService';
import {
  saveFieldAnalysisToSupabase,
  type SavedAnalysisRecord,
} from './services/supabaseService';

export function App() {
  const [tracedField, setTracedField] = useState<TracedFieldData | null>(null);
  const [isSurveyOpen, setIsSurveyOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [analysisResult, setAnalysisResult] = useState<GroundRadarAnalysisResult | null>(null);
  const [savedRecord, setSavedRecord] = useState<SavedAnalysisRecord | null>(null);
  const [simulationPayload, setSimulationPayload] = useState<SimulationHandoffPayload | null>(null);

  const handleFieldConfirm = (fieldData: TracedFieldData) => {
    setTracedField(fieldData);
    setIsSurveyOpen(true);
  };

  const handleSurveySubmit = async (surveyData: SurveyModalOutput) => {
    if (!tracedField) return;
    setIsSurveyOpen(false);
    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      setStatusMessage('Checking NASA satellite weather, soil moisture, and local soil maps...');
      const nasaEnv = await fetchNasaFieldEnvironment(
        tracedField.latitude,
        tracedField.longitude,
        tracedField.geoJson
      );

      setStatusMessage('Reviewing your field photos and building 3 custom crop rotation plans...');
      const analysis = await generateRotationAnalysis(tracedField, surveyData, nasaEnv);

      setStatusMessage('Saving your field plan to your account...');
      const saved = await saveFieldAnalysisToSupabase(tracedField, analysis);

      setAnalysisResult(analysis);
      setSavedRecord(saved);
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Something went wrong while analyzing your field.'
      );
    } finally {
      setIsAnalyzing(false);
      setStatusMessage('');
    }
  };

  const handleResetToMap = () => {
    setAnalysisResult(null);
    setSavedRecord(null);
    setSimulationPayload(null);
    setTracedField(null);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-subtle)',
        padding: '32px 24px',
        fontFamily: 'var(--font-sans)',
        color: 'var(--color-text)',
      }}
    >
      {/* Top Brand Header */}
      <header
        style={{
          maxWidth: '1200px',
          margin: '0 auto 24px auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '36px',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              color: 'var(--color-olive)',
              margin: 0,
            }}
          >
            Ground Radar
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
            NASA Satellite Insights & Personalized Crop Rotation Planning
          </p>
        </div>

        <span
          style={{
            backgroundColor: 'var(--color-pale-green)',
            color: 'var(--color-olive)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            padding: '6px 14px',
            borderRadius: 'var(--radius-pill)',
          }}
        >
          {simulationPayload
            ? 'Step 3 of 3 • Interactive Simulation'
            : analysisResult
            ? 'Step 2 of 3 • Your Field Report'
            : 'Step 1 of 3 • Trace Your Field'}
        </span>
      </header>

      {/* View 3: Simulation Handoff Screen (Ready to mount teammate's simulation component) */}
      {simulationPayload ? (
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            backgroundColor: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div>
              <span
                style={{
                  backgroundColor: 'var(--color-pale-green)',
                  color: 'var(--color-olive)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-pill)',
                }}
              >
                SIMULATION LOADED • {simulationPayload.selected_strategy.name.toUpperCase()}
              </span>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 400, margin: '8px 0 0 0' }}>
                2-Year Field Simulation Ready
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setSimulationPayload(null)}
              style={{
                padding: '9px 18px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-subtle)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              ← Back to Crop Plans
            </button>
          </div>

          <p style={{ fontSize: '14px', color: 'var(--color-text)', margin: 0, lineHeight: 1.55 }}>
            Your <strong>{simulationPayload.area_acres}-acre</strong> {simulationPayload.soil.texture_class.toLowerCase()} plot and 52 weeks of NASA weather data are loaded into the{' '}
            <strong>{simulationPayload.selected_strategy.name}</strong> schedule. Your teammate&apos;s simulation engine mounts directly in this panel.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px',
              backgroundColor: 'var(--color-cream)',
              padding: '16px',
              borderRadius: '16px',
            }}
          >
            <div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                SELECTED PLAN
              </span>
              <div style={{ fontWeight: 500, fontSize: '14px', marginTop: '4px' }}>
                {simulationPayload.selected_strategy.name}
              </div>
            </div>
            <div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                SOIL & DRAINAGE
              </span>
              <div style={{ fontWeight: 500, fontSize: '14px', marginTop: '4px' }}>
                {simulationPayload.soil.texture_class} ({simulationPayload.soil.drainage_class})
              </div>
            </div>
            <div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                PROJECTED WATER SAVINGS
              </span>
              <div style={{ fontWeight: 500, fontSize: '14px', marginTop: '4px', color: 'var(--color-olive)' }}>
                ~{simulationPayload.selected_strategy.expected_benefits.water_savings_pct}% less irrigation needed
              </div>
            </div>
            <div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                SOIL HEALTH BOOST
              </span>
              <div style={{ fontWeight: 500, fontSize: '14px', marginTop: '4px', color: 'var(--color-olive)' }}>
                +{simulationPayload.selected_strategy.expected_benefits.soil_organic_gain_pct}% richer topsoil
              </div>
            </div>
          </div>
        </div>
      ) : analysisResult && savedRecord ? (
        /* View 2: Full User-Friendly Results Page + Agronomist Chat + Enter Simulation */
        <ResultsPage
          analysis={analysisResult}
          savedRecord={savedRecord}
          onBackToMap={handleResetToMap}
          onEnterSimulation={(payload) => setSimulationPayload(payload)}
        />
      ) : (
        /* View 1: Map Tracer + Survey Modal */
        <>
          <FieldTracerMap onFieldConfirm={handleFieldConfirm} />

          {isSurveyOpen && tracedField && (
            <FieldSurveyModal
              areaAcres={tracedField.area_acres}
              latitude={tracedField.latitude}
              longitude={tracedField.longitude}
              onClose={() => setIsSurveyOpen(false)}
              onSubmitSurvey={handleSurveySubmit}
            />
          )}

          {isAnalyzing && (
            <div
              style={{
                maxWidth: '1200px',
                margin: '24px auto 0 auto',
                backgroundColor: 'var(--color-cream)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-card)',
                padding: '20px 24px',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                color: 'var(--color-olive)',
              }}
            >
              ⏳ {statusMessage}
            </div>
          )}

          {errorMessage && (
            <div
              style={{
                maxWidth: '1200px',
                margin: '24px auto 0 auto',
                backgroundColor: '#fdf2f2',
                border: '1px solid var(--color-sim-risk)',
                borderRadius: 'var(--radius-card)',
                padding: '20px 24px',
                color: 'var(--color-sim-risk)',
                fontSize: '14px',
              }}
            >
              <strong>Heads up:</strong> {errorMessage}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;