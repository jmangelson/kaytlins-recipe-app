import type { ScanResult } from '@/features/scan/scan-contract';

/**
 * What the scan returns in emulator test builds (no paid API calls): a
 * small recipe with a general name that asks, a hard-to-read line, and a
 * warning, so tests and screenshots see every case.
 */
export const FIXTURE_SCAN: ScanResult = {
  title: 'Lemon Bars',
  servings: 16,
  suggested_tag_ids: ['vegetarian', 'dessert'],
  ingredients: [
    {
      quantity: 1,
      quantity_max: null,
      unit: 'cup',
      name: 'butter',
      note: 'softened',
      source_text: '1 c. butter, softened',
      confidence: 'high',
    },
    {
      quantity: 2,
      quantity_max: null,
      unit: 'cup',
      name: 'all-purpose flour',
      note: null,
      source_text: '2 c. all-purpose flour',
      confidence: 'high',
    },
    {
      quantity: 1.5,
      quantity_max: null,
      unit: 'cup',
      name: 'sugar',
      note: null,
      source_text: '1 1/2 c. sugar',
      confidence: 'high',
    },
    {
      quantity: 4,
      quantity_max: null,
      unit: null,
      name: 'eggs',
      note: null,
      source_text: '4 eggs',
      confidence: 'high',
    },
    {
      quantity: 0.333,
      quantity_max: null,
      unit: 'cup',
      name: 'lemon juice',
      note: null,
      source_text: '1/3 c. lemon ju…',
      confidence: 'low',
    },
  ],
  notes: 'Grandma’s card',
  warnings: ['The right edge of the card is cut off.'],
};
