import React, { useState } from 'react';
import SimulationPage from './simulation/components/SimulationPage/SimulationPage';
import './styles/theme.css';
import { AuthGate } from './components/AuthGate';
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

  const handleSurveySubmit = async (surveyData: SurveyModalOutput, userId?: string | null) => {
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
      const saved = await saveFieldAnalysisToSupabase(tracedField, analysis, userId);

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
    <AuthGate>
      {({ session }) => (
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

              <SimulationPage embedded />
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
                  onSubmitSurvey={(surveyData) =>
                    handleSurveySubmit(surveyData, session?.user?.id ?? null)
                  }
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
      )}
    </AuthGate>
  );
}

export default App;