/**
 * The Claude call behind a scan: the photos plus her tags in, the recipe in
 * the app's fixed format out (structured output, checked again). Used by the
 * Worker and by scripts/try-scan.ts.
 */
import Anthropic from '@anthropic-ai/sdk';

import {
  parseScanResult,
  scanJsonSchema,
  scanUnitKeys,
  type ScanRequest,
  type ScanResult,
} from '../../src/features/scan/scan-contract';
import { SYSTEM_PROMPT, userPrompt } from './scan-request';

export const SCAN_MODEL = 'claude-opus-5-5';

export type ReadOutcome =
  | { ok: true; result: ScanResult; usage: Anthropic.Beta.BetaUsage }
  | { ok: false; status: number; error: string; message: string };

/**
 * Reads photos (a scan) or, with `pageText`, the text of a recipe web page
 * that has no recipe data of its own (an import).
 */
export async function readRecipe(
  client: Anthropic,
  request: ScanRequest & { pageText?: string; pageSource?: 'page' | 'data' }
): Promise<ReadOutcome> {
  const tagIds = request.tags.map((t) => t.id);
  const unitKeys = scanUnitKeys(request);
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: SCAN_MODEL,
      max_tokens: 16000,
      // On a safety decline, the API retries the request on a fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: scanJsonSchema(tagIds, unitKeys) },
      },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            ...request.images.map((image) => ({
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: image.media_type,
                data: image.data,
              },
            })),
            ...(request.pageText
              ? [
                  {
                    type: 'text' as const,
                    text:
                      request.pageSource === 'data'
                        ? `A recipe web page's recipe data:\n\n${request.pageText}`
                        : `The text of a recipe web page:\n\n${request.pageText}`,
                  },
                ]
              : []),
            {
              type: 'text' as const,
              text: userPrompt(
                request.tags,
                request.units,
                request.pageText ? (request.pageSource ?? 'page') : 'photos'
              ),
            },
          ],
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return {
        ok: false,
        status: 503,
        error: 'busy',
        message: 'The recipe reader is busy. Try again in a minute.',
      };
    }
    if (error instanceof Anthropic.APIError) {
      console.error('Claude API error', error.status, error.message);
      return {
        ok: false,
        status: 502,
        error: 'reader_error',
        message: 'The recipe reader isn’t available right now. Try again soon.',
      };
    }
    throw error;
  }

  if (response.stop_reason === 'refusal') {
    return {
      ok: false,
      status: 422,
      error: 'declined',
      message: 'These photos couldn’t be read as a recipe.',
    };
  }
  if (response.stop_reason === 'max_tokens') {
    return {
      ok: false,
      status: 422,
      error: 'too_long',
      message: 'That recipe is too long to read in one go. Try fewer pages.',
    };
  }
  const text = response.content.find((b) => b.type === 'text');
  let result: ScanResult | null = null;
  try {
    result =
      text?.type === 'text' ? parseScanResult(JSON.parse(text.text), tagIds, unitKeys) : null;
  } catch {
    result = null;
  }
  if (!result) {
    console.error('Unexpected scan output', response.stop_reason);
    return {
      ok: false,
      status: 502,
      error: 'reader_error',
      message: 'The recipe couldn’t be read. Try again.',
    };
  }
  return { ok: true, result, usage: response.usage };
}
