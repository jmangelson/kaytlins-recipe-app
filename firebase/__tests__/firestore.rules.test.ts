import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HID = 'household-1';
const CODE = 'ABCD2345';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kaytlins-recipes',
    firestore: { rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

function dbAs(uid: string) {
  return env.authenticatedContext(uid).firestore();
}

/** Seeds a household owned by `alice` (bypassing rules). */
async function seedHousehold() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'households', HID), {
      name: 'Home',
      memberIds: ['alice'],
      inviteCode: CODE,
      createdAt: new Date(),
      settings: { weekStart: 0, showBreakfastLunch: true },
    });
    await setDoc(doc(db, 'invites', CODE), {
      householdId: HID,
      createdBy: 'alice',
      createdAt: new Date(),
    });
    await setDoc(doc(db, 'users', 'alice'), { householdId: HID });
    await setDoc(doc(db, 'households', HID, 'recipes', 'r1'), { name: 'Tacos' });
  });
}

function createHouseholdBatch(uid: string, hid: string, code: string) {
  const db = dbAs(uid);
  const batch = writeBatch(db);
  batch.set(doc(db, 'households', hid), {
    name: 'Home',
    memberIds: [uid],
    inviteCode: code,
    createdAt: serverTimestamp(),
    settings: { weekStart: 0, showBreakfastLunch: true },
  });
  batch.set(doc(db, 'invites', code), {
    householdId: hid,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'users', uid), { householdId: hid });
  return batch;
}

function joinBatch(uid: string, hid: string) {
  const db = dbAs(uid);
  const batch = writeBatch(db);
  batch.update(doc(db, 'households', hid), { memberIds: arrayUnion(uid) });
  batch.set(doc(db, 'users', uid), { householdId: hid });
  return batch;
}

describe('creating a household', () => {
  it('lets a signed-in user create a household with an invite and profile', async () => {
    await assertSucceeds(createHouseholdBatch('alice', HID, CODE).commit());
  });

  it('rejects signed-out users', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(db, 'households', HID), {
        name: 'Home',
        memberIds: [],
        inviteCode: CODE,
        createdAt: serverTimestamp(),
        settings: {},
      })
    );
  });

  it('rejects adding other people as members', async () => {
    const db = dbAs('alice');
    await assertFails(
      setDoc(doc(db, 'households', HID), {
        name: 'Home',
        memberIds: ['alice', 'mallory'],
        inviteCode: CODE,
        createdAt: serverTimestamp(),
        settings: { weekStart: 0, showBreakfastLunch: true },
      })
    );
  });

  it('rejects an invite code that is already taken', async () => {
    await seedHousehold();
    await assertFails(createHouseholdBatch('bob', 'household-2', CODE).commit());
  });
});

describe('joining a household', () => {
  beforeEach(seedHousehold);

  it('lets a user with the invite code look up the household and join', async () => {
    const invite = await assertSucceeds(getDoc(doc(dbAs('bob'), 'invites', CODE)));
    expect(invite.data()?.householdId).toBe(HID);

    await assertSucceeds(joinBatch('bob', HID).commit());
    await assertSucceeds(getDoc(doc(dbAs('bob'), 'households', HID, 'recipes', 'r1')));
  });

  it('does not allow listing invite codes', async () => {
    await assertFails(getDocs(collection(dbAs('bob'), 'invites')));
  });

  it('does not let a joiner add anyone but themselves', async () => {
    await assertFails(
      updateDoc(doc(dbAs('bob'), 'households', HID), {
        memberIds: ['alice', 'bob', 'mallory'],
      })
    );
  });

  it('does not let a joiner change other household fields', async () => {
    await assertFails(
      updateDoc(doc(dbAs('bob'), 'households', HID), {
        memberIds: arrayUnion('bob'),
        name: 'Mine now',
      })
    );
  });

  it('does not let a user point their profile at a household they are not in', async () => {
    await assertFails(setDoc(doc(dbAs('bob'), 'users', 'bob'), { householdId: HID }));
  });
});

