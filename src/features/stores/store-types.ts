import type { CategoryId } from '@/features/ingredients/categories';
import type { TagGroupId } from '@/features/stores/tag-groups';

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
  /** Position within its group. */
  order: number;
  group: TagGroupId;
};

export type { Ingredient } from '@/features/ingredients/ingredient-model';
