/** Recipe lines as stored, for code that rewrites them (rename, merge). */
export type StoredLine = {
  ingredientId: string;
  name: string;
  alternates?: { ingredientId: string; name: string }[];
};

/** The line uses the ingredient, as its first choice or another one. */
export function lineUses(line: StoredLine, id: string): boolean {
  return line.ingredientId === id || !!line.alternates?.some((a) => a.ingredientId === id);
}

/**
 * Points a recipe line's uses of `fromId` (first choice or other choices)
 * at `to`; other choices that end up repeating one are dropped.
 */
export function relinkLine<T extends StoredLine>(
  line: T,
  fromId: string,
  to: { id: string; name: string }
): T {
  const swap = <L extends { ingredientId: string; name: string }>(l: L): L =>
    l.ingredientId === fromId ? { ...l, ingredientId: to.id, name: to.name } : l;
  const main = swap(line);
  if (!line.alternates) return main;
  const alternates = line.alternates
    .map(swap)
    .filter(
      (a, i, all) =>
        a.ingredientId !== main.ingredientId &&
        all.findIndex((b) => b.ingredientId === a.ingredientId) === i
    );
  const { alternates: _old, ...rest } = main;
  return (alternates.length ? { ...rest, alternates } : rest) as T;
}
