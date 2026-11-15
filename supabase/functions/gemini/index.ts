// Supabase Edge Function: server-side proxy for Google Gemini.
//
// Keeps GEMINI_API_KEY out of the browser bundle. The client calls this with
// supabase.functions.invoke('gemini', { body }); the model is pinned here and
// the key is read from the function's environment, never from the request.

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_PROMPT_CHARS = 20_000;
const MAX_IMAGES = 6;

// https://supabase.com/docs/guides/functions/cors
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface GeminiImage {
  mime_type: string;
  data: string;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function badRequest(message: string): Response {
  return jsonResponse({ error: message }, 400);
}

/** Returns the validated images, or a string describing why the input is invalid. */
function readImages(raw: unknown): GeminiImage[] | string {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return 'images must be an array.';
  if (raw.length > MAX_IMAGES) return `images must hold at most ${MAX_IMAGES} entries.`;

  const images: GeminiImage[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) return 'Each image must be an object.';
    const { mime_type: mimeType, data } = entry as Record<string, unknown>;
    if (typeof mimeType !== 'string' || !mimeType.startsWith('image/')) {
      return 'Each image needs a mime_type starting with "image/".';
    }
    if (typeof data !== 'string' || data.length === 0) {
      return 'Each image needs base64 data.';
    }
    images.push({ mime_type: mimeType, data });
  }
  return images;
}

/** Returns the clamped temperature, or a string describing why the input is invalid. */
function readTemperature(raw: unknown): number | undefined | string {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 'temperature must be a number.';
  return Math.min(1, Math.max(0, raw));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Use POST.' }, 405);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return badRequest('Body must be JSON.');
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return badRequest('Body must be a JSON object.');
  }

  const { prompt, images: rawImages, temperature: rawTemperature } = payload as Record<string, unknown>;

  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    return badRequest('prompt must be a non-empty string.');
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return badRequest(`prompt must be at most ${MAX_PROMPT_CHARS} characters.`);
  }

  const images = readImages(rawImages);
  if (typeof images === 'string') return badRequest(images);

  const temperature = readTemperature(rawTemperature);
  if (typeof temperature === 'string') return badRequest(temperature);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return jsonResponse(
      { error: 'Gemini is not configured on this project. Set the GEMINI_API_KEY secret.' },
      503
    );
  }

  const parts: unknown[] = [{ text: prompt }];
  for (const image of images) {
    parts.push({ inline_data: { mime_type: image.mime_type, data: image.data } });
  }

  let upstream: Response;
  try {
    upstream = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts }],
        ...(temperature === undefined ? {} : { generationConfig: { temperature } }),
      }),
    });
  } catch {
    return jsonResponse({ error: 'Could not reach Gemini.' }, 502);
  }

  if (!upstream.ok) {
    // Deliberately log only the status: the upstream body can repeat the key.
    console.error(`Gemini returned HTTP ${upstream.status}`);
    return jsonResponse({ error: `Gemini returned HTTP ${upstream.status}.` }, 502);
  }

  let text: unknown;
  try {
    const json = await upstream.json();
    text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch {
    return jsonResponse({ error: 'Gemini returned a malformed response.' }, 502);
  }

  if (typeof text !== 'string' || text.length === 0) {
    return jsonResponse({ error: 'Gemini returned no text.' }, 502);
  }

  return jsonResponse({ text }, 200);
});
