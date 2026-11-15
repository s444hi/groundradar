import React, { useEffect, useState } from 'react';
import {
  Sprout,
  Satellite,
  Camera,
  TrendingUp,
  ArrowRight,
  LogOut,
  UserCheck,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseService';

interface AuthGateProps {
  children: (authContext: {
    session: Session | null;
    isGuest: boolean;
    signOut: () => Promise<void>;
  }) => React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);

  // Auth modal state
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setIsLoadingSession(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setIsLoadingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        setIsGuest(false);
        setAuthModalMode(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);

    if (!supabase) {
      setAuthError('Supabase is not configured in .env yet. Click "Explore as Guest" to continue.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (authModalMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setAuthNotice('Account created! Check your inbox to confirm your email, or sign in now.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    if (supabase && session) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setIsGuest(false);
  };

  if (isLoadingSession) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-bg-subtle)',
          fontFamily: 'var(--font-sans)',
          color: 'var(--color-olive)',
        }}
      >
        Loading Ground Radar...
      </div>
    );
  }

  // If authenticated OR guest mode selected, render the main application
  if (session || isGuest) {
    return (
      <>
        {/* Top Session Status Bar */}
        <div
          style={{
            backgroundColor: 'var(--color-bg)',
            borderBottom: '1px solid var(--color-border)',
            padding: '10px 24px',
          }}
        >
          <div
            style={{
              maxWidth: '1200px',
              margin: '0 auto',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-olive)' }}>
              <UserCheck size={14} />
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {session
                  ? `Signed in as ${session.user.user_metadata?.full_name || session.user.email}`
                  : 'Guest Session • Analyses saved to cloud'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isGuest && (
                <button
                  type="button"
                  onClick={() => setAuthModalMode('signup')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid var(--color-olive)',
                    backgroundColor: 'var(--color-pale-green)',
                    color: 'var(--color-olive)',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Create Account to Save Fields
                </button>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  color: 'var(--color-text)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                <LogOut size={12} />
                {session ? 'Sign Out' : 'Back to Home'}
              </button>
            </div>
          </div>
        </div>

        {children({ session, isGuest, signOut: handleSignOut })}

        {/* Optional Sign Up Modal if Guest clicks "Create Account" */}
        {authModalMode && (
          <AuthModal
            mode={authModalMode}
            email={email}
            password={password}
            fullName={fullName}
            error={authError}
            notice={authNotice}
            isSubmitting={isSubmitting}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onFullNameChange={setFullName}
            onSwitchMode={(m) => {
              setAuthModalMode(m);
              setAuthError(null);
              setAuthNotice(null);
            }}
            onClose={() => setAuthModalMode(null)}
            onSubmit={handleAuthSubmit}
          />
        )}
      </>
    );
  }

  // Landing Page View
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-subtle)',
        color: 'var(--color-text)',
        fontFamily: 'var(--font-sans)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Navigation Bar */}
      <nav
        style={{
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
          padding: '24px 24px 12px 24px',
          boxSizing: 'border-box',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'var(--color-olive)',
              color: 'var(--color-text-on-dark)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sprout size={18} />
          </div>
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '26px',
              color: 'var(--color-olive)',
              letterSpacing: '-0.02em',
            }}
          >
            Ground Radar
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              setAuthError(null);
              setAuthNotice(null);
              setAuthModalMode('signin');
            }}
            style={{
              padding: '9px 18px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthError(null);
              setAuthNotice(null);
              setAuthModalMode('signup');
            }}
            style={{
              padding: '9px 20px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              backgroundColor: 'var(--color-olive)',
              color: 'var(--color-text-on-dark)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main
        style={{
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
          padding: '44px 24px 64px 24px',
          boxSizing: 'border-box',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '48px',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            padding: '48px 44px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '36px',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <span
              style={{
                alignSelf: 'flex-start',
                backgroundColor: 'var(--color-pale-green)',
                color: 'var(--color-olive)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              NASA EARTH OBSERVATION + LOCAL SOIL INTELLIGENCE
            </span>

            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '46px',
                fontWeight: 400,
                lineHeight: 1.12,
                letterSpacing: '-0.02em',
                color: 'var(--color-text)',
                margin: 0,
              }}
            >
              Smarter Crop Rotations From Space to Soil.
            </h1>

            <p
              style={{
                fontSize: '16px',
                color: 'var(--color-text-muted)',
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Trace any farm field or backyard garden on satellite imagery, snap 3–6 ground-truth soil photos, and get
              plain-English crop rotation plans backed by NASA POWER, SMAP moisture, SRTM terrain, and USDA soil surveys.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setAuthModalMode('signup')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '13px 26px',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  backgroundColor: 'var(--color-olive)',
                  color: 'var(--color-text-on-dark)',
                  fontSize: '15px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Create Free Farmer Account
                <ArrowRight size={17} />
              </button>

              <button
                type="button"
                onClick={() => setIsGuest(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '13px 24px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-cream)',
                  color: 'var(--color-text)',
                  fontSize: '15px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Try Live Demo as Guest
              </button>
            </div>
          </div>

          {/* Right Preview Card */}
          <div
            style={{
              backgroundColor: 'var(--color-cream)',
              border: '1px solid var(--color-border)',
              borderRadius: '20px',
              padding: '26px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-olive)' }}>
              HOW GROUND RADAR WORKS
            </div>

            {[
              {
                step: '01',
                title: 'Trace Your Plot Boundary',
                desc: 'Draw your exact acreage on high-resolution satellite maps to measure area and coordinates.',
              },
              {
                step: '02',
                title: 'Snap 3–6 Ground-Truth Photos',
                desc: 'Pair your soil photos with live NASA SMAP moisture, frost windows, and USDA soil maps.',
              },
              {
                step: '03',
                title: 'Simulate Your 2-Year Rotation',
                desc: 'Compare 3 tailored crop plans and test water savings, soil health, and harvest resilience.',
              },
            ].map((item) => (
              <div
                key={item.step}
                style={{
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    backgroundColor: 'var(--color-pale-green)',
                    color: 'var(--color-olive)',
                    padding: '4px 9px',
                    borderRadius: 'var(--radius-pill)',
                  }}
                >
                  {item.step}
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{item.title}</div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3 Value Pillars */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '18px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-card)',
              padding: '22px',
            }}
          >
            <Satellite size={20} style={{ color: 'var(--color-olive)', marginBottom: '10px' }} />
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '21px', fontWeight: 400, margin: '0 0 6px 0' }}>
              NASA & USDA Telemetry
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
              Pulls real rainfall, evapotranspiration, frost dates, SMAP root-zone wetness, SRTM slope, and SSURGO soil drainage.
            </p>
          </div>

          <div
            style={{
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-card)',
              padding: '22px',
            }}
          >
            <Camera size={20} style={{ color: 'var(--color-olive)', marginBottom: '10px' }} />
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '21px', fontWeight: 400, margin: '0 0 6px 0' }}>
              Visual Field Downscaling
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
              Multimodal AI inspects your 3–6 field photos to spot surface crusting, puddles, and crop residue satellites miss.
            </p>
          </div>

          <div
            style={{
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-card)',
              padding: '22px',
            }}
          >
            <TrendingUp size={20} style={{ color: 'var(--color-olive)', marginBottom: '10px' }} />
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '21px', fontWeight: 400, margin: '0 0 6px 0' }}>
              Specialized Chat-Bot
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
              Helps answer your agricultural questions in context to your environment and plants/vegetables.
            </p>
          </div>
        </div>
      </main>

      {/* Sign In / Sign Up Modal */}
      {authModalMode && (
        <AuthModal
          mode={authModalMode}
          email={email}
          password={password}
          fullName={fullName}
          error={authError}
          notice={authNotice}
          isSubmitting={isSubmitting}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onFullNameChange={setFullName}
          onSwitchMode={(m) => {
            setAuthModalMode(m);
            setAuthError(null);
            setAuthNotice(null);
          }}
          onClose={() => setAuthModalMode(null)}
          onSubmit={handleAuthSubmit}
        />
      )}
    </div>
  );
};

interface AuthModalProps {
  mode: 'signin' | 'signup';
  email: string;
  password: string;
  fullName: string;
  error: string | null;
  notice: string | null;
  isSubmitting: boolean;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onFullNameChange: (v: string) => void;
  onSwitchMode: (m: 'signin' | 'signup') => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({
  mode,
  email,
  password,
  fullName,
  error,
  notice,
  isSubmitting,
  onEmailChange,
  onPasswordChange,
  onFullNameChange,
  onSwitchMode,
  onClose,
  onSubmit,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(17, 17, 17, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        zIndex: 1100,
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-card)',
          maxWidth: '440px',
          width: '100%',
          padding: '28px 32px',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close authentication modal"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '34px',
            height: '34px',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={16} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-olive)', marginBottom: '8px' }}>
          <ShieldCheck size={18} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>GROUND RADAR ACCOUNT</span>
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '28px',
            fontWeight: 400,
            margin: '0 0 6px 0',
          }}
        >
          {mode === 'signup' ? 'Create Your Grower Account' : 'Welcome Back'}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '0 0 20px 0' }}>
          {mode === 'signup'
            ? 'Save your traced fields, uploaded soil photos, and 2-year crop rotation plans.'
            : 'Sign in to access your saved fields and NASA agronomic reports.'}
        </p>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {mode === 'signup' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
                Your Name or Farm Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => onFullNameChange(e.target.value)}
                placeholder="e.g., Elena Alvarez • Sunnyside Plot"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg)',
                  fontSize: '14px',
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg)',
                fontSize: '14px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="At least 6 characters"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg)',
                fontSize: '14px',
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                backgroundColor: '#fdf2f2',
                border: '1px solid var(--color-sim-risk)',
                color: 'var(--color-sim-risk)',
                fontSize: '12px',
              }}
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                backgroundColor: 'var(--color-pale-green)',
                color: 'var(--color-olive)',
                fontSize: '12px',
              }}
            >
              {notice}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              marginTop: '4px',
              padding: '12px 20px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              backgroundColor: 'var(--color-olive)',
              color: 'var(--color-text-on-dark)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {isSubmitting
              ? 'Please wait...'
              : mode === 'signup'
              ? 'Create Account'
              : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)' }}>
          {mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => onSwitchMode('signin')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-olive)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Sign In
              </button>
            </>
          ) : (
            <>
              New to Ground Radar?{' '}
              <button
                type="button"
                onClick={() => onSwitchMode('signup')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-olive)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Create an Account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};