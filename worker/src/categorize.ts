/**
 * The Claude call behind /categorize: a few ingredient names the app's
 * built-in list doesn't know in, a category for each out (structured
 * output, checked again). Small and cheap, so it uses Haiku.
 */
import Anthropic from '@anthropic-ai/sdk';

import {
  CATEGORIZE_SYSTEM_PROMPT,
  categorizeJsonSchema,
  categorizeUserPrompt,
  parseCategorizeResult,
  type CategorizeResult,
} from '../../src/features/categorize/categorize-contract';

export const CATEGORIZE_MODEL = 'claude-haiku-4-5';

export type CategorizeOutcome =
  | { ok: true; result: CategorizeResult }
  | { ok: false; status: number; error: string; message: string };

export async function categorizeNames(
  client: Anthropic,
  names: string[]
): Promise<CategorizeOutcome> {
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: CATEGORIZE_MODEL,
      max_tokens: 4000,
      output_config: { format: { type: 'json_schema', schema: categorizeJsonSchema() } },
      system: CATEGORIZE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: categorizeUserPrompt(names) }],
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error('Claude API error', error.status, error.message);
      return { ok: false, status: 502, error: 'categorize_error', message: 'Try again later.' };
    }
    throw error;
  }
  const text = response.content.find((b) => b.type === 'text');
  let json: unknown = null;
  try {
    json = text?.type === 'text' ? JSON.parse(text.text) : null;
  } catch {
    json = null;
  }
  const result = parseCategorizeResult(json, names);
  if (!result) {
    return { ok: false, status: 502, error: 'categorize_error', message: 'Try again later.' };
  }
  return { ok: true, result };
}