describe('household data access', () => {
  beforeEach(seedHousehold);

  it('lets members read and write household data', async () => {
    const db = dbAs('alice');
    await assertSucceeds(getDoc(doc(db, 'households', HID)));
    await assertSucceeds(
      setDoc(doc(db, 'households', HID, 'shoppingLists', 'l1'), { name: 'This week' })
    );
  });

  it('blocks non-members from household data', async () => {
    const db = dbAs('mallory');
    await assertFails(getDoc(doc(db, 'households', HID)));
    await assertFails(getDoc(doc(db, 'households', HID, 'recipes', 'r1')));
    await assertFails(setDoc(doc(db, 'households', HID, 'recipes', 'r2'), { name: 'x' }));
  });

  it('lets members rename and change settings but not the member list', async () => {
    const db = dbAs('alice');
    await assertSucceeds(
      updateDoc(doc(db, 'households', HID), { name: 'The Mangelsons', 'settings.weekStart': 1 })
    );
    await assertFails(updateDoc(doc(db, 'households', HID), { memberIds: ['alice', 'mallory'] }));
    await assertFails(updateDoc(doc(db, 'households', HID), { inviteCode: 'NEWCODE1' }));
  });

  it('rejects invalid settings', async () => {
    await assertFails(
      updateDoc(doc(dbAs('alice'), 'households', HID), { 'settings.weekStart': 9 })
    );
  });

  it('only lets users read their own profile', async () => {
    await assertSucceeds(getDoc(doc(dbAs('alice'), 'users', 'alice')));
    await assertFails(getDoc(doc(dbAs('bob'), 'users', 'alice')));
  });
});

describe('stores, tags, and ingredients', () => {
  beforeEach(seedHousehold);

  const validStore = {
    name: "Macey's",
    order: 0,
    hidden: false,
    sections: [{ id: 'produce', name: 'Produce', order: 0 }],
  };

  it('lets a member write the starter data and mark the household seeded in one batch', async () => {
    const db = dbAs('alice');
    const batch = writeBatch(db);
    batch.set(doc(db, 'households', HID, 'stores', 'maceys'), validStore);
    batch.set(doc(db, 'households', HID, 'tags', 'beef'), {
      name: 'Beef',
      order: 0,
      group: 'type',
    });
    batch.update(doc(db, 'households', HID), { seedVersion: 1 });
    await assertSucceeds(batch.commit());
  });

  it('rejects a non-integer seed version', async () => {
    await assertFails(updateDoc(doc(dbAs('alice'), 'households', HID), { seedVersion: 'one' }));
  });

  it('rejects malformed stores and tags', async () => {
    const db = dbAs('alice');
    await assertFails(
      setDoc(doc(db, 'households', HID, 'stores', 's1'), { ...validStore, name: '' })
    );
    await assertFails(
      setDoc(doc(db, 'households', HID, 'stores', 's1'), { ...validStore, extra: true })
    );
    await assertFails(setDoc(doc(db, 'households', HID, 'tags', 't1'), { name: 'Beef' }));
    await assertFails(
      setDoc(doc(db, 'households', HID, 'tags', 't1'), { name: 'Beef', order: 0, group: 'cuisine' })
    );
  });

  it('validates ingredients', async () => {
    const db = dbAs('alice');
    const ingredient = {
      name: 'Yellow onion',
      nameKey: 'yellow onion',
      aliases: ['onion'],
      aliasKeys: ['onion'],
      category: 'produce',
      storePriority: ['costco', 'maceys'],
      areaOverrides: { costco: 'produce' },
      defaultUnit: null,
    };
    await assertSucceeds(setDoc(doc(db, 'households', HID, 'ingredients', 'i1'), ingredient));
    await assertFails(
      setDoc(doc(db, 'households', HID, 'ingredients', 'i2'), { ...ingredient, aliasKeys: [] })
    );
    await assertFails(
      setDoc(doc(db, 'households', HID, 'ingredients', 'i3'), { ...ingredient, storeId: 'x' })
    );
  });

  it('blocks non-members from stores, tags, and ingredients', async () => {
    const db = dbAs('mallory');
    await assertFails(getDocs(collection(db, 'households', HID, 'stores')));
    await assertFails(setDoc(doc(db, 'households', HID, 'stores', 'x'), validStore));
    await assertFails(
      setDoc(doc(db, 'households', HID, 'tags', 'x'), { name: 'X', order: 0, group: 'type' })
    );
  });
});

