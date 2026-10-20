/**
 * Runs the duplicates check with the same code the Worker uses, on a sample
 * ingredient list with tricky pairs. One paid Claude call (a few cents).
 *
 *   ANTHROPIC_API_KEY=$(cat ~/.anthropic-key) npx tsx worker/scripts/try-duplicates.ts
 */
import Anthropic from '@anthropic-ai/sdk';

import { DUPLICATES_MODEL, findDuplicates } from '../src/duplicates';

const SAMPLE: [string, string][] = [
  ['zucchini', 'produce-greens'],
  ['zucchinni', 'uncategorized'],
  ['yellow onion', 'produce-roots'],
  ['yellow onions', 'produce-roots'],
  ['red onion', 'produce-roots'],
  ['Rotel', 'canned-vegetables'],
  ['diced tomatoes with green chiles', 'canned-vegetables'],
  ['diced tomatoes', 'canned-vegetables'],
  ['fresh basil', 'produce-greens'],
  ['dried basil', 'spices'],
  ['chicken breasts', 'fresh-meat'],
  ['boneless skinless chicken breast', 'fresh-meat'],
  ['chicken thighs', 'fresh-meat'],
  ['chicken bullion', 'fresh-meat'],
  ['chicken bouillon cubes', 'soup'],
  ['parm', 'cheese'],
  ['parmesan cheese', 'cheese'],
  ['whole milk', 'dairy'],
  ['2% milk', 'dairy'],
  ['frozen salmon', 'frozen-seafood'],
  ['fresh salmon', 'fresh-seafood'],
  ['ground cumin', 'spices'],
  ['cumin seed', 'spices'],
  ['all purpose flour', 'flour-sugar'],
  ['all-purpose flour', 'flour-sugar'],
  ['evoo', 'cooking-oil'],
  ['extra virgin olive oil', 'cooking-oil'],
];

async function main() {
  const ingredients = SAMPLE.map(([name, category], i) => ({
    id: `i${i}`,
    name,
    aliases: [],
    category,
  }));
  const started = Date.now();
  const outcome = await findDuplicates(new Anthropic(), { ingredients });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (!outcome.ok) throw new Error(`${outcome.error}: ${outcome.message}`);
  const { input_tokens, output_tokens } = outcome.usage;
  const cost = (input_tokens * 4 + output_tokens * 20) / 1e6;
  console.log(
    `${DUPLICATES_MODEL}, ${seconds}s, ${input_tokens} in / ${output_tokens} out, ~$${cost.toFixed(3)}`
  );
  const name = (id: string) => ingredients.find((i) => i.id === id)?.name;
  for (const g of outcome.result.groups) {
    console.log(
      `${[g.keepId, ...g.mergeIds].map(name).join(' + ')}  →  "${g.name}" [${g.category}]  (${g.reason})`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
