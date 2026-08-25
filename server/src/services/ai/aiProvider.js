/**
 * aiProvider.js — the ONLY file in this codebase that knows anything about a
 * specific AI provider.
 *
 * WHY THE ISOLATION IS A HARD RULE AND NOT A PREFERENCE. Provider quirks spread.
 * Once a controller knows that the text is at
 * `choices[0].message.content`, switching provider means editing controllers,
 * and the fallback path stops being testable. Everything above this file receives
 * one plain string and cannot tell which provider produced it.
 *
 * WHAT IS PROVIDER-SPECIFIC AND LIVES HERE
 *   - the request URL, headers and auth scheme
 *   - the request body shape
 *   - where the generated text sits in the response envelope
 *
 * WHAT IS NOT AND LIVES IN assessmentAi.js
 *   - the prompt
 *   - parsing that text into questions, validating and normalising them
 *   - the decision to fall back
 *
 * SUPPORTED SHAPES. Two, because between them they cover almost everything a
 * hackathon would plug in:
 *   1. OpenAI-compatible chat completions — OpenAI, Groq, OpenRouter, Together,
 *      Mistral, DeepSeek, Ollama, LM Studio, vLLM. Detected by default.
 *   2. Google Gemini generateContent — detected from `generativelanguage` in the
 *      URL, because its auth header and body differ.
 *
 * NO SDK. Node 18+ ships `fetch`, so this file adds zero dependencies. That is
 * deliberate: a dependency the presenter has to install is a dependency that can
 * fail to install an hour before a demo.
 */

import { env } from '../../config/env.js';

/** Provider families this file can talk to. */
const PROVIDER_KINDS = Object.freeze({
  OPENAI_COMPATIBLE: 'openai-compatible',
  GEMINI: 'gemini',
});

/**
 * Guesses the family from the URL. Guessing is acceptable here because being
 * wrong costs one failed request and a fallback, not a crash — and the
 * alternative is another environment variable to get wrong.
 */
const detectProviderKind = (apiUrl) =>
  /generativelanguage\.googleapis\.com/i.test(apiUrl) ? PROVIDER_KINDS.GEMINI : PROVIDER_KINDS.OPENAI_COMPATIBLE;

/** Builds the URL, headers and body for one text-in, text-out call. */
const buildRequest = ({ kind, apiUrl, apiKey, model, systemPrompt, userPrompt, maxTokens }) => {
  if (kind === PROVIDER_KINDS.GEMINI) {
    // Gemini takes the key as a header and folds the system prompt into
    // `systemInstruction`; it has no `messages` array.
    return {
      url: apiUrl.includes(':generateContent') ? apiUrl : `${apiUrl.replace(/\/$/, '')}/models/${model}:generateContent`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
        }),
      },
    };
  }

  return {
    url: apiUrl,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: maxTokens,
        // Ignored by providers that do not support it; harmless where it is.
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    },
  };
};

/** Digs the generated text out of whichever envelope came back. */
const extractText = (kind, payload) => {
  if (kind === PROVIDER_KINDS.GEMINI) {
    const parts = payload?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map((part) => part?.text ?? '').join('');
  }

  const message = payload?.choices?.[0]?.message;
  if (typeof message?.content === 'string') return message.content;
  // Some gateways return content as an array of parts.
  if (Array.isArray(message?.content)) {
    return message.content.map((part) => (typeof part === 'string' ? part : part?.text ?? '')).join('');
  }
  return '';
};

/**
 * Sends one prompt and returns `{ ok, text, reason }`.
 *
 * NEVER THROWS. Every caller of this module is on a request path that must
 * succeed without AI, so an exception escaping here would turn an optional
 * enhancement into a 500. The failure reason is returned as data and logged by
 * the caller.
 */
export const requestCompletion = async ({ systemPrompt, userPrompt, maxTokens = 2400 }) => {
  const { apiKey, apiUrl, model, timeoutMs } = env.ai;

  if (!apiKey || !apiUrl || !model) {
    return { ok: false, text: '', reason: 'not-configured' };
  }

  const kind = detectProviderKind(apiUrl);
  const { url, init } = buildRequest({ kind, apiUrl, apiKey, model, systemPrompt, userPrompt, maxTokens });

  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });

    if (!response.ok) {
      // 429 and 402 are the ones a free tier actually produces; they are named
      // so a log line says "quota" rather than an opaque number.
      const reason =
        response.status === 429
          ? 'rate-limited'
          : response.status === 401 || response.status === 403
            ? 'auth-rejected'
            : response.status === 402
              ? 'quota-exhausted'
              : `http-${response.status}`;
      return { ok: false, text: '', reason };
    }

    const payload = await response.json();
    const text = extractText(kind, payload);

    if (!text.trim()) return { ok: false, text: '', reason: 'empty-response' };
    return { ok: true, text, reason: 'ok' };
  } catch (caught) {
    // AbortSignal.timeout rejects with a TimeoutError; a DNS or TLS failure
    // rejects with a TypeError. Both are "no AI this time", not an error state.
    const reason = caught?.name === 'TimeoutError' ? 'timeout' : 'network-error';
    return { ok: false, text: '', reason };
  }
};

export { PROVIDER_KINDS, detectProviderKind, extractText };

export default requestCompletion;
