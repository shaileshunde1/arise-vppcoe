/**
 * geminiClient.ts  →  place at: src/lib/geminiClient.ts
 * Secure Gemini 1.5 Flash client for ARISE.
 *
 * SETUP: add this line to your .env file at project root:
 *   VITE_GEMINI_API_KEY=AIza...your_key_here
 * Then restart the Vite dev server.
 * Never commit .env — make sure it is in .gitignore.
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      'Gemini API key missing. Add VITE_GEMINI_API_KEY=your_key to your .env file and restart the dev server.',
    );
  }

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 512, topP: 0.95 },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => 'unknown error');
    throw new Error(`Gemini ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned an empty response.');
  return text.trim();
}

/** askGemini — plain text. Used by LabSimulator for real-time data insight. */
export async function askGemini(prompt: string): Promise<string> {
  return callGemini(prompt);
}

/**
 * askGeminiJSON<T> — returns parsed JSON.
 * Used by StudentDashboard for structured AI insights.
 * Your prompt MUST instruct the model to return only raw JSON (no markdown fences).
 */
export async function askGeminiJSON<T>(prompt: string): Promise<T> {
  const raw = await callGemini(prompt);
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Gemini returned non-JSON: ${cleaned.slice(0, 300)}`);
  }
}