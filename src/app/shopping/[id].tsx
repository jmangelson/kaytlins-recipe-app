import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { HeaderButton } from '@/components/header-button';
import { IconButton } from '@/components/icon-button';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Ingredient } from '@/features/ingredients/ingredient-model';
import { listIngredients } from '@/features/ingredients/ingredient-repo';
import { parseAmountRange } from '@/features/ingredients/parse-ingredient-line';
import { formatAmount, formatQuantity, type Quantity } from '@/features/ingredients/quantity';
import { unitLabel } from '@/features/ingredients/units';
import { useHousehold } from '@/features/session/session-provider';
import { addExtraItem } from '@/features/shopping/add-extra';
import { AddItem, type NewItem } from '@/features/shopping/add-item';
import { CheckRow } from '@/features/shopping/check-row';
import { deleteExtraItem, listExtraItems, saveExtraItem } from '@/features/shopping/extra-repo';
import {
  extraItemFromLine,
  groupReadyList,
  listAsText,
  placeLines,
  remaining,
  removeLine,
  toBuy,
  type ListLine,
  withExtras,
  type ShoppingList,
} from '@/features/shopping/list-model';
import {
  deleteShoppingList,
  getShoppingList,
  saveShoppingList,
} from '@/features/shopping/list-repo';
import { listStores } from '@/features/stores/store-repo';
import type { Store } from '@/features/stores/store-types';
import { useAsync } from '@/hooks/use-async';
import { useAutosave } from '@/hooks/use-autosave';
import { useTheme } from '@/hooks/use-theme';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

/** "2 lb + 1 can", or "some" for amounts like "to taste". */
function amountText(quantities: Quantity[]): string {
  return quantities.map(formatQuantity).filter(Boolean).join(' + ') || 'some';
}

/** One shopping list: the pantry check, then the list by store and area. */
export default function ShoppingListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household } = useHousehold();
  const data = useAsync(async () => {
    const [saved, stores, ingredientList, extras] = await Promise.all([
      getShoppingList(household.id, id),
      listStores(household.id),
      listIngredients(household.id),
      listExtraItems(household.id),
    ]);
    const ingredients = new Map(ingredientList.map((i) => [i.id, i]));
    // Items added by hand since the list was made join it now.
    const list = saved && withExtras(saved, extras, ingredients, stores);
    if (list && list !== saved) saveShoppingList(household.id, list);
    return { list, stores, ingredients };
  }, [household.id, id]);

  if (data.state.status === 'loading') return <LoadingScreen label="Loading list" />;
  if (data.state.status === 'error') {
    return (
      <ErrorScreen
        message={`Couldn't load the list. ${data.state.message}`}
        onRetry={data.reload}
      />
    );
  }
  const { list, stores, ingredients } = data.state.data;
  if (!list) return <ErrorScreen message="This list was deleted." />;
  return (
    <ListEditor
      key={list.id}
      householdId={household.id}
      initial={list}
      stores={stores}
      ingredients={ingredients}
    />
  );
}

