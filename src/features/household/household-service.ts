import {
  arrayUnion,
  collection,
  doc,
  getDoc,
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
      return;
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
