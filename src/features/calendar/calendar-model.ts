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

/**
 * How a plan repeats on the calendar: null for once, or every `everyWeeks`
 * weeks over `forWeeks` weeks ("every 3 weeks for 12 weeks" puts it on
 * weeks 1, 4, 7, and 10).
 */
export type Repeat = { everyWeeks: number; forWeeks: number } | null;

/** The fewest weeks between repeats so a plan never overlaps itself. */
export function minRepeatWeeks(plan: Pick<MealPlan, 'days'>): number {
  return Math.max(1, Math.ceil(plan.days.length / 7));
}

/** The date each copy of the plan starts on. */
export function planStarts(start: DateKey, repeat: Repeat): DateKey[] {
  if (!repeat) return [start];
  const count = Math.ceil(repeat.forWeeks / repeat.everyWeeks);
  return Array.from({ length: count }, (_, i) => addDays(start, i * repeat.everyWeeks * 7));
}

/** "Every 3 weeks for 12 weeks" or "Once". */
export function repeatLabel(repeat: Repeat): string {
  if (!repeat) return 'Once';
  const every = repeat.everyWeeks === 1 ? 'Every week' : `Every ${repeat.everyWeeks} weeks`;
  return `${every} for ${repeat.forWeeks} ${repeat.forWeeks === 1 ? 'week' : 'weeks'}`;
}

/** Each date the plan covers, with the plan day that lands there, in order. */
function placements(
  plan: Pick<MealPlan, 'days'>,
  start: DateKey,
  repeat: Repeat
): { date: DateKey; dayIndex: number }[] {
  const byDate = new Map<DateKey, number>();
  for (const first of planStarts(start, repeat)) {
    plan.days.forEach((_, dayIndex) => byDate.set(addDays(first, dayIndex), dayIndex));
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayIndex]) => ({ date, dayIndex }));
}

/** The dates a plan covers when started on `start` and repeated. */
export function datesForPlan(
  plan: Pick<MealPlan, 'days'>,
  start: DateKey,
  repeat: Repeat
): DateKey[] {
  return placements(plan, start, repeat).map((p) => p.date);
}

/** Dates in the range that already have meals. */
export function conflicts(
  plan: Pick<MealPlan, 'days'>,
  start: DateKey,
  repeat: Repeat,
  existing: Map<DateKey, CalendarDay>
): DateKey[] {
  return datesForPlan(plan, start, repeat).filter((d) => hasMeals(existing.get(d)));
}

/**
 * Days to write when putting a plan on the calendar: plan day i lands on
 * start + i, and again from each repeat's start. Dates that already have
 * meals are replaced, added to, or skipped. Each written day is a copy that
 * remembers its plan day, so editing it later doesn't change the plan.
 */
export function applyPlan(
  plan: MealPlan,
  start: DateKey,
  repeat: Repeat,
  existing: Map<DateKey, CalendarDay>,
  mode: ConflictMode
): CalendarDay[] {
  const writes: CalendarDay[] = [];
  placements(plan, start, repeat).forEach(({ date, dayIndex }) => {
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
