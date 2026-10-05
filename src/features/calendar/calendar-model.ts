import {
  emptyDay,
  itemCount,
  MEALS,
  type MealPlan,
  type PlanDay,
} from '@/features/plans/meal-plan';

/** A calendar date as stored: "2026-10-05" (her local date). */
export type DateKey = string;

/** Meals on a real date, remembering which plan day it came from (if any). */
export type CalendarDay = PlanDay & {
  date: DateKey;
  source: { planId: string; planName: string; dayIndex: number } | null;
};

export function toDateKey(date: Date): DateKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** First day of the week containing `key` (weekStart: 0 = Sunday … 6). */
export function startOfWeek(key: DateKey, weekStart: number): DateKey {
  const offset = (fromDateKey(key).getDay() - weekStart + 7) % 7;
  return addDays(key, -offset);
}

export function weekDates(start: DateKey): DateKey[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sun, Oct 5" */
export function formatDay(key: DateKey): string {
  const date = fromDateKey(key);
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** "Oct 5 – 11", "Sep 28 – Oct 4", "Dec 28 – Jan 3, 2027" */
export function formatRange(start: DateKey, end: DateKey): string {
  const a = fromDateKey(start);
  const b = fromDateKey(end);
  const left = `${MONTHS[a.getMonth()]} ${a.getDate()}`;
  const right =
    a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
      ? `${b.getDate()}`
      : `${MONTHS[b.getMonth()]} ${b.getDate()}`;
  const year = a.getFullYear() !== b.getFullYear() ? `, ${b.getFullYear()}` : '';
  return `${left} – ${right}${year}`;
}

export function emptyCalendarDay(date: DateKey): CalendarDay {
  return { ...emptyDay(), date, source: null };
}

export function hasMeals(day: PlanDay | undefined): boolean {
  return !!day && itemCount({ days: [day] }) > 0;
}

export type ConflictMode = 'replace' | 'add' | 'skip';

/** The dates a plan covers when started on `start` and repeated `times`. */
export function datesForPlan(
  plan: Pick<MealPlan, 'days'>,
  start: DateKey,
  times: number
): DateKey[] {
  return Array.from({ length: plan.days.length * times }, (_, i) => addDays(start, i));
}

/** Dates in the range that already have meals. */
export function conflicts(
  plan: Pick<MealPlan, 'days'>,
  start: DateKey,
  times: number,
  existing: Map<DateKey, CalendarDay>
): DateKey[] {
  return datesForPlan(plan, start, times).filter((d) => hasMeals(existing.get(d)));
}

/**
 * Days to write when putting a plan on the calendar: plan day i lands on
 * start + i, cycling through the plan `times` times. Dates that already have
 * meals are replaced, added to, or skipped. Each written day is a copy that
 * remembers its plan day, so editing it later doesn't change the plan.
 */
export function applyPlan(
  plan: MealPlan,
  start: DateKey,
  times: number,
  existing: Map<DateKey, CalendarDay>,
  mode: ConflictMode
): CalendarDay[] {
  const writes: CalendarDay[] = [];
  datesForPlan(plan, start, times).forEach((date, i) => {
    const dayIndex = i % plan.days.length;
    const planDay = plan.days[dayIndex];
    const current = existing.get(date);
    const source = { planId: plan.id, planName: plan.name, dayIndex };
    if (!hasMeals(current) || mode === 'replace') {
      writes.push({
        date,
        source,
        meals: {
          breakfast: [...planDay.meals.breakfast],
          lunch: [...planDay.meals.lunch],
          dinner: [...planDay.meals.dinner],
        },
      });
    } else if (mode === 'add') {
      writes.push({
        ...current!,
        meals: Object.fromEntries(
          MEALS.map((m) => [m.id, [...current!.meals[m.id], ...planDay.meals[m.id]]])
        ) as PlanDay['meals'],
      });
    }
  });
  return writes;
}
