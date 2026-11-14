import React, { useState } from 'react';
import './styles/theme.css';
import { FieldTracerMap, type TracedFieldData } from './components/FieldTracerMap';
import { FieldSurveyModal, type SurveyModalOutput } from './components/FieldSurveyModal';

export function App() {
  const [tracedField, setTracedField] = useState<TracedFieldData | null>(null);
  const [isSurveyOpen, setIsSurveyOpen] = useState(false);
  const [completedPayload, setCompletedPayload] = useState<{
    field: TracedFieldData;
    survey: SurveyModalOutput;
  } | null>(null);

  const handleFieldConfirm = (fieldData: TracedFieldData) => {
    setTracedField(fieldData);
    setIsSurveyOpen(true);
  };

  const handleSurveySubmit = (surveyData: SurveyModalOutput) => {
    if (!tracedField) return;
    setCompletedPayload({ field: tracedField, survey: surveyData });
    setIsSurveyOpen(false);
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
          Dashboard Preview
        </span>
      </header>

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

      {completedPayload && (
        <div
          style={{
            maxWidth: '1200px',
            margin: '24px auto 0 auto',
            backgroundColor: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            padding: '24px',
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '22px',
              fontWeight: 400,
              color: 'var(--color-olive)',
              marginTop: 0,
            }}
          >
            Ready for Step 3 (NASA API + AI Analysis Payload):
          </h3>
          <pre
            style={{
              backgroundColor: 'var(--color-bg-subtle)',
              padding: '16px',
              borderRadius: '12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              overflowX: 'auto',
              maxHeight: '260px',
            }}
          >
            {JSON.stringify(
              {
                ...completedPayload,
                survey: {
                  ...completedPayload.survey,
                  photosBase64:
                    completedPayload.survey.photosBase64.length > 0
                      ? `${completedPayload.survey.photosBase64.length} image(s) attached`
                      : [],
                },
              },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}

export default App;