function ListEditor({
  householdId,
  initial,
  stores,
  ingredients,
}: {
  householdId: string;
  initial: ShoppingList;
  stores: Store[];
  ingredients: Map<string, Ingredient>;
}) {
  const [list, setList] = useState(initial);
  const [known, setKnown] = useState(ingredients);
  const [deleted, setDeleted] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  useAutosave(list, (value) => {
    if (!deleted) saveShoppingList(householdId, value);
  });

  // Switching between the pantry check and the list starts at the top.
  function switchTo(next: ShoppingList) {
    setList(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  /**
   * Every change goes through here. Hand-added items stay on future lists
   * until checked off: checking one off (or removing it) clears it, and
   * unchecking puts it back.
   */
  function update(next: ShoppingList) {
    const after = new Map(next.lines.map((l) => [l.key, l]));
    for (const line of list.lines) {
      if (!line.extraId) continue;
      const now = after.get(line.key);
      if (!now || (now.checked && !line.checked)) {
        deleteExtraItem(householdId, line.extraId);
      } else if (!now.checked && line.checked) {
        const item = extraItemFromLine(now);
        if (item) saveExtraItem(householdId, item);
      }
    }
    setList(next);
  }

  function addItem(text: string, item: Ingredient | NewItem) {
    const added = addExtraItem(householdId, text, item);
    if (!added) return;
    const nextKnown = new Map(known).set(added.ingredient.id, added.ingredient);
    setKnown(nextKnown);
    setList(withExtras(list, [added.extra], nextKnown, stores));
  }

  const addItemField = (
    <AddItem
      ingredients={[...known.values()]}
      stores={stores.filter((s) => !s.hidden)}
      onAdd={addItem}
    />
  );

  function confirmDelete() {
    Alert.alert(`Delete ${list.name}?`, 'The list is removed from both phones.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleted(true);
          await deleteShoppingList(householdId, list.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen edges={HEADER_EDGES} scrollRef={scrollRef}>
      <Stack.Screen
        options={{
          title: list.name,
          headerRight: () => (
            <HeaderButton label="Delete" accessibilityLabel="Delete list" onPress={confirmDelete} />
          ),
        }}
      />
      {list.status === 'pantry' ? (
        <PantryCheck
          list={list}
          stores={stores}
          addItem={addItemField}
          onChange={update}
          onDone={() =>
            switchTo({
              ...list,
              status: 'ready',
              lines: placeLines(list.lines, known, stores, list.tripStoreIds),
            })
          }
        />
      ) : (
        <ReadyList
          list={list}
          stores={stores}
          addItem={addItemField}
          onChange={update}
          onBack={() => switchTo({ ...list, status: 'pantry' })}
        />
      )}
    </Screen>
  );
}

function PantryCheck({
  list,
  stores,
  addItem,
  onChange,
  onDone,
}: {
  list: ShoppingList;
  stores: Store[];
  addItem: ReactNode;
  onChange: (list: ShoppingList) => void;
  onDone: () => void;
}) {
  const buying = toBuy(list).length;
  const tripStores = stores.filter((s) => !s.hidden);

  function updateLine(next: ListLine) {
    onChange({ ...list, lines: list.lines.map((l) => (l.key === next.key ? next : l)) });
  }

  function toggleStore(storeId: string) {
    const ids = list.tripStoreIds.includes(storeId)
      ? list.tripStoreIds.filter((id) => id !== storeId)
      : [...list.tripStoreIds, storeId];
    onChange({ ...list, tripStoreIds: stores.map((s) => s.id).filter((id) => ids.includes(id)) });
  }

  return (
    <>
      <View style={styles.group}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Check the pantry
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Tick what you already have; it&apos;s left off the list. If you have some but not enough,
          tap Have some.
        </ThemedText>
        <ThemedText type="smallBold">
          {buying === 0 ? 'You have everything.' : `${buying} of ${list.lines.length} to buy.`}
        </ThemedText>
      </View>
      <View>
        {list.lines.map((line) => (
          <PantryLine
            key={line.key}
            line={line}
            onChange={updateLine}
            onRemove={() => onChange(removeLine(list, line.key))}
          />
        ))}
      </View>
      {addItem}

      <View style={styles.group}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Stores this trip
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Each item goes to its first choice among these.
        </ThemedText>
        <View style={styles.chips}>
          {tripStores.map((store) => (
            <Chip
              key={store.id}
              label={store.name}
              accessibilityLabel={`Shop at ${store.name}`}
              selected={list.tripStoreIds.includes(store.id)}
              onPress={() => toggleStore(store.id)}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        {list.tripStoreIds.length === 0 && (
          <ThemedText type="small" themeColor="attention">
            Choose at least one store.
          </ThemedText>
        )}
        <Button
          label="Make list"
          onPress={onDone}
          disabled={list.tripStoreIds.length === 0 || buying === 0}
        />
      </View>
    </>
  );
}

function PantryLine({
  line,
  onChange,
  onRemove,
}: {
  line: ListLine;
  onChange: (line: ListLine) => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(line.have.some((h) => h !== null));
  const measured = line.needed
    .map((quantity, index) => ({ quantity, index }))
    .filter(({ quantity }) => quantity.amount !== null);
  const left = remaining(line);
  const partial = !line.haveIt && line.have.some((h) => h !== null && h > 0);

  return (
    <View style={[styles.line, { borderBottomColor: theme.border }]}>
      <CheckRow
        title={line.name}
        detail={[
          `Need ${amountText(line.needed)}`,
          line.manual ? 'added by you' : line.recipeNames.join(', '),
        ]
          .filter(Boolean)
          .join(' · ')}
        trailing={line.manual ? <RemoveButton name={line.name} onPress={onRemove} /> : null}
        accessibilityLabel={`Have ${line.name}`}
        checked={line.haveIt}
        onToggle={() => onChange({ ...line, haveIt: !line.haveIt })}
      />
      {!line.haveIt && measured.length > 0 && (
        <View style={styles.haveSome}>
          {open ? (
            measured.map(({ quantity, index }) => (
              <HaveInput
                key={index}
                name={line.name}
                quantity={quantity}
                value={line.have[index] ?? null}
                onChange={(value) =>
                  onChange({ ...line, have: line.have.map((h, i) => (i === index ? value : h)) })
                }
              />
            ))
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Have some ${line.name}`}
              hitSlop={8}
              onPress={() => setOpen(true)}
              style={styles.linkButton}>
              <ThemedText type="small" style={{ color: theme.tint }}>
                Have some
              </ThemedText>
            </Pressable>
          )}
          {partial && (
            <ThemedText type="small" themeColor="attention">
              {left.length ? `Buy ${amountText(left)}` : 'You have enough'}
            </ThemedText>
          )}
        </View>
      )}
    </View>
  );
}

/** How much she has, in the same unit as the recipe needs. */
function HaveInput({
  name,
  quantity,
  value,
  onChange,
}: {
  name: string;
  quantity: Quantity;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const theme = useTheme();
  const [text, setText] = useState(value === null ? '' : formatAmount(value));
  const unit = quantity.unit ? unitLabel(quantity.unit, value ?? 2) : '';
  const invalid = text.trim() !== '' && parseAmountRange(text)?.quantity == null;

  function change(next: string) {
    setText(next);
    if (!next.trim()) return onChange(null);
    const parsed = parseAmountRange(next);
    if (parsed?.quantity != null) onChange(parsed.quantity);
  }

  return (
    <View style={styles.haveRow}>
      <ThemedText type="small">Have</ThemedText>
      <TextInput
        accessibilityLabel={`Amount of ${name} you have${unit ? ` in ${unit}` : ''}`}
        testID={`have-${name}`}
        value={text}
        onChangeText={change}
        placeholder="0"
        placeholderTextColor={theme.textSecondary}
        keyboardType="default"
        autoCorrect={false}
        style={[
          styles.haveInput,
          { color: theme.text, borderColor: invalid ? theme.danger : theme.border },
        ]}
      />
      <ThemedText type="small">
        {unit} of {formatQuantity(quantity)}
      </ThemedText>
    </View>
  );
}

function ReadyList({
  list,
  stores,
  addItem,
  onChange,
  onBack,
}: {
  list: ShoppingList;
  stores: Store[];
  addItem: ReactNode;
  onChange: (list: ShoppingList) => void;
  onBack: () => void;
}) {
  const [hideChecked, setHideChecked] = useState(false);
  const groups = groupReadyList(list, stores);
  const lines = new Map(list.lines.map((l) => [l.key, l]));
  const items = groups.flatMap((g) => g.sections.flatMap((s) => s.items));
  const checked = items.filter((i) => lines.get(i.ingredientId)?.checked).length;
  const showing = (key: string) => !(hideChecked && lines.get(key)?.checked);

  function toggle(key: string) {
    onChange({
      ...list,
      lines: list.lines.map((l) => (l.key === key ? { ...l, checked: !l.checked } : l)),
    });
  }

  return (
    <>
      <ThemedText type="small" themeColor="textSecondary">
        {items.length === 0
          ? 'Nothing left to buy.'
          : checked === 0
            ? `${items.length} to buy at ${groups.map((g) => g.storeName).join(', ')}.`
            : `${checked} of ${items.length} in the cart.`}
      </ThemedText>
      <View style={styles.chips}>
        <Chip
          label="Share"
          accessibilityLabel="Share list as text"
          onPress={() => Share.share({ message: listAsText(list, stores) })}
        />
        {checked > 0 && (
          <Chip
            label={`Hide checked (${checked})`}
            accessibilityLabel="Hide checked items"
            selected={hideChecked}
            onPress={() => setHideChecked(!hideChecked)}
          />
        )}
      </View>
      {groups.map((group) => {
        const sections = group.sections
          .map((section) => ({
            ...section,
            items: section.items.filter((i) => showing(i.ingredientId)),
          }))
          .filter((section) => section.items.length > 0);
        if (sections.length === 0) return null;
        return (
          <View key={group.storeId} style={styles.group}>
            <ThemedText type="subtitle" style={styles.storeName} accessibilityRole="header">
              {group.storeName}
            </ThemedText>
            {sections.map((section) => (
              <View key={section.sectionId ?? 'other'}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {section.name}
                </ThemedText>
                {section.items.map((item) => {
                  const line = lines.get(item.ingredientId);
                  const amount = item.quantities.map(formatQuantity).filter(Boolean).join(' + ');
                  const detail = [
                    amount,
                    item.usualStoreName ? `usually from ${item.usualStoreName}` : null,
                    lines.get(item.ingredientId)?.extraId ? 'added by you' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <CheckRow
                      key={item.ingredientId}
                      title={item.name}
                      detail={detail}
                      checked={!!line?.checked}
                      dimWhenChecked
                      onToggle={() => toggle(item.ingredientId)}
                      trailing={
                        line?.manual ? (
                          <RemoveButton
                            name={item.name}
                            onPress={() => onChange(removeLine(list, item.ingredientId))}
                          />
                        ) : null
                      }
                    />
                  );
                })}
              </View>
            ))}
          </View>
        );
      })}
      {hideChecked && checked === items.length && items.length > 0 && (
        <ThemedText themeColor="textSecondary">Everything&apos;s in the cart.</ThemedText>
      )}

      {addItem}
      <Button label="Back to pantry check" variant="secondary" onPress={onBack} />
    </>
  );
}

function RemoveButton({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <IconButton
      icon={{ android: 'close', ios: 'xmark' }}
      label={`Remove ${name}`}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  line: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: Spacing.two,
  },
  haveSome: {
    // Lines up with the item name, past the 24pt checkbox and its gap.
    paddingLeft: 24 + Spacing.three,
    gap: Spacing.two,
  },
  linkButton: {
    alignSelf: 'flex-start',
    minHeight: 32,
    justifyContent: 'center',
  },
  haveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  haveInput: {
    borderWidth: 1,
    borderRadius: 8,
    minWidth: 64,
    minHeight: 44,
    paddingHorizontal: Spacing.two,
    fontSize: 16,
  },
  storeName: {
    fontSize: 22,
    lineHeight: 28,
    marginTop: Spacing.two,
  },
});
