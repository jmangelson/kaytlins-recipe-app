import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  updateDoc,
  serverTimestamp,
  writeBatch,
} from '@react-native-firebase/firestore';
import { getRandomBytes } from 'expo-crypto';

import {
  isUneditedSeed,
  SEED_STORES,
  SEED_TAGS,
  SEED_VERSION,
  seedTagOrder,
  V3_SECTIONS,
} from '@/features/household/seed-data';
import { upgradeCategoryIds } from '@/features/ingredients/categories';
import {
  generateInviteCode,
  isValidInviteCode,
  normalizeInviteCode,
} from '@/features/household/invite-code';
import { db } from '@/lib/firebase';
import { commitOrQueue } from '@/lib/firestore-write';

export type HouseholdSettings = {
  /** 0 = Sunday … 6 = Saturday. */
  weekStart: number;
  showBreakfastLunch: boolean;
};

export type Household = {
  id: string;
  name: string;
  memberIds: string[];
  inviteCode: string;
  settings: HouseholdSettings;
  /** Which version of the starter stores/tags has been written (0 = none). */
  seedVersion: number;
};

export const DEFAULT_HOUSEHOLD_SETTINGS: HouseholdSettings = {
  weekStart: 0,
  showBreakfastLunch: true,
};

export class InviteNotFoundError extends Error {
  constructor() {
    super("That invite code wasn't found. Check it and try again.");
  }
}

/** Returns the household the user belongs to, or null if they haven't set one up. */
export async function loadUserHousehold(uid: string): Promise<Household | null> {
  const profile = await getDoc(doc(db, 'users', uid));
  const householdId = profile.data()?.householdId as string | undefined;
  if (!householdId) return null;

  const snapshot = await getDoc(doc(db, 'households', householdId));
  const data = snapshot.data();
  if (!data || !(data.memberIds as string[]).includes(uid)) return null;

  return {
    id: snapshot.id,
    name: data.name,
    memberIds: data.memberIds,
    inviteCode: data.inviteCode,
    settings: { ...DEFAULT_HOUSEHOLD_SETTINGS, ...data.settings },
    seedVersion: data.seedVersion ?? 0,
  };
}

/**
 * Creates a household with the user as its only member, plus its invite code
 * and the user's profile, in one batch. Retries if the random code is taken.
 */
export async function createHousehold(uid: string, name: string): Promise<void> {
  const householdId = await createEmptyHousehold(uid, name);
  // Seed before the app opens so every screen sees the starter stores and tags.
  await seedHousehold(householdId);
}

