/**
 * Categorizes ingredient names with the same code the Worker uses, straight
 * from this machine (no Worker, no sign-in). Each run is a paid Claude call
 * (a fraction of a cent).
 *
 *   ANTHROPIC_API_KEY=$(cat ~/.anthropic-key) npx tsx worker/scripts/try-categorize.ts "Rotel" "Tajín" …
 */
import Anthropic from '@anthropic-ai/sdk';

import { categorizeNames, CATEGORIZE_MODEL } from '../src/categorize';

async function main() {
  const names = process.argv.slice(2);
  if (names.length === 0) throw new Error('Pass one or more ingredient names.');
  const started = Date.now();
  const outcome = await categorizeNames(new Anthropic(), names);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (!outcome.ok) throw new Error(`${outcome.error}: ${outcome.message}`);
  console.log(`${CATEGORIZE_MODEL}, ${seconds}s`);
  for (const r of outcome.result.results) console.log(`${r.name} → ${r.category}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
