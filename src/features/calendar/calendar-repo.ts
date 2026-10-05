import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';

import { type CalendarDay, type DateKey } from '@/features/calendar/calendar-model';
import { MEALS, type PlanItem } from '@/features/plans/meal-plan';
import { db } from '@/lib/firebase';
import { commitOrQueue } from '@/lib/firestore-write';

function daysCollection(householdId: string) {
  return collection(db, 'households', householdId, 'calendarDays');
}

function dayFromData(date: DateKey, data: Record<string, unknown>): CalendarDay {
  const meals = (data.meals ?? {}) as Record<string, PlanItem[]>;
  return {
    date,
    source: (data.source as CalendarDay['source']) ?? null,
    meals: {
      breakfast: meals.breakfast ?? [],
      lunch: meals.lunch ?? [],
      dinner: meals.dinner ?? [],
    },
  };
}

/** Days with meals between two dates (inclusive), keyed by date. */
export async function listCalendarDays(
  householdId: string,
  from: DateKey,
  to: DateKey
): Promise<Map<DateKey, CalendarDay>> {
  const snapshot = await getDocs(
    query(daysCollection(householdId), where('date', '>=', from), where('date', '<=', to))
  );
  return new Map(snapshot.docs.map((d) => [d.id, dayFromData(d.id, d.data())]));
}

/** Writes days in one batch (a day with no meals is removed). */
export async function saveCalendarDays(householdId: string, days: CalendarDay[]): Promise<void> {
  const batch = writeBatch(db);
  for (const day of days) {
    const ref = doc(daysCollection(householdId), day.date);
    const empty = MEALS.every((m) => day.meals[m.id].length === 0);
    if (empty) {
      batch.delete(ref);
    } else {
      batch.set(ref, {
        date: day.date,
        meals: Object.fromEntries(MEALS.map((m) => [m.id, day.meals[m.id]])),
        source: day.source,
        updatedAt: serverTimestamp(),
      });
    }
  }
  await commitOrQueue(() => batch.commit());
}
