/**
 * Scans recipe photos with the same code the Worker uses, straight from this
 * machine (no Worker, no sign-in), for checking accuracy and cost.
 * Each run is a paid Claude call (a few cents per recipe).
 *
 *   ANTHROPIC_API_KEY=$(cat ~/.anthropic-key) npx tsx worker/scripts/try-scan.ts page1.jpg [page2.jpg …]
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';

import { SEED_TAGS } from '../../src/features/household/seed-data';
import { readRecipe, SCAN_MODEL } from '../src/read-recipe';

// Claude Opus 5.5, $ per million tokens.
const INPUT_PRICE = 4;
const OUTPUT_PRICE = 20;

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) throw new Error('Pass one or more JPEG pages.');
  const started = Date.now();
  const outcome = await readRecipe(new Anthropic(), {
    images: files.map((f) => ({
      media_type: 'image/jpeg',
      data: readFileSync(f).toString('base64'),
    })),
    tags: SEED_TAGS.map((t) => ({ id: t.id, name: t.name, group: t.group })),
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (!outcome.ok) {
    console.log(`Failed after ${seconds}s:`, outcome);
    process.exitCode = 1;
    return;
  }
  const { input_tokens, output_tokens } = outcome.usage;
  const cost = (input_tokens * INPUT_PRICE + output_tokens * OUTPUT_PRICE) / 1e6;
  console.log(JSON.stringify(outcome.result, null, 2));
  console.log(
    `${SCAN_MODEL}: ${seconds}s, ${input_tokens} in / ${output_tokens} out tokens, about $${cost.toFixed(3)}`
  );
}

main();
