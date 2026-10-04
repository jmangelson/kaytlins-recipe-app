import {
  baseAmount,
  bestDisplayUnit,
  convert,
  unitDimension,
  unitLabel,
  type UnitKey,
} from '@/features/ingredients/units';

export type Quantity = {
  /** Null for unmeasured amounts such as "to taste". */
  amount: number | null;
  /** Null means a plain count ("2 eggs"). */
  unit: UnitKey | null;
};

const DISPLAY_FRACTIONS: [number, string][] = [
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
];

/** Formats an amount the way a recipe would: 1.5 → "1 ½", 0.333 → "⅓", 2.4 → "2.4". */
export function formatAmount(amount: number): string {
  const whole = Math.floor(amount + 1e-9);
  const fraction = amount - whole;
  if (fraction < 0.02) return String(whole);
  if (fraction > 0.98) return String(whole + 1);
  const match = DISPLAY_FRACTIONS.find(([value]) => Math.abs(fraction - value) < 0.02);
  if (match) return whole > 0 ? `${whole} ${match[1]}` : match[1];
  return String(Math.round(amount * 100) / 100);
}

export function formatQuantity({ amount, unit }: Quantity): string {
  if (amount === null) return unit ? unitLabel(unit, null) : '';
  const text = formatAmount(amount);
  return unit ? `${text} ${unitLabel(unit, amount)}` : text;
}

/**
 * Adds up amounts of one ingredient. Volumes and weights convert to a
 * readable unit (2 cups + 4 tbsp → 2 ¼ cups); count-style units only add to
 * the same unit; incompatible amounts stay as separate lines.
 */
export function combineQuantities(quantities: Quantity[]): Quantity[] {
  const result: Quantity[] = [];
  const baseTotals = { volume: 0, weight: 0 };
  const hasDimension = { volume: false, weight: false };
  const countTotals = new Map<UnitKey | null, number>();
  let unmeasured = false;

  for (const { amount, unit } of quantities) {
    if (amount === null) {
      unmeasured = true;
      continue;
    }
    const dimension = unitDimension(unit);
    if (dimension === 'count') {
      countTotals.set(unit, (countTotals.get(unit) ?? 0) + amount);
    } else {
      baseTotals[dimension] += baseAmount(amount, unit!);
      hasDimension[dimension] = true;
    }
  }

  for (const dimension of ['volume', 'weight'] as const) {
    if (!hasDimension[dimension]) continue;
    const unit = bestDisplayUnit(dimension, baseTotals[dimension]);
    const amount = convert(baseTotals[dimension], dimension === 'volume' ? 'tsp' : 'oz', unit);
    result.push({ amount, unit });
  }
  for (const [unit, amount] of countTotals) result.push({ amount, unit });
  if (unmeasured && result.length === 0) result.push({ amount: null, unit: null });
  return result;
}
