import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  updateDoc,
  serverTimestamp,
  writeBatch,
} from '@react-native-firebase/firestore';
import { getRandomBytes } from 'expo-crypto';

import { SEED_STORES, SEED_TAGS, SEED_VERSION } from '@/features/household/seed-data';
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
  SEED_TAGS.forEach((tag, order) => {
    batch.set(doc(db, 'households', householdId, 'tags', tag.id), { name: tag.name, order });
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
  else if (serverSeedVersion < SEED_VERSION) await upgradeSeed(householdId);
}

/**
 * Version 1 → 2: gives the starter areas their grocery categories. Only areas
 * that still have their starter id and no categories are touched, so names,
 * order, hidden stores, and her own areas stay as she left them.
 */
async function upgradeSeed(householdId: string): Promise<void> {
  const stores = await getDocs(collection(db, 'households', householdId, 'stores'));
  const batch = writeBatch(db);
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