async function createEmptyHousehold(uid: string, name: string): Promise<string> {
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; ; attempt++) {
    const code = generateInviteCode(getRandomBytes);
    const householdRef = doc(collection(db, 'households'));
    const batch = writeBatch(db);
    batch.set(householdRef, {
      name: name.trim(),
      memberIds: [uid],
      inviteCode: code,
      createdAt: serverTimestamp(),
      settings: DEFAULT_HOUSEHOLD_SETTINGS,
    });
    batch.set(doc(db, 'invites', code), {
      householdId: householdRef.id,
      createdBy: uid,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', uid), { householdId: householdRef.id });
    try {
      await batch.commit();
      return householdRef.id;
    } catch (error) {
      // A taken invite code surfaces as permission-denied (invites can't be overwritten).
      if (attempt >= MAX_ATTEMPTS) throw error;
    }
  }
}

/** Joins the household that owns the invite code. */
export async function joinHousehold(uid: string, typedCode: string): Promise<void> {
  const code = normalizeInviteCode(typedCode);
  if (!isValidInviteCode(code)) throw new InviteNotFoundError();

  const invite = await getDoc(doc(db, 'invites', code));
  const householdId = invite.data()?.householdId as string | undefined;
  if (!householdId) throw new InviteNotFoundError();

  const batch = writeBatch(db);
  batch.update(doc(db, 'households', householdId), { memberIds: arrayUnion(uid) });
  batch.set(doc(db, 'users', uid), { householdId });
  await batch.commit();
}

/**
 * Writes the starter stores, store areas, and tags once per household. Ids are
 * fixed, so two phones seeding at the same time write identical documents.
 * The returned promise resolves when the server confirms; the writes show up
 * locally right away, including offline.
 */
export async function seedHousehold(householdId: string): Promise<void> {
  const batch = writeBatch(db);
  SEED_STORES.forEach((store, order) => {
    batch.set(doc(db, 'households', householdId, 'stores', store.id), {
      name: store.name,
      order,
      hidden: false,
      sections: store.sections.map((section, sectionOrder) => ({
        ...section,
        order: sectionOrder,
      })),
    });
  });
  SEED_TAGS.forEach((tag) => {
    batch.set(doc(db, 'households', householdId, 'tags', tag.id), {
      name: tag.name,
      order: seedTagOrder(tag),
      group: tag.group,
    });
  });
  batch.update(doc(db, 'households', householdId), { seedVersion: SEED_VERSION });
  await batch.commit();
}

export function needsSeeding(household: Household): boolean {
  return household.seedVersion < SEED_VERSION;
}

/**
 * Seeds only after the server confirms the household hasn't been seeded, so a
 * phone with a stale offline copy can't overwrite stores someone has since
 * edited. Offline, this does nothing and tries again on a later launch.
 */
export async function seedHouseholdIfNeeded(householdId: string): Promise<void> {
  let serverSeedVersion: number;
  try {
    const snapshot = await getDocFromServer(doc(db, 'households', householdId));
    serverSeedVersion = (snapshot.data()?.seedVersion as number | undefined) ?? 0;
  } catch {
    return;
  }
  if (serverSeedVersion === 0) await seedHousehold(householdId);
  else if (serverSeedVersion < SEED_VERSION) await upgradeSeed(householdId, serverSeedVersion);
}

/**
 * Brings an older household up to the current starter data without undoing
 * her edits:
 * - to 2: starter areas (still with their starter id and no categories) get
 *   their grocery categories;
 * - to 3: her existing tags become Type tags, and the Course and Meal starter
 *   tags she doesn't have yet are added.
 * - to 4: starter stores she never edited get the new, more specific aisles;
 *   any other store keeps her areas, with the old "Pantry & Canned" and
 *   "Baking & Spices" categories expanded to the new ones.
 */
async function upgradeSeed(householdId: string, fromVersion: number): Promise<void> {
  const batch = writeBatch(db);
  if (fromVersion < 3) {
    const tags = await getDocs(collection(db, 'households', householdId, 'tags'));
    const existing = new Set(tags.docs.map((t) => t.id));
    for (const tag of tags.docs) {
      if (!tag.data().group) batch.update(tag.ref, { group: 'type' });
    }
    for (const tag of SEED_TAGS.filter((t) => t.group !== 'type' && !existing.has(t.id))) {
      batch.set(doc(db, 'households', householdId, 'tags', tag.id), {
        name: tag.name,
        order: seedTagOrder(tag),
        group: tag.group,
      });
    }
  }
  const stores =
    fromVersion < 2
      ? await getDocs(collection(db, 'households', householdId, 'stores'))
      : { docs: [] };
  for (const store of stores.docs) {
    const seed = SEED_STORES.find((s) => s.id === store.id);
    if (!seed) continue;
    const sections = (store.data().sections ?? []) as {
      id: string;
      categoryIds?: string[];
    }[];
    batch.update(store.ref, {
      sections: sections.map((section) => {
        const seeded = seed.sections.find((s) => s.id === section.id);
        return seeded && !section.categoryIds?.length
          ? { ...section, categoryIds: seeded.categoryIds }
          : { ...section, categoryIds: section.categoryIds ?? [] };
      }),
    });
  }
  if (fromVersion < 4) {
    // Runs after the to-2 pass above, so v1 areas already have categories.
    const all = await getDocs(collection(db, 'households', householdId, 'stores'));
    for (const store of all.docs) {
      const sections = (store.data().sections ?? []) as {
        id: string;
        name: string;
        order: number;
        categoryIds?: string[];
      }[];
      const seed = SEED_STORES.find((s) => s.id === store.id);
      const legacy = V3_SECTIONS[store.id];
      batch.update(store.ref, {
        sections:
          seed && legacy && isUneditedSeed(sections, legacy)
            ? seed.sections.map((s, order) => ({ ...s, order }))
            : sections.map((s) => ({ ...s, categoryIds: upgradeCategoryIds(s.categoryIds ?? []) })),
      });
    }
  }
  batch.update(doc(db, 'households', householdId), { seedVersion: SEED_VERSION });
  await batch.commit();
}

/** Renames the household and/or changes its settings. */
export async function updateHousehold(
  householdId: string,
  changes: { name: string; settings: HouseholdSettings }
): Promise<void> {
  await commitOrQueue(() =>
    updateDoc(doc(db, 'households', householdId), {
      name: changes.name.trim(),
      settings: changes.settings,
    })
  );
}

/** Every collection a household's data lives in (see firestore.rules). */
const HOUSEHOLD_COLLECTIONS = [
  'stores',
  'tags',
  'ingredients',
  'recipes',
  'recipePhotos',
  'mealPlans',
  'calendarDays',
  'shoppingLists',
  'extraItems',
];

export class OfflineError extends Error {
  constructor() {
    super('Connect to the internet and try again.');
  }
}

/**
 * Leaves a household others still use: her id comes off its members and her
 * profile stops pointing at it, so the app goes back to household setup
 * (create a new one, or join with a code). Its data stays with the others.
 */
export async function leaveHousehold(uid: string, household: Household): Promise<void> {
  if (household.memberIds.length <= 1) {
    throw new Error('You’re the only member. Delete the household instead.');
  }
  const batch = writeBatch(db);
  batch.update(doc(db, 'households', household.id), { memberIds: arrayRemove(uid) });
  batch.delete(doc(db, 'users', uid));
  await batch.commit();
}

/**
 * Permanently deletes a household she is the only member of: all its
 * recipes, plans, calendar, lists, stores and tags, its invite code, the
 * household, and her link to it. Needs a connection, so nothing is left
 * half-deleted on another phone's cache.
 */
export async function deleteHousehold(uid: string, household: Household): Promise<void> {
  if (household.memberIds.length !== 1 || household.memberIds[0] !== uid) {
    throw new Error('Only the last member can delete a household. Leave it instead.');
  }
  for (const name of HOUSEHOLD_COLLECTIONS) {
    let snapshot;
    try {
      snapshot = await getDocsFromServer(collection(db, 'households', household.id, name));
    } catch {
      throw new OfflineError();
    }
    // Batches hold up to 500 writes.
    for (let i = 0; i < snapshot.docs.length; i += 400) {
      const batch = writeBatch(db);
      snapshot.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  const batch = writeBatch(db);
  batch.delete(doc(db, 'invites', household.inviteCode));
  batch.delete(doc(db, 'households', household.id));
  batch.delete(doc(db, 'users', uid));
  await batch.commit();
}
