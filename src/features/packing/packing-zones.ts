import type { CategoryId } from '@/features/ingredients/categories';

/**
 * Suggested packing categories, in the order to pack them: frozen cooler
 * items, then cold cooler items, then what can ride outside the cooler for
 * a while, then the dry bins from heavy and wet up to crushable.
 */
export const PACK_ZONES = [
  { id: 'freezer', name: 'Frozen cooler items', tip: 'Pack with ice; keep the lid shut.' },
  {
    id: 'cooler',
    name: 'Cold cooler items',
    tip: 'Raw meat and fish sealed on the bottom; eggs and soft things on top.',
  },
  {
    id: 'fridge',
    name: 'Fridge items, OK out of the cooler for a while',
    tip: 'In the cooler if there’s room.',
  },
  {
    id: 'heavy-wet',
    name: 'Heavy & liquid items',
    tip: 'Bottom of the bin; bag anything that could leak.',
  },
  { id: 'heavy-dry', name: 'Heavy dry items', tip: 'Cans, flour and sugar, potatoes and onions.' },
  { id: 'light-dry', name: 'Light dry items', tip: 'Boxes, spices, and snacks.' },
  { id: 'on-top', name: 'Crushable items', tip: 'Pack last, on top.' },
  { id: 'supplies', name: 'Supplies', tip: 'Paper goods, foil, and cleaning.' },
] as const;

export type PackZoneId = (typeof PACK_ZONES)[number]['id'];

const ZONE_OF: Record<CategoryId, PackZoneId> = {
  'produce-fruit': 'on-top',
  'produce-cold-fruit': 'fridge',
  'produce-greens': 'fridge',
  'produce-roots': 'heavy-dry',
  bakery: 'on-top',
  deli: 'cooler',
  bread: 'on-top',
  tortillas: 'on-top',
  pbj: 'fridge',
  'packaged-meat': 'cooler',
  cheese: 'cooler',
  'fresh-meat': 'cooler',
  'fresh-seafood': 'cooler',
  dairy: 'cooler',
  eggs: 'cooler',
  refrigerated: 'cooler',
  'beer-wine': 'heavy-wet',
  'energy-drinks': 'heavy-wet',
  'cold-drinks': 'heavy-wet',
  soda: 'heavy-wet',
  water: 'heavy-wet',
  juice: 'heavy-wet',
  'sports-drinks': 'heavy-wet',
  'coffee-tea': 'light-dry',
  seasonal: 'light-dry',
  candy: 'light-dry',
  'nuts-seeds': 'light-dry',
  jerky: 'light-dry',
  chips: 'on-top',
  'cookies-crackers': 'on-top',
  'fruit-snacks': 'light-dry',
  'granola-bars': 'light-dry',
  'pancake-syrup': 'heavy-wet',
  'cold-cereal': 'on-top',
  'hot-cereal': 'light-dry',
  'baking-chips': 'light-dry',
  'cooking-oil': 'heavy-wet',
  'flour-sugar': 'heavy-dry',
  'baking-mixes': 'light-dry',
  'canned-milk': 'heavy-dry',
  spices: 'light-dry',
  'gelatin-pudding': 'light-dry',
  marshmallows: 'on-top',
  'cooking-gadgets': 'supplies',
  soup: 'heavy-dry',
  'packaged-dinners': 'light-dry',
  'stuffing-potatoes': 'light-dry',
  'canned-vegetables': 'heavy-dry',
  'canned-fruit': 'heavy-dry',
  hispanic: 'light-dry',
  asian: 'heavy-wet',
  'rice-grains': 'heavy-dry',
  beans: 'heavy-dry',
  'canned-meat': 'heavy-dry',
  'gluten-free': 'light-dry',
  pasta: 'light-dry',
  'pasta-sauce': 'heavy-wet',
  condiments: 'fridge',
  'salad-dressing': 'fridge',
  'frozen-meat': 'freezer',
  'frozen-seafood': 'freezer',
  'frozen-vegetables': 'freezer',
  'frozen-potatoes': 'freezer',
  'frozen-meals': 'freezer',
  'frozen-breakfast': 'freezer',
  'frozen-pizza': 'freezer',
  'ice-cream': 'freezer',
  picnic: 'supplies',
  'food-storage': 'supplies',
  'trash-bags': 'supplies',
  cleaning: 'supplies',
  laundry: 'supplies',
  'paper-towels': 'supplies',
  pet: 'supplies',
  automotive: 'supplies',
  baby: 'supplies',
  'school-supplies': 'supplies',
  'health-beauty': 'supplies',
  medicine: 'supplies',
  uncategorized: 'light-dry',
};

/** Where a kind of food usually travels. */
export function zoneForCategory(category: CategoryId): PackZoneId {
  return ZONE_OF[category] ?? 'light-dry';
}

export function zoneName(id: PackZoneId): string {
  return PACK_ZONES.find((z) => z.id === id)?.name ?? id;
}
