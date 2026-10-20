import { useRef, useState, type RefObject } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { IconButton } from '@/components/icon-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { categoryName, guessCategory, type CategoryId } from '@/features/ingredients/categories';
import { CATALOG_BY_KEY } from '@/features/ingredients/catalog';
import { CategoryField } from '@/features/ingredients/category-field';
import { mustChooseForm } from '@/features/ingredients/generic-ingredients';
import { canonicalName, type Ingredient } from '@/features/ingredients/ingredient-model';
import { saveIngredient } from '@/features/ingredients/ingredient-repo';
import { IngredientPicker } from '@/features/ingredients/ingredient-picker';
import {
  ingredientNameKey,
  parseAmountRange,
  prepWordsInName,
  withoutPrepWord,
} from '@/features/ingredients/parse-ingredient-line';
import {
  allUnits,
  COMMON_UNITS,
  getCustomUnits,
  unitLabel,
  type UnitKey,
} from '@/features/ingredients/units';
import {
  amountInputText,
  formatIngredientAmount,
  linkFor,
  rowsFromText,
} from '@/features/recipes/recipe-draft';
import type { DraftRow, RowLink } from '@/features/recipes/recipe-types';
import { moveItem } from '@/features/stores/store-edit';
import { useHousehold } from '@/features/session/session-provider';
import { useTheme } from '@/hooks/use-theme';

type IngredientRowsEditorProps = {
  rows: DraftRow[];
  onChange: (rows: DraftRow[]) => void;
  ingredients: Ingredient[];
  error?: string;
  /** The form's scroll view and its content, to bring a closed row back into view. */
  scrollRef?: RefObject<ScrollView | null>;
  contentRef?: RefObject<View | null>;
};

/**
 * The recipe's ingredient list: paste or type lines to add rows, then fix any
 * row on its own (amount, unit, note, and which ingredient it is).
 */
export function IngredientRowsEditor({
  rows,
  onChange,
  ingredients: loaded,
  error,
  scrollRef,
  contentRef,
}: IngredientRowsEditorProps) {
  const { household } = useHousehold();
  // Categories she changed here, saved to the ingredient right away.
  const [changedCategories, setChangedCategories] = useState<Record<string, CategoryId>>({});
  const ingredients = loaded.map((i) =>
    changedCategories[i.id] ? { ...i, category: changedCategories[i.id], categorySet: true } : i
  );

  function changeCategory(ingredient: Ingredient, category: CategoryId) {
    setChangedCategories((current) => ({ ...current, [ingredient.id]: category }));
    saveIngredient(household.id, { ...ingredient, category, categorySet: true }).catch((error) =>
      console.warn('Category not saved', error)
    );
  }

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [addText, setAddText] = useState('');
  const rowViews = useRef(new Map<string, View>());
  // The row whose editor just closed; it scrolls to the top once laid out.
  const scrollToRow = useRef<string | null>(null);

  /**
   * Closing a tall row editor would leave the page scrolled far below that
   * row, so once the collapsed row has its new layout (onLayout, not a frame
   * guess, which measured the old layout), scroll it to the top of the screen.
   */
  function closeEditor(key: string) {
    scrollToRow.current = key;
    setEditingKey(null);
  }

  function rowLaidOut(key: string) {
    if (scrollToRow.current !== key) return;
    scrollToRow.current = null;
    const row = rowViews.current.get(key);
    const content = contentRef?.current;
    if (!row || !content) return;
    row.measureLayout(content, (_x, y) => {
      scrollRef?.current?.scrollTo({ y: Math.max(0, y - Spacing.two), animated: false });
    });
  }

  function update(key: string, change: Partial<DraftRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...change } : r)));
  }

  function addLines() {
    const added = rowsFromText(addText, ingredients);
    if (added.length === 0) return;
    onChange([...rows, ...added]);
    setAddText('');
  }

  return (
    <View style={styles.group}>
      <ThemedText type="smallBold" accessibilityRole="header">
        Ingredients
      </ThemedText>
      {error && (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      )}
      {rows.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No ingredients yet. Add them below.
        </ThemedText>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Tap a line to change its amount, unit, or ingredient.
        </ThemedText>
      )}
      {rows.length > 0 && (
        <View>
          {rows.map((row, index) =>
            row.key === editingKey ? (
              <RowEditor
                key={row.key}
                row={row}
                ingredients={ingredients}
                onCategoryChange={changeCategory}
                onChange={(change) => update(row.key, change)}
                onDone={() => closeEditor(row.key)}
                onRemove={() => {
                  onChange(rows.filter((r) => r.key !== row.key));
                  setEditingKey(null);
                }}
                onUp={index > 0 ? () => onChange(moveItem(rows, index, -1)) : undefined}
                onDown={
                  index < rows.length - 1 ? () => onChange(moveItem(rows, index, 1)) : undefined
                }
              />
            ) : (
              <View
                key={row.key}
                ref={(view) => {
                  if (view) rowViews.current.set(row.key, view);
                  else rowViews.current.delete(row.key);
                }}
                onLayout={() => rowLaidOut(row.key)}>
                <RowSummary
                  row={row}
                  ingredients={ingredients}
                  onEdit={() => setEditingKey(row.key)}
                  onLink={(link) => update(row.key, { link })}
                  onChange={(change) => update(row.key, change)}
                />
              </View>
            )
          )}
        </View>
      )}

      <TextField
        label="Add ingredients"
        hint="Type or paste, one per line, like “1 ½ cups flour, sifted”."
        testID="recipe-add-ingredients"
        value={addText}
        onChangeText={setAddText}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Button
        label="Add to recipe"
        variant="secondary"
        onPress={addLines}
        disabled={!addText.trim()}
      />
    </View>
  );
}

