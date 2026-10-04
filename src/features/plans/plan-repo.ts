import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';

import {
  emptyPlanDays,
  MEALS,
  type MealPlan,
  type PlanDay,
  type PlanItem,
} from '@/features/plans/meal-plan';
import { db } from '@/lib/firebase';
import { commitOrQueue } from '@/lib/firestore-write';

function plansCollection(householdId: string) {
  return collection(db, 'households', householdId, 'mealPlans');
}

function dayFromData(data: unknown): PlanDay {
  const meals = ((data as { meals?: Record<string, PlanItem[]> })?.meals ?? {}) as Record<
    string,
    PlanItem[]
  >;
  return {
    meals: {
      breakfast: meals.breakfast ?? [],
      lunch: meals.lunch ?? [],
      dinner: meals.dinner ?? [],
    },
  };
}

function planFromData(id: string, data: Record<string, unknown>): MealPlan {
  const days = Array.isArray(data.days) ? data.days.map(dayFromData) : [];
  return { id, name: (data.name as string) ?? 'Plan', days: days.length ? days : emptyPlanDays(1) };
}

function daysToData(days: PlanDay[]) {
  return days.map((day) => ({
    meals: Object.fromEntries(MEALS.map((m) => [m.id, day.meals[m.id]])),
  }));
}

export async function listPlans(householdId: string): Promise<MealPlan[]> {
  const snapshot = await getDocs(plansCollection(householdId));
  return snapshot.docs
    .map((d) => planFromData(d.id, d.data()))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export async function getPlan(householdId: string, planId: string): Promise<MealPlan | null> {
  const snapshot = await getDoc(doc(plansCollection(householdId), planId));
  const data = snapshot.data();
  return data ? planFromData(snapshot.id, data) : null;
}

/** Creates a plan and returns its id (works offline: the id is made on the phone). */
export async function createPlan(
  householdId: string,
  name: string,
  days: PlanDay[]
): Promise<string> {
  const ref = doc(plansCollection(householdId));
  await commitOrQueue(() =>
    setDoc(ref, {
      name: name.trim(),
      days: daysToData(days),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  return ref.id;
}

/** Saves a plan's name and days. */
export async function savePlan(householdId: string, plan: MealPlan): Promise<void> {
  await commitOrQueue(() =>
    updateDoc(doc(plansCollection(householdId), plan.id), {
      name: plan.name.trim(),
      days: daysToData(plan.days),
      updatedAt: serverTimestamp(),
    })
  );
}

export async function deletePlan(householdId: string, planId: string): Promise<void> {
  await commitOrQueue(() => deleteDoc(doc(plansCollection(householdId), planId)));
}
