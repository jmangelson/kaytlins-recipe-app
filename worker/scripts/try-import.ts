/**
 * Imports a recipe page with the same code the Worker uses, straight from
 * this machine. Pages with schema.org Recipe data are free; others are read
 * by Claude (a paid call, a few cents).
 *
 *   ANTHROPIC_API_KEY=$(cat ~/.anthropic-key) npx tsx worker/scripts/try-import.ts https://…
 */
import Anthropic from '@anthropic-ai/sdk';

import { normalizeUrl, pageText, recipeFromHtml } from '../../src/features/import/recipe-page';
import { readRecipe, SCAN_MODEL } from '../src/read-recipe';

// Claude Opus 5.5, $ per million tokens.
const INPUT_PRICE = 4;
const OUTPUT_PRICE = 20;

async function main() {
  const url = normalizeUrl(process.argv[2] ?? '');
  if (!url) throw new Error('Pass a recipe link.');
  const page = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Android) Chrome/130' } });
  const html = await page.text();
  const recipe = recipeFromHtml(html);
  if (recipe) {
    console.log('Recipe data on the page (free):');
    console.log(JSON.stringify(recipe, null, 2));
    return;
  }
  const text = pageText(html);
  console.log(`No recipe data; Claude reads ${text.length} characters of page text…`);
  if (process.argv[3] !== '--paid') {
    console.log('Add --paid to make the Claude call.');
    return;
  }
  const started = Date.now();
  const outcome = await readRecipe(new Anthropic(), {
    images: [],
    tags: [
      { id: 'beef', name: 'Beef', group: 'type' },
      { id: 'main-dish', name: 'Main dish', group: 'course' },
      { id: 'dinner', name: 'Dinner', group: 'meal' },
    ],
    pageText: text,
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (!outcome.ok) throw new Error(`${outcome.error}: ${outcome.message}`);
  const { input_tokens, output_tokens } = outcome.usage;
  const cost = (input_tokens * INPUT_PRICE + output_tokens * OUTPUT_PRICE) / 1e6;
  console.log(
    `${SCAN_MODEL}, ${seconds}s, ${input_tokens} in / ${output_tokens} out, ~$${cost.toFixed(3)}`
  );
  console.log(JSON.stringify(outcome.result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