type NewLink = Extract<RowLink, { kind: 'new' }>;

/** A linked ingredient's category, under its name (as on the recipe page). */
function LinkedCategory({
  ingredientId,
  ingredients,
}: {
  ingredientId: string;
  ingredients: Ingredient[];
}) {
  const ingredient = ingredients.find((i) => i.id === ingredientId);
  if (!ingredient) return null;
  return (
    <ThemedText
      type="small"
      themeColor={ingredient.category === 'uncategorized' ? 'attention' : 'textSecondary'}>
      {categoryName(ingredient.category)}
    </ThemedText>
  );
}

/** A new ingredient's category: hers if she chose one, else the guess. */
function newCategory(link: NewLink): CategoryId {
  return link.category ?? guessCategory(link.name);
}

function linkName(row: DraftRow): string {
  if (row.link.kind === 'existing') return row.link.name;
  if (row.link.kind === 'new') return row.link.name;
  return row.writtenName;
}

type ChooseLink = Extract<RowLink, { kind: 'choose' }>;

/** "Which ingredient is 'onion'?": her matches, suggested kinds, or new. */
function ChooseChips({
  writtenName,
  link,
  onLink,
  onOther,
}: {
  writtenName: string;
  link: ChooseLink;
  onLink: (link: RowLink) => void;
  onOther?: () => void;
}) {
  return (
    <View style={styles.choices}>
      {link.candidates.map((c) => (
        <Chip
          key={c.id}
          label={c.name}
          accessibilityLabel={`Use ${c.name} for ${writtenName}`}
          onPress={() => onLink({ kind: 'existing', ingredientId: c.id, name: c.name })}
        />
      ))}
      {link.suggestions.map((name) => (
        <Chip
          key={name}
          label={name}
          accessibilityLabel={`Use new ${name} for ${writtenName}`}
          onPress={() => onLink({ kind: 'new', name })}
        />
      ))}
      {/* A bare herb or spice must be chosen by form, not kept as is. */}
      {!mustChooseForm(writtenName) && (
        <Chip
          label={`New: ${writtenName}`}
          onPress={() => onLink({ kind: 'new', name: writtenName })}
        />
      )}
      {onOther && <Chip label="Other…" onPress={onOther} />}
    </View>
  );
}

/** What a row's link says under its name: category, new, or "which one?". */
function LinkStatus({
  link,
  writtenName,
  ingredients,
}: {
  link: RowLink;
  writtenName: string;
  ingredients: Ingredient[];
}) {
  if (link.kind === 'existing') {
    return <LinkedCategory ingredientId={link.ingredientId} ingredients={ingredients} />;
  }
  if (link.kind === 'new') {
    return (
      <>
        <ThemedText type="small" themeColor="attention">
          New ingredient
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {categoryName(newCategory(link))}
        </ThemedText>
      </>
    );
  }
  return (
    <ThemedText type="small" themeColor="danger">
      Which ingredient is “{writtenName}”?
    </ThemedText>
  );
}