describe('recipes and recipe photos', () => {
  beforeEach(seedHousehold);

  const recipe = {
    name: 'Tacos',
    servings: 4,
    tagIds: ['beef'],
    notes: '',
    hasPhoto: false,
    ingredients: [{ ingredientId: 'i1', name: 'ground beef', raw: '1 lb ground beef' }],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  it('lets members save a recipe with a new ingredient and a photo in one batch', async () => {
    const db = dbAs('alice');
    const batch = writeBatch(db);
    batch.set(doc(db, 'households', HID, 'ingredients', 'i1'), {
      name: 'Ground beef',
      nameKey: 'ground beef',
      aliases: [],
      aliasKeys: [],
      category: 'meat-seafood',
      storePriority: [],
      areaOverrides: {},
      defaultUnit: null,
    });
    batch.set(doc(db, 'households', HID, 'recipes', 'r2'), { ...recipe, hasPhoto: true });
    batch.set(doc(db, 'households', HID, 'recipePhotos', 'r2'), { jpegBase64: 'abc' });
    await assertSucceeds(batch.commit());
  });

  it('lets members update and delete recipes', async () => {
    const db = dbAs('alice');
    await assertSucceeds(setDoc(doc(db, 'households', HID, 'recipes', 'r2'), recipe));
    await assertSucceeds(
      updateDoc(doc(db, 'households', HID, 'recipes', 'r2'), {
        name: 'Street tacos',
        updatedAt: serverTimestamp(),
      })
    );
    await assertSucceeds(deleteDoc(doc(db, 'households', HID, 'recipes', 'r2')));
  });

  it('rejects malformed recipes', async () => {
    const db = dbAs('alice');
    const ref = doc(db, 'households', HID, 'recipes', 'r2');
    await assertFails(setDoc(ref, { ...recipe, name: '' }));
    await assertFails(setDoc(ref, { ...recipe, servings: 0 }));
    await assertFails(setDoc(ref, { ...recipe, owner: 'mallory' }));
    await assertFails(setDoc(ref, { ...recipe, updatedAt: new Date(2000, 0, 1) }));
  });

  it('rejects oversized photos', async () => {
    await assertFails(
      setDoc(doc(dbAs('alice'), 'households', HID, 'recipePhotos', 'r2'), {
        jpegBase64: 'x'.repeat(700001),
      })
    );
  });

  it('blocks non-members from recipes and photos', async () => {
    const db = dbAs('mallory');
    await assertFails(getDoc(doc(db, 'households', HID, 'recipes', 'r1')));
    await assertFails(setDoc(doc(db, 'households', HID, 'recipes', 'r9'), recipe));
    await assertFails(getDoc(doc(db, 'households', HID, 'recipePhotos', 'r1')));
  });
});

describe('meal plans', () => {
  beforeEach(seedHousehold);

  const day = { meals: { breakfast: [], lunch: [], dinner: [{ recipeId: 'r1', servings: null }] } };
  const plan = {
    name: 'Week A',
    days: [day, day],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  it('lets members save, rename, and delete plans', async () => {
    const db = dbAs('alice');
    const ref = doc(db, 'households', HID, 'mealPlans', 'p1');
    await assertSucceeds(setDoc(ref, plan));
    await assertSucceeds(updateDoc(ref, { name: 'Week B', updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(ref));
  });

  it('rejects malformed plans', async () => {
    const ref = doc(dbAs('alice'), 'households', HID, 'mealPlans', 'p1');
    await assertFails(setDoc(ref, { ...plan, name: '' }));
    await assertFails(setDoc(ref, { ...plan, days: [] }));
    await assertFails(setDoc(ref, { ...plan, owner: 'x' }));
  });

  it('blocks non-members', async () => {
    await assertFails(setDoc(doc(dbAs('mallory'), 'households', HID, 'mealPlans', 'p1'), plan));
  });
});
