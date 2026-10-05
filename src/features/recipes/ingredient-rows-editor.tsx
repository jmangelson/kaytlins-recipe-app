import { useRef, useState, type RefObject } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { IconButton } from '@/components/icon-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { canonicalName, type Ingredient } from '@/features/ingredients/ingredient-model';
import { IngredientPicker } from '@/features/ingredients/ingredient-picker';
import { parseAmountRange } from '@/features/ingredients/parse-ingredient-line';
import { ALL_UNITS, COMMON_UNITS, unitLabel, type UnitKey } from '@/features/ingredients/units';
import {
  amountInputText,
  formatIngredientAmount,
  rowsFromText,
} from '@/features/recipes/recipe-draft';
import type { DraftRow, RowLink } from '@/features/recipes/recipe-types';
import { moveItem } from '@/features/stores/store-edit';
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
  ingredients,
  error,
  scrollRef,
  contentRef,
}: IngredientRowsEditorProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [addText, setAddText] = useState('');
  const rowViews = useRef(new Map<string, View>());

  /**
   * Closing a tall row editor can leave that row above the screen, so scroll
   * it back near the top once the collapsed row has been laid out.
   */
  function closeEditor(key: string) {
    setEditingKey(null);
    requestAnimationFrame(() => {
      const row = rowViews.current.get(key);
      const content = contentRef?.current;
      if (!row || !content) return;
      row.measureLayout(content, (_x, y) => {
        scrollRef?.current?.scrollTo({ y: Math.max(0, y - 96), animated: true });
      });
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
                }}>
                <RowSummary
                  row={row}
                  onEdit={() => setEditingKey(row.key)}
                  onLink={(link) => update(row.key, { link })}
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

function linkName(row: DraftRow): string {
  if (row.link.kind === 'existing') return row.link.name;
  if (row.link.kind === 'new') return row.link.name;
  return row.writtenName;
}

/** Collapsed row. Vague matches show their choices right here. */
function RowSummary({
  row,
  onEdit,
  onLink,
}: {
  row: DraftRow;
  onEdit: () => void;
  onLink: (link: RowLink) => void;
}) {
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
        accessibilityLabel={`Edit ${amount ? `${amount} ` : ''}${name}${row.note ? `, ${row.note}` : ''}`}
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
          {row.link.kind === 'new' && (
            <ThemedText type="small" themeColor="attention">
              New ingredient
            </ThemedText>
          )}
          {row.link.kind === 'choose' && (
            <ThemedText type="small" themeColor="danger">
              Which ingredient is “{row.writtenName}”?
            </ThemedText>
          )}
        </View>
      </Pressable>
      {row.link.kind === 'choose' && (
        <View style={styles.choices}>
          {row.link.candidates.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              accessibilityLabel={`Use ${c.name} for ${row.writtenName}`}
              onPress={() => onLink({ kind: 'existing', ingredientId: c.id, name: c.name })}
            />
          ))}
          {row.link.suggestions.map((name) => (
            <Chip
              key={name}
              label={name}
              accessibilityLabel={`Use new ${name} for ${row.writtenName}`}
              onPress={() => onLink({ kind: 'new', name })}
            />
          ))}
          <Chip
            label={`New: ${row.writtenName}`}
            onPress={() => onLink({ kind: 'new', name: row.writtenName })}
          />
          <Chip label="Other…" onPress={onEdit} />
        </View>
      )}
    </View>
  );
}

/** Expanded row: edit amount, unit, note, and which ingredient it is. */
function RowEditor({
  row,
  ingredients,
  onChange,
  onDone,
  onRemove,
  onUp,
  onDown,
}: {
  row: DraftRow;
  ingredients: Ingredient[];
  onChange: (change: Partial<DraftRow>) => void;
  onDone: () => void;
  onRemove: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const theme = useTheme();
  const [amountText, setAmountText] = useState(amountInputText(row));
  const [amountError, setAmountError] = useState<string | null>(null);
  const [moreUnits, setMoreUnits] = useState(row.unit !== null && !COMMON_UNITS.includes(row.unit));
  const [picking, setPicking] = useState(row.link.kind === 'choose');
  const units = moreUnits ? ALL_UNITS : COMMON_UNITS;

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
          disabled={!!amountError || row.link.kind === 'choose'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