/** The other choices under a row: "or romaine lettuce", each linked. */
function AlternateLines({
  row,
  ingredients,
  onChange,
}: {
  row: DraftRow;
  ingredients: Ingredient[];
  onChange: (change: Partial<DraftRow>) => void;
}) {
  const alternates = row.alternates ?? [];
  if (alternates.length === 0) return null;
  return (
    <View style={styles.alternates}>
      {alternates.map((alt, i) => (
        <View key={i} style={styles.group}>
          <View>
            <ThemedText>
              or {alt.link.kind === 'choose' ? alt.writtenName : alt.link.name}
            </ThemedText>
            <LinkStatus link={alt.link} writtenName={alt.writtenName} ingredients={ingredients} />
          </View>
          {alt.link.kind === 'choose' && (
            <ChooseChips
              writtenName={alt.writtenName}
              link={alt.link}
              onLink={(link) =>
                onChange({
                  alternates: alternates.map((a, j) => (j === i ? { ...a, link } : a)),
                })
              }
            />
          )}
        </View>
      ))}
    </View>
  );
}

/** Collapsed row. Vague matches show their choices right here. */
function RowSummary({
  row,
  ingredients,
  onEdit,
  onLink,
  onChange,
}: {
  row: DraftRow;
  ingredients: Ingredient[];
  onEdit: () => void;
  onLink: (link: RowLink) => void;
  onChange: (change: Partial<DraftRow>) => void;
}) {
  // "chopped onion": offer moving prep words to the note, unless the whole
  // name is a product ("diced tomatoes", "sliced almonds").
  const prepWords = CATALOG_BY_KEY.has(ingredientNameKey(row.writtenName))
    ? []
    : prepWordsInName(row.writtenName);
  const theme = useTheme();
  const amount = formatIngredientAmount(row);
  const name = linkName(row);
  return (
    <View
      style={[
        styles.row,
        { borderBottomColor: theme.border },
        row.link.kind === 'choose' && { backgroundColor: theme.backgroundElement },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${amount ? `${amount} ` : ''}${name}${(row.alternates ?? []).map((a) => ` or ${a.writtenName}`).join('')}${row.note ? `, ${row.note}` : ''}`}
        onPress={onEdit}
        style={styles.rowMain}>
        <ThemedText type="smallBold" style={styles.amount}>
          {amount || '—'}
        </ThemedText>
        <View style={styles.flex}>
          <ThemedText>
            {name}
            {row.note ? (
              <ThemedText themeColor="textSecondary">{`, ${row.note}`}</ThemedText>
            ) : null}
          </ThemedText>
          <LinkStatus link={row.link} writtenName={row.writtenName} ingredients={ingredients} />
          {row.scan?.unclear && (
            <ThemedText type="small" themeColor="attention">
              Hard to read. Photo says: “{row.scan.sourceText}”
            </ThemedText>
          )}
        </View>
      </Pressable>
      {row.link.kind === 'choose' && (
        <ChooseChips
          writtenName={row.writtenName}
          link={row.link}
          onLink={onLink}
          onOther={onEdit}
        />
      )}
      <AlternateLines row={row} ingredients={ingredients} onChange={onChange} />
      {prepWords.length > 0 && (
        <View style={styles.choices}>
          <ThemedText type="small" themeColor="attention" style={styles.fullWidth}>
            Is “{prepWords.join('”, “')}” how to prepare it? Notes keep the name clean.
          </ThemedText>
          {prepWords.map((word) => (
            <Chip
              key={word}
              label={`Move “${word}” to note`}
              onPress={() => {
                const writtenName = withoutPrepWord(row.writtenName, word);
                const adverb = row.writtenName
                  .toLowerCase()
                  .match(
                    new RegExp(`\\b(finely|roughly|coarsely|thinly|freshly|lightly)\\s+${word}\\b`)
                  );
                const moved = adverb ? `${adverb[1]} ${word}` : word;
                onChange({
                  writtenName,
                  note: row.note ? `${moved}, ${row.note}` : moved,
                  link: linkFor(writtenName, ingredients),
                });
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/** Expanded row: edit amount, unit, note, and which ingredient it is. */
function RowEditor({
  row,
  ingredients,
  onCategoryChange,
  onChange,
  onDone,
  onRemove,
  onUp,
  onDown,
}: {
  row: DraftRow;
  ingredients: Ingredient[];
  onCategoryChange: (ingredient: Ingredient, category: CategoryId) => void;
  onChange: (change: Partial<DraftRow>) => void;
  onDone: () => void;
  onRemove: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const theme = useTheme();
  const [amountText, setAmountText] = useState(amountInputText(row));
  const [amountError, setAmountError] = useState<string | null>(null);
  // Her own units sit with the common ones; More units shows everything.
  const firstUnits: UnitKey[] = [...COMMON_UNITS, ...getCustomUnits().map((u) => u.key)];
  const [moreUnits, setMoreUnits] = useState(row.unit !== null && !firstUnits.includes(row.unit));
  const [picking, setPicking] = useState(row.link.kind === 'choose');
  const linked =
    row.link.kind === 'existing'
      ? ingredients.find((i) => i.id === (row.link as { ingredientId: string }).ingredientId)
      : undefined;
  const units = moreUnits ? allUnits() : firstUnits;

  function changeAmount(text: string) {
    setAmountText(text);
    const parsed = parseAmountRange(text);
    if (parsed) {
      setAmountError(null);
      onChange(parsed);
    } else {
      setAmountError('Use a number like 2, 1 ½, 1/4, or a range like 2-3.');
    }
  }

  function chooseUnit(unit: UnitKey | null) {
    onChange({ unit });
  }

  return (
    <View style={[styles.editor, { borderColor: theme.tint }]}>
      <TextField
        label="Amount"
        hint="Leave blank for “to taste”."
        testID="row-amount"
        value={amountText}
        onChangeText={changeAmount}
        error={amountError ?? undefined}
        keyboardType="default"
        autoCorrect={false}
      />
      <View style={styles.group}>
        <ThemedText type="smallBold">Unit</ThemedText>
        <View style={styles.choices}>
          <Chip label="None" selected={row.unit === null} onPress={() => chooseUnit(null)} />
          {units.map((unit) => (
            <Chip
              key={unit}
              label={unitLabel(unit, 2)}
              selected={row.unit === unit}
              onPress={() => chooseUnit(unit)}
            />
          ))}
          {!moreUnits && <Chip label="More units…" onPress={() => setMoreUnits(true)} />}
        </View>
      </View>
      <TextField
        label="Note"
        testID="row-note"
        value={row.note ?? ''}
        onChangeText={(note) => onChange({ note: note.trim() ? note : null })}
        placeholder="e.g. diced"
      />

      <View style={styles.group}>
        <ThemedText type="smallBold">Ingredient</ThemedText>
        {row.raw ? (
          <ThemedText type="small" themeColor="textSecondary">
            Written as “{row.raw}”
          </ThemedText>
        ) : null}
        {picking ? (
          <IngredientPicker
            ingredients={ingredients}
            initialSearch={row.writtenName}
            autoFocus
            onPick={(ingredient) => {
              onChange({
                link: { kind: 'existing', ingredientId: ingredient.id, name: ingredient.name },
              });
              setPicking(false);
            }}
            onCreate={(name) => {
              const lower = canonicalName(name);
              onChange({ link: { kind: 'new', name: lower }, writtenName: lower });
              setPicking(false);
            }}
          />
        ) : (
          <View style={styles.linkRow}>
            <View style={styles.flex}>
              <ThemedText>{linkName(row)}</ThemedText>
              {row.link.kind === 'new' && (
                <ThemedText type="small" themeColor="attention">
                  New ingredient, added to your list when you save
                </ThemedText>
              )}
            </View>
            <Chip label="Change" onPress={() => setPicking(true)} />
          </View>
        )}
      </View>

      {!picking && linked && (
        <CategoryField
          value={linked.category}
          guessed={!linked.categorySet}
          note={`Changes ${linked.name} everywhere: every recipe and shopping list.`}
          onChange={(category) => onCategoryChange(linked, category)}
        />
      )}
      {!picking && row.link.kind === 'new' && (
        <CategoryField
          value={newCategory(row.link)}
          guessed={!row.link.category}
          onChange={(category) => onChange({ link: { ...(row.link as NewLink), category } })}
        />
      )}

      {!picking && <OrInstead row={row} ingredients={ingredients} onChange={onChange} />}

      <View style={styles.editorActions}>
        <IconButton
          icon={{ android: 'arrow_upward', ios: 'arrow.up' }}
          label="Move line up"
          onPress={() => onUp?.()}
          disabled={!onUp}
        />
        <IconButton
          icon={{ android: 'arrow_downward', ios: 'arrow.down' }}
          label="Move line down"
          onPress={() => onDown?.()}
          disabled={!onDown}
        />
        <IconButton
          icon={{ android: 'delete', ios: 'trash' }}
          label="Remove line"
          onPress={onRemove}
          tone="danger"
        />
        <View style={styles.flex} />
        <Button
          label="Done"
          onPress={onDone}
          disabled={
            !!amountError ||
            row.link.kind === 'choose' ||
            !!row.alternates?.some((a) => a.link.kind === 'choose')
          }
        />
      </View>
    </View>
  );
}

/**
 * "Other options": other ingredients the recipe takes in place of this one
 * ("iceberg or romaine lettuce"). A list buys the first unless it already
 * has one of the others.
 */
function OrInstead({
  row,
  ingredients,
  onChange,
}: {
  row: DraftRow;
  ingredients: Ingredient[];
  onChange: (change: Partial<DraftRow>) => void;
}) {
  const [adding, setAdding] = useState(false);
  const alternates = row.alternates ?? [];
  function setAlternates(next: DraftRow['alternates']) {
    onChange({ alternates: next && next.length ? next : undefined });
  }
  return (
    <View style={styles.group}>
      <ThemedText type="smallBold">Other options</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        You can optionally specify another option for this ingredient by selecting it below
      </ThemedText>
      {alternates.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Lists buy the first, unless one of these is already on the list.
        </ThemedText>
      )}
      {alternates.map((alt, i) => {
        const name = alt.link.kind === 'choose' ? alt.writtenName : alt.link.name;
        return (
          <View key={i} style={styles.linkRow}>
            <View style={styles.flex}>
              <ThemedText>or {name}</ThemedText>
              <LinkStatus link={alt.link} writtenName={alt.writtenName} ingredients={ingredients} />
              {alt.link.kind === 'choose' && (
                <ChooseChips
                  writtenName={alt.writtenName}
                  link={alt.link}
                  onLink={(link) =>
                    setAlternates(alternates.map((a, j) => (j === i ? { ...a, link } : a)))
                  }
                />
              )}
            </View>
            <Chip
              label="Remove"
              accessibilityLabel={`Remove ${name} as a choice`}
              onPress={() => setAlternates(alternates.filter((_, j) => j !== i))}
            />
          </View>
        );
      })}
      {adding ? (
        <IngredientPicker
          ingredients={ingredients}
          initialSearch=""
          autoFocus
          onPick={(ingredient) => {
            setAlternates([
              ...alternates,
              {
                writtenName: ingredient.name,
                link: { kind: 'existing', ingredientId: ingredient.id, name: ingredient.name },
              },
            ]);
            setAdding(false);
          }}
          onCreate={(name) => {
            const lower = canonicalName(name);
            setAlternates([
              ...alternates,
              { writtenName: lower, link: { kind: 'new', name: lower } },
            ]);
            setAdding(false);
          }}
        />
      ) : (
        <Chip label="Add an option" onPress={() => setAdding(true)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  alternates: {
    gap: Spacing.two,
    paddingLeft: 84 + Spacing.three,
  },
  fullWidth: {
    width: '100%',
  },
  group: {
    gap: Spacing.two,
  },
  row: {
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  rowMain: {
    flexDirection: 'row',
    gap: Spacing.three,
    minHeight: 44,
    alignItems: 'flex-start',
    paddingTop: Spacing.one,
  },
  amount: {
    width: 84,
  },
  flex: {
    flex: 1,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  editor: {
    borderWidth: 2,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.three,
    marginVertical: Spacing.two,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  editorActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
