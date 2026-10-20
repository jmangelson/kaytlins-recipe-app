/**
 * The Claude call behind /duplicates: her ingredient list in, suggested
 * groups of the same thing to buy out (structured output, checked again).
 */
import Anthropic from '@anthropic-ai/sdk';

import {
  DUPLICATES_JSON_SCHEMA,
  DUPLICATES_SYSTEM_PROMPT,
  duplicatesUserPrompt,
  parseDuplicatesResult,
  type DuplicatesRequest,
  type DuplicatesResult,
} from '../../src/features/duplicates/duplicates-contract';

export const DUPLICATES_MODEL = 'claude-opus-5-5';

export type DuplicatesOutcome =
  | { ok: true; result: DuplicatesResult; usage: Anthropic.Beta.BetaUsage }
  | { ok: false; status: number; error: string; message: string };

export async function findDuplicates(
  client: Anthropic,
  request: DuplicatesRequest
): Promise<DuplicatesOutcome> {
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: DUPLICATES_MODEL,
      max_tokens: 8000,
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: DUPLICATES_JSON_SCHEMA },
      },
      system: DUPLICATES_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: duplicatesUserPrompt(request) }],
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error('Claude API error', error.status, error.message);
      return {
        ok: false,
        status: 502,
        error: 'duplicates_error',
        message: 'Couldn’t check for duplicates right now. Try again soon.',
      };
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
  const result = parseDuplicatesResult(
    json,
    request.ingredients.map((i) => i.id)
  );
  if (!result) {
    return {
      ok: false,
      status: 502,
      error: 'duplicates_error',
      message: 'The check sent something unexpected. Try again.',
    };
  }
  return { ok: true, result, usage: response.usage };
}
