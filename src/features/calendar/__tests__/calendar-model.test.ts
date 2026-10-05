import {
  addDays,
  applyPlan,
  conflicts,
  datesForPlan,
  minRepeatWeeks,
  planStarts,
  repeatLabel,
  emptyCalendarDay,
  formatDay,
  formatRange,
  startOfWeek,
  toDateKey,
  weekDates,
  type CalendarDay,
} from '@/features/calendar/calendar-model';
import { addItem, emptyPlanDays, type MealPlan } from '@/features/plans/meal-plan';

function weekA(): MealPlan {
  let plan: MealPlan = { id: 'a', name: 'Week A', days: emptyPlanDays(2) };
  plan = addItem(plan, 0, 'dinner', 'tacos');
  plan = addItem(plan, 1, 'dinner', 'curry');
  return plan;
}

describe('dates', () => {
  it('formats and steps through local dates', () => {
    expect(toDateKey(new Date(2026, 9, 5))).toBe('2026-10-05');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('finds the start of the week for Sunday or Monday weeks', () => {
    // 2026-10-07 is a Wednesday.
    expect(startOfWeek('2026-10-07', 0)).toBe('2026-10-04');
    expect(startOfWeek('2026-10-07', 1)).toBe('2026-10-05');
    expect(startOfWeek('2026-10-04', 0)).toBe('2026-10-04');
    expect(startOfWeek('2026-10-04', 1)).toBe('2026-09-28');
    expect(weekDates('2026-10-04')).toHaveLength(7);
  });

  it('labels days and ranges', () => {
    expect(formatDay('2026-10-04')).toBe('Sun, Oct 4');
    expect(formatRange('2026-10-04', '2026-10-10')).toBe('Oct 4 – 10');
    expect(formatRange('2026-09-27', '2026-10-03')).toBe('Sep 27 – Oct 3');
    expect(formatRange('2026-12-27', '2027-01-02')).toBe('Dec 27 – Jan 2, 2027');
  });
});

describe('applyPlan', () => {
  it('repeats the plan every week from the same weekday', () => {
    const weekly = { everyWeeks: 1, forWeeks: 2 };
    expect(datesForPlan(weekA(), '2026-10-04', weekly)).toEqual([
      '2026-10-04',
      '2026-10-05',
      '2026-10-11',
      '2026-10-12',
    ]);
    const writes = applyPlan(weekA(), '2026-10-04', weekly, new Map(), 'replace');
    expect(writes.map((w) => [w.date, w.meals.dinner[0].recipeId, w.source?.dayIndex])).toEqual([
      ['2026-10-04', 'tacos', 0],
      ['2026-10-05', 'curry', 1],
      ['2026-10-11', 'tacos', 0],
      ['2026-10-12', 'curry', 1],
    ]);
  });

  it('repeats every few weeks over a number of weeks, or not at all', () => {
    expect(planStarts('2026-10-04', { everyWeeks: 3, forWeeks: 12 })).toEqual([
      '2026-10-04',
      '2026-10-25',
      '2026-11-15',
      '2026-12-06',
    ]);
    expect(planStarts('2026-10-04', { everyWeeks: 2, forWeeks: 3 })).toEqual([
      '2026-10-04',
      '2026-10-18',
    ]);
    expect(planStarts('2026-10-04', null)).toEqual(['2026-10-04']);
    expect(repeatLabel({ everyWeeks: 3, forWeeks: 12 })).toBe('Every 3 weeks for 12 weeks');
    expect(repeatLabel({ everyWeeks: 1, forWeeks: 1 })).toBe('Every week for 1 week');
    expect(repeatLabel(null)).toBe('Once');
  });

  it('never repeats a plan sooner than its length', () => {
    expect(minRepeatWeeks({ days: Array(7).fill(null) })).toBe(1);
    expect(minRepeatWeeks({ days: Array(10).fill(null) })).toBe(2);
    expect(minRepeatWeeks({ days: Array(2).fill(null) })).toBe(1);
  });

  const existing = new Map<string, CalendarDay>([
    [
      '2026-10-05',
      {
        ...emptyCalendarDay('2026-10-05'),
        meals: { breakfast: [], lunch: [], dinner: [{ recipeId: 'pizza', servings: null }] },
      },
    ],
    ['2026-10-04', emptyCalendarDay('2026-10-04')],
  ]);

  it('reports dates that already have meals', () => {
    expect(conflicts(weekA(), '2026-10-04', null, existing)).toEqual(['2026-10-05']);
  });

  it('replaces, adds to, or skips days that already have meals', () => {
    const dinner = (mode: 'replace' | 'add' | 'skip') =>
      applyPlan(weekA(), '2026-10-04', null, existing, mode).map((w) => [
        w.date,
        w.meals.dinner.map((i) => i.recipeId),
      ]);
    expect(dinner('replace')).toEqual([
      ['2026-10-04', ['tacos']],
      ['2026-10-05', ['curry']],
    ]);
    expect(dinner('add')).toEqual([
      ['2026-10-04', ['tacos']],
      ['2026-10-05', ['pizza', 'curry']],
    ]);
    expect(dinner('skip')).toEqual([['2026-10-04', ['tacos']]]);
  });

  it('copies meals so later edits to a date do not touch the plan', () => {
    const plan = weekA();
    const [first] = applyPlan(plan, '2026-10-04', null, new Map(), 'replace');
    first.meals.dinner.push({ recipeId: 'rice', servings: null });
    expect(plan.days[0].meals.dinner).toHaveLength(1);
  });
});
