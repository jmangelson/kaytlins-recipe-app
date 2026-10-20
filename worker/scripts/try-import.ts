/**
 * Imports a recipe page with the same code the Worker uses, straight from
 * this machine: Claude reads the page's recipe data (or its text) into the
 * scan format. Without --paid it only shows what would be sent.
 *
 *   ANTHROPIC_API_KEY=$(cat ~/.anthropic-key) npx tsx worker/scripts/try-import.ts https://…
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';

import {
  normalizeUrl,
  pageText,
  recipeDataText,
  recipeFromHtml,
} from '../../src/features/import/recipe-page';
import { readRecipe, SCAN_MODEL } from '../src/read-recipe';

// Claude Opus 5.5, $ per million tokens.
const INPUT_PRICE = 4;
const OUTPUT_PRICE = 20;

async function main() {
  const url = normalizeUrl(process.argv[2] ?? '');
  if (!url) throw new Error('Pass a recipe link.');
  // --html saved.html: a page saved elsewhere (some sites block this machine).
  const saved = process.argv.indexOf('--html');
  const html =
    saved > 0
      ? readFileSync(process.argv[saved + 1], 'utf8')
      : await (
          await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Android) Chrome/130' } })
        ).text();
  const recipe = recipeFromHtml(html);
  const text = recipe ? recipeDataText(recipe) : pageText(html);
  console.log(
    recipe
      ? `Recipe data on the page; Claude tidies it:\n${text}`
      : `No recipe data; Claude reads ${text.length} characters of page text…`
  );
  if (!process.argv.includes('--paid')) {
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
    pageSource: recipe ? 'data' : 'page',
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
