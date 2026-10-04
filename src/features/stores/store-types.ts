export type StoreSection = {
  id: string;
  name: string;
  order: number;
};

export type Store = {
  id: string;
  name: string;
  order: number;
  hidden: boolean;
  sections: StoreSection[];
};

export type Tag = {
  id: string;
  name: string;
  order: number;
};

export type Ingredient = {
  id: string;
  name: string;
  /** Matching key from ingredientNameKey(): "Yellow Onions" → "yellow onion". */
  nameKey: string;
  defaultUnit: string | null;
  storeId: string | null;
  sectionId: string | null;
};
