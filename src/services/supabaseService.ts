import { createClient } from '@supabase/supabase-js';
import type { TracedFieldData } from '../components/FieldTracerMap';
import type { GroundRadarAnalysisResult } from './rotationGeneratorService';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export interface SavedAnalysisRecord {
  fieldId: string;
  analysisId: string;
  photoUrls: string[];
  persistedToCloud: boolean;
}

function base64ToBlob(dataUrl: string): { blob: Blob; ext: string } {
  const [header, base64Data] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const ext = mimeType.split('/')[1] || 'jpg';

  const byteChars = atob(base64Data);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  return { blob: new Blob([new Uint8Array(byteNumbers)], { type: mimeType }), ext };
}

export async function saveFieldAnalysisToSupabase(
  field: TracedFieldData,
  analysis: GroundRadarAnalysisResult,
  userId?: string | null
): Promise<SavedAnalysisRecord> {
  if (!supabase) {
    console.warn('Supabase env vars missing; running in local-only mode.');
    return {
      fieldId: crypto.randomUUID(),
      analysisId: crypto.randomUUID(),
      photoUrls: analysis.survey.photosBase64,
      persistedToCloud: false,
    };
  }

  // 1. Insert traced field polygon into `fields`
  const { data: fieldRow, error: fieldError } = await supabase
    .from('fields')
    .insert({
      user_id: userId ?? null,
      latitude: field.latitude,
      longitude: field.longitude,
      area_acres: field.area_acres,
      mode: analysis.survey.mode,
      polygon_geojson: field.geoJson,
    })
    .select('id')
    .single();

  if (fieldError || !fieldRow) {
    throw new Error(`Failed to save field polygon: ${fieldError?.message}`);
  }

  // 2. Upload 3–6 ground-truth photos to Supabase Storage (`field-photos`)
  const uploadedUrls: string[] = [];
  for (let i = 0; i < analysis.survey.photosBase64.length; i++) {
    const dataUrl = analysis.survey.photosBase64[i];
    if (!dataUrl.startsWith('data:')) {
      uploadedUrls.push(dataUrl);
      continue;
    }

    const { blob, ext } = base64ToBlob(dataUrl);
    const filePath = `${fieldRow.id}/photo_${i + 1}_${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('field-photos')
      .upload(filePath, blob, { upsert: true });

    if (!uploadErr) {
      const { data: pubUrl } = supabase.storage.from('field-photos').getPublicUrl(filePath);
      uploadedUrls.push(pubUrl.publicUrl);
    } else {
      console.warn(`Photo ${i + 1} upload skipped:`, uploadErr.message);
    }
  }

  // 3. Insert complete NASA + Survey + Rotation Strategies record into `field_analyses`
  const { data: analysisRow, error: analysisError } = await supabase
    .from('field_analyses')
    .insert({
      field_id: fieldRow.id,
      photo_urls: uploadedUrls,
      photo_notes: analysis.survey.photoNotes,
      planned_rotation: analysis.survey.planned_rotation,
      past_rotation: analysis.survey.past_rotation,
      priorities: analysis.survey.priorities,
      nasa_environment: analysis.nasa_environment,
      field_profile: analysis.field_profile,
      strategies: analysis.strategies,
      check_locally: analysis.check_locally,
    })
    .select('id')
    .single();

  if (analysisError || !analysisRow) {
    throw new Error(`Failed to save field analysis: ${analysisError?.message}`);
  }

  return {
    fieldId: fieldRow.id,
    analysisId: analysisRow.id,
    photoUrls: uploadedUrls,
    persistedToCloud: true,
  };
}