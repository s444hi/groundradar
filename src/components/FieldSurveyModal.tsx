import React, { useMemo, useState } from 'react';
import { Camera, Sprout, Sliders, X, Sparkles, Info, Check } from 'lucide-react';
import cropsData from '../simulation/data/crops.json';

export type PlotMode = 'farm' | 'garden';

export interface RotationSlotInput {
  year: number;
  season: 'warm_season' | 'cool_season';
  crops: string[];
}

export interface SurveyModalOutput {
  mode: PlotMode;
  photosBase64: string[];
  photoNotes: string;
  planned_rotation: RotationSlotInput[];
  past_rotation: RotationSlotInput[];
  priorities: {
    water: number;
    income: number;
    soil_health: number;
    pests: number;
  };
}

interface FieldSurveyModalProps {
  areaAcres: number;
  latitude: number;
  longitude: number;
  onClose: () => void;
  onSubmitSurvey: (data: SurveyModalOutput) => void;
}

type CropRecord = {
  display_name: string;
  family: string;
  season_type: 'warm_season' | 'cool_season' | 'any';
  nutrient_role: string;
  water_need: string;
  is_cover_crop: boolean;
  fits: string[];
};

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 6;

export const FieldSurveyModal: React.FC<FieldSurveyModalProps> = ({
  areaAcres,
  latitude,
  longitude,
  onClose,
  onSubmitSurvey,
}) => {
  // Auto-suggest 'garden' if traced area is under 1 acre, 'farm' otherwise
  const [mode, setMode] = useState<PlotMode>(areaAcres < 1 ? 'garden' : 'farm');

  // Photo upload state (NASA GLOBE-style ground-truth protocol: 3–6 photos)
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoNotes, setPhotoNotes] = useState('');
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Crop selections
  const [targetCropId, setTargetCropId] = useState<string>('tomato');
  const [pastCropId, setPastCropId] = useState<string>(''); // Optional: empty = "unknown / use baseline"

  // Priority sliders (0 - 10)
  const [priorities, setPriorities] = useState({
    water: 7,
    income: 6,
    soil_health: 8,
    pests: 7,
  });

  const cropsMap = cropsData.crops as Record<string, CropRecord>;

  // Filter crops from teammate's crops.json based on Farm vs. Garden mode
  const availableCrops = useMemo(() => {
    return Object.entries(cropsMap)
      .filter(([id, crop]) => id !== 'fallow' && crop.fits.includes(mode))
      .map(([id, crop]) => ({ id, ...crop }));
  }, [cropsMap, mode]);

  // Ensure targetCropId stays valid if user switches between Farm and Garden
  const handleModeSwitch = (newMode: PlotMode) => {
    setMode(newMode);
    const validForNewMode = Object.entries(cropsMap).filter(
      ([id, c]) => id !== 'fallow' && c.fits.includes(newMode)
    );
    if (!validForNewMode.some(([id]) => id === targetCropId) && validForNewMode.length > 0) {
      setTargetCropId(validForNewMode[0][0]);
    }
    if (pastCropId && !validForNewMode.some(([id]) => id === pastCropId)) {
      setPastCropId('');
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = MAX_PHOTOS - photoPreviews.length;
    if (remainingSlots <= 0) {
      setPhotoError(`Maximum of ${MAX_PHOTOS} photos allowed.`);
      e.target.value = '';
      return;
    }

    const filesToRead = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      setPhotoError(`Only the first ${remainingSlots} photo(s) were added (max ${MAX_PHOTOS}).`);
    } else {
      setPhotoError(null);
    }

    Promise.all(
      filesToRead.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          })
      )
    ).then((newImages) => {
      setPhotoPreviews((prev) => [...prev, ...newImages]);
    });

    e.target.value = '';
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    setPhotoPreviews((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setPhotoError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (photoPreviews.length > 0 && photoPreviews.length < MIN_PHOTOS) {
      setPhotoError(
        `Please upload at least ${MIN_PHOTOS} photos (up to ${MAX_PHOTOS}) for multi-angle ground truth, or remove the partial upload to skip.`
      );
      return;
    }

    const selectedTarget = cropsMap[targetCropId];
    const targetSeason: 'warm_season' | 'cool_season' =
      selectedTarget?.season_type === 'cool_season' ? 'cool_season' : 'warm_season';

    const planned_rotation: RotationSlotInput[] = [
      {
        year: 1,
        season: targetSeason,
        crops: [targetCropId],
      },
    ];

    const past_rotation: RotationSlotInput[] = pastCropId
      ? [
          {
            year: 0,
            season:
              cropsMap[pastCropId]?.season_type === 'cool_season'
                ? 'cool_season'
                : 'warm_season',
            crops: [pastCropId],
          },
        ]
      : [];

    onSubmitSurvey({
      mode,
      photosBase64: photoPreviews,
      photoNotes: photoNotes.trim(),
      planned_rotation,
      past_rotation,
      priorities,
    });
  };

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
        zIndex: 1000,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-card)',
          maxWidth: '720px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '28px 32px',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '16px',
            marginBottom: '20px',
          }}
        >
          <div>
            <span
              style={{
                display: 'inline-block',
                backgroundColor: 'var(--color-pale-green)',
                color: 'var(--color-olive)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                padding: '4px 12px',
                borderRadius: 'var(--radius-pill)',
                marginBottom: '8px',
              }}
            >
              {areaAcres} ACRES • {latitude}°, {longitude}°
            </span>
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '28px',
                fontWeight: 400,
                color: 'var(--color-text)',
                margin: 0,
              }}
            >
              2. Field Ground-Truth & Crop Goals
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'var(--color-bg-subtle)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-pill)',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-text)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Section A: Farm vs. Garden Scale */}
          <div>
            <label
              style={{
                display: 'block',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--color-text)',
                marginBottom: '8px',
              }}
            >
              Plot Scale
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {(['farm', 'garden'] as PlotMode[]).map((option) => {
                const active = mode === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleModeSwitch(option)}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: 'var(--radius-pill)',
                      border: active
                        ? '1px solid var(--color-olive)'
                        : '1px solid var(--color-border)',
                      backgroundColor: active ? 'var(--color-olive)' : 'var(--color-bg-subtle)',
                      color: active ? 'var(--color-text-on-dark)' : 'var(--color-text)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '14px',
                      fontWeight: 500,
                      textTransform: 'capitalize',
                      cursor: 'pointer',
                    }}
                  >
                    {option === 'farm' ? 'Commercial / Acreage Farm' : 'Home / Community Garden'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section B: NASA Ground-Truth Photo Upload (3 to 6 Photos) */}
          <div
            style={{
              backgroundColor: 'var(--color-bg-subtle)',
              border: '1px solid var(--color-border)',
              borderRadius: '16px',
              padding: '16px 18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={18} style={{ color: 'var(--color-olive)' }} />
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--color-text)',
                  }}
                >
                  Upload Field / Soil Photos (3–6 Photos Recommended)
                </span>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color:
                    photoPreviews.length >= MIN_PHOTOS
                      ? 'var(--color-sim-good)'
                      : 'var(--color-text-muted)',
                }}
              >
                {photoPreviews.length}/{MAX_PHOTOS} uploaded
              </span>
            </div>

            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                color: 'var(--color-text-muted)',
                margin: '0 0 12px 0',
                lineHeight: 1.45,
              }}
            >
              <strong>NASA Ground-Truth Guide:</strong> Upload <strong>3 to 6 photos</strong> across your traced area:
              (1) close-up of bare soil color & texture, (2) existing plants, weeds, or crop residue, and (3) surrounding
              slope, puddles, or nearby water bodies. This helps our AI downscale coarse SMAP/Landsat satellite pixels to
              your exact plot.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              {photoPreviews.length < MAX_PHOTOS && (
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 18px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: 'var(--color-cream)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <Camera size={15} />
                  {photoPreviews.length > 0
                    ? `Add More Photos (${MAX_PHOTOS - photoPreviews.length} left)`
                    : 'Choose 3–6 Field Photos'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              )}

              {photoPreviews.length >= MIN_PHOTOS && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--color-sim-good)',
                  }}
                >
                  <Check size={14} /> {photoPreviews.length} ground-truth images attached
                </span>
              )}
            </div>

            {photoError && (
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '12px',
                  color: 'var(--color-sim-risk)',
                  margin: '8px 0 0 0',
                }}
              >
                {photoError}
              </p>
            )}

            {photoPreviews.length > 0 && (
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '10px',
                  }}
                >
                  {Array.from({ length: MAX_PHOTOS }).map((_, idx) => {
                    const src = photoPreviews[idx];
                    if (src) {
                      return (
                        <div
                          key={idx}
                          style={{
                            position: 'relative',
                            height: '82px',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          <img
                            src={src}
                            alt={`Field ground truth ${idx + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(idx)}
                            aria-label={`Remove photo ${idx + 1}`}
                            style={{
                              position: 'absolute',
                              top: '5px',
                              right: '5px',
                              width: '22px',
                              height: '22px',
                              borderRadius: 'var(--radius-pill)',
                              border: 'none',
                              backgroundColor: 'rgba(17, 17, 17, 0.7)',
                              color: 'var(--color-text-on-dark)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <label
                        key={idx}
                        style={{
                          height: '82px',
                          borderRadius: '12px',
                          border:
                            idx < MIN_PHOTOS
                              ? '1px dashed var(--color-olive)'
                              : '1px dashed var(--color-border)',
                          backgroundColor: 'var(--color-bg)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          color:
                            idx < MIN_PHOTOS
                              ? 'var(--color-olive)'
                              : 'var(--color-text-muted)',
                        }}
                      >
                        <Camera size={14} />
                        <span>{idx < MIN_PHOTOS ? `Photo ${idx + 1} (Req)` : `Photo ${idx + 1} (Opt)`}</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handlePhotoUpload}
                          style={{ display: 'none' }}
                        />
                      </label>
                    );
                  })}
                </div>

                <input
                  type="text"
                  value={photoNotes}
                  onChange={(e) => setPhotoNotes(e.target.value)}
                  placeholder="Optional note (e.g., 'creek along south edge, puddles after rain')..."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                  }}
                />
              </div>
            )}
          </div>

          {/* Section C: Crop Questions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--color-text)',
                  marginBottom: '6px',
                }}
              >
                <Sprout size={16} style={{ color: 'var(--color-olive)' }} />
                What do you want to plant next? *
              </label>
              <select
                value={targetCropId}
                onChange={(e) => setTargetCropId(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  color: 'var(--color-text)',
                }}
              >
                {availableCrops.map((crop) => (
                  <option key={crop.id} value={crop.id}>
                    {crop.display_name} ({crop.season_type.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--color-text)',
                  marginBottom: '6px',
                }}
              >
                <Info size={16} style={{ color: 'var(--color-text-muted)' }} />
                What was planted before? (Optional)
              </label>
              <select
                value={pastCropId}
                onChange={(e) => setPastCropId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  color: 'var(--color-text)',
                }}
              >
                <option value="">Not sure / Skip (use NASA + Soil baseline)</option>
                {availableCrops.map((crop) => (
                  <option key={crop.id} value={crop.id}>
                    {crop.display_name} ({crop.family})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section D: Priority Sliders (0 - 10) */}
          <div
            style={{
              backgroundColor: 'var(--color-cream)',
              borderRadius: '16px',
              padding: '16px 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Sliders size={16} style={{ color: 'var(--color-olive)' }} />
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--color-text)',
                }}
              >
                Your Rotation Priorities (0 = Low, 10 = Top Priority)
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              {(
                [
                  { key: 'water', label: 'Water Conservation' },
                  { key: 'soil_health', label: 'Soil Health & Organic Matter' },
                  { key: 'pests', label: 'Pest & Disease Break' },
                  { key: 'income', label: 'Harvest Value / Income' },
                ] as const
              ).map(({ key, label }) => (
                <div key={key}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px',
                      marginBottom: '4px',
                    }}
                  >
                    <span>{label}</span>
                    <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-olive)' }}>
                      {priorities[key]}/10
                    </strong>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={priorities[key]}
                    onChange={(e) =>
                      setPriorities((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                    }
                    style={{ width: '100%', accentColor: 'var(--color-olive)' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Submit Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '11px 20px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Back to Map
            </button>
            <button
              type="submit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 26px',
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
              <Sparkles size={16} />
              Analyze with NASA Data
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};