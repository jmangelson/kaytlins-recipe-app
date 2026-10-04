import type { CategoryId } from '@/features/ingredients/categories';

export type StoreSection = {
  id: string;
  name: string;
  order: number;
  /** Grocery categories shelved in this area. */
  categoryIds: CategoryId[];
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

export type { Ingredient } from '@/features/ingredients/ingredient-model';
