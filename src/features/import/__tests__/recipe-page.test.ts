import { pageToScanResult } from '@/features/import/import-service';
import {
  normalizeUrl,
  recipeDataText,
  pageText,
  recipeFromHtml,
  servingsFrom,
} from '@/features/import/recipe-page';

jest.mock('@react-native-firebase/auth', () => ({ getIdToken: jest.fn() }));
jest.mock('@/lib/firebase', () => ({ auth: {}, usingFirebaseEmulators: true }));

const page = (jsonLd: unknown) => `<!doctype html><html><head>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head><body><h1>Ignore me</h1></body></html>`;

describe('recipeFromHtml', () => {
  it('reads a Recipe inside @graph, with sectioned steps and entities', () => {
    const recipe = recipeFromHtml(
      page({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebPage', name: 'Blog' },
          {
            '@type': ['Recipe'],
            name: 'Mom&#39;s Chili',
            recipeYield: ['6', '6 servings'],
            recipeIngredient: [
              '2 lbs ground beef',
              '1 (15 oz) can kidney beans',
              '1 &frac12; cups onion',
            ],
            recipeInstructions: [
              {
                '@type': 'HowToSection',
                name: 'Cook',
                itemListElement: [
                  { '@type': 'HowToStep', text: 'Brown the <b>beef</b>.' },
                  { '@type': 'HowToStep', text: 'Add the rest.' },
                ],
              },
            ],
          },
        ],
      })
    );
    expect(recipe).toEqual({
      title: "Mom's Chili",
      servings: 6,
      ingredients: ['2 lbs ground beef', '1 (15 oz) can kidney beans', '1 ½ cups onion'],
      hints: [],
    });
  });

  it('returns null for a page without recipe data', () => {
    expect(recipeFromHtml('<html><body><p>Hello</p></body></html>')).toBeNull();
    expect(
      recipeFromHtml(page({ '@type': 'Recipe', name: 'Empty', recipeIngredient: [] }))
    ).toBeNull();
  });

  it('skips broken JSON-LD and keeps looking', () => {
    const html = `<script type="application/ld+json">{oops</script>${page({
      '@type': 'Recipe',
      name: 'Toast',
      recipeIngredient: ['2 slices bread'],
    })}`;
    expect(recipeFromHtml(html)?.title).toBe('Toast');
  });
});

describe('page helpers', () => {
  it('normalizes links', () => {
    expect(normalizeUrl('allrecipes.com/recipe/1')).toBe('https://allrecipes.com/recipe/1');
    expect(normalizeUrl(' http://x.org/a ')).toBe('http://x.org/a');
    expect(normalizeUrl('not a link')).toBeNull();
    expect(normalizeUrl('ftp://x.org')).toBeNull();
  });

  it('reads servings', () => {
    expect(servingsFrom('Serves 4-6')).toBe(4);
    expect(servingsFrom(8)).toBe(8);
    expect(servingsFrom(undefined)).toBeNull();
  });

  it('takes the readable text of a page', () => {
    const text = pageText('<script>var x=1</script><style>p{}</style><p>Mix &amp; bake</p>');
    expect(text).toBe('Mix & bake');
  });
});

describe('pageToScanResult', () => {
  it('parses each line into amount, unit, name, and note', () => {
    const result = pageToScanResult({
      title: 'Chili',
      servings: null,
      ingredients: ['2 lbs ground beef', '1 large onion, diced'],
    });
    expect(result.ingredients[0]).toMatchObject({ quantity: 2, unit: 'lb', name: 'ground beef' });
    expect(result.ingredients[1]).toMatchObject({ quantity: 1, name: 'onion' });
    expect(result.notes).toBeNull();
  });
});

describe('recipeDataText', () => {
  it('gives Claude the title, servings, site keywords, and lines', () => {
    const recipe = recipeFromHtml(
      page({
        '@type': 'Recipe',
        name: 'Chili',
        recipeYield: '6',
        recipeCategory: 'Dinner',
        recipeCuisine: ['Mexican'],
        keywords: 'beef, chili, easy',
        recipeIngredient: ['1 lb ground beef (85% lean)', '3 cloves garlic minced'],
      })
    )!;
    expect(recipe.hints).toEqual(['Dinner', 'Mexican', 'beef', 'chili', 'easy']);
    expect(recipeDataText(recipe)).toBe(
      [
        'Title: Chili',
        'Serves: 6',
        "Site's categories and keywords: Dinner, Mexican, beef, chili, easy",
        'Ingredients:',
        '- 1 lb ground beef (85% lean)',
        '- 3 cloves garlic minced',
      ].join('\n')
    );
  });
});
