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
      setStatusMessage('Fetching NASA POWER climatology, SoilGrids, and SRTM elevation...');
      const nasaEnv = await fetchNasaFieldEnvironment(
        tracedField.latitude,
        tracedField.longitude,
        tracedField.geoJson
      );

      setStatusMessage('Synthesizing ground-truth photos and generating 3 rotation strategies...');
      const analysis = await generateRotationAnalysis(tracedField, surveyData, nasaEnv);

      setStatusMessage('Saving field polygon, photos, and NASA analysis to Supabase...');
      const saved = await saveFieldAnalysisToSupabase(tracedField, analysis);

      setAnalysisResult(analysis);
      setSavedRecord(saved);
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Unexpected error connecting to NASA or Supabase.'
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
            NASA Earth Observation & Local Soil Decision Support
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
            ? '3. Simulation Engine'
            : analysisResult
            ? '2. NASA Agronomic Report'
            : '1. Field Boundary & Survey'}
        </span>
      </header>

      {/* View 3: Simulation Handoff Screen (ready to mount teammate's simulation component) */}
      {simulationPayload ? (
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            backgroundColor: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            padding: '28px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
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
                SIMULATION READY • {simulationPayload.selected_strategy.name.toUpperCase()}
              </span>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 400, margin: '8px 0 0 0' }}>
                Teammate Simulation Handoff Payload
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
                cursor: 'pointer',
              }}
            >
              Back to Results
            </button>
          </div>

          <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
            This payload passes the selected 2-year crop rotation, 52-week NASA POWER climate series, and ISRIC soil
            properties directly into your teammate&apos;s simulation engine:
          </p>

          <pre
            style={{
              backgroundColor: 'var(--color-bg-subtle)',
              padding: '16px',
              borderRadius: '12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              overflowX: 'auto',
              maxHeight: '320px',
            }}
          >
            {JSON.stringify(
              {
                ...simulationPayload,
                weekly_series: `[52 weeks of NASA POWER T2M_MIN, T2M_MAX, PRECTOTCORR, GWETROOT]`,
              },
              null,
              2
            )}
          </pre>
        </div>
      ) : analysisResult && savedRecord ? (
        /* View 2: Full NASA Results Page + Agronomist Chat + Enter Simulation */
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
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
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
              <strong>Connection Error:</strong> {errorMessage}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;