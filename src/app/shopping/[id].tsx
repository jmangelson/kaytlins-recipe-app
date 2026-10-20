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
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { CategoryId } from '@/features/ingredients/categories';
import { canonicalName, type Ingredient } from '@/features/ingredients/ingredient-model';
import {
  addNoteToRecipeLines,
  listIngredients,
  mergeIngredients,
  renameIngredient,
  saveIngredient,
} from '@/features/ingredients/ingredient-repo';
import {
  droppedWords,
  ingredientNameKey,
  parseAmountRange,
} from '@/features/ingredients/parse-ingredient-line';
import { formatAmount, formatQuantity, type Quantity } from '@/features/ingredients/quantity';
import { unitLabel } from '@/features/ingredients/units';
import { useHousehold } from '@/features/session/session-provider';
import { addExtraItem } from '@/features/shopping/add-extra';
import { AddItem, type NewItem } from '@/features/shopping/add-item';
import { CheckRow } from '@/features/shopping/check-row';
import { deleteExtraItem, listExtraItems, saveExtraItem } from '@/features/shopping/extra-repo';
import { FixAisle, type AisleFix } from '@/features/shopping/fix-aisle';
import { FixChooser, NameNotes, PickOther, type FixAction } from '@/features/shopping/fix-item';
import { MergeItems } from '@/features/shopping/merge-items';
import {
  extraItemFromLine,
  groupReadyList,
  listAsText,
  placeLines,
  remaining,
  mergeLines,
  removeLine,
  replaceAtStore,
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
import { moveCategoryToSection } from '@/features/stores/store-edit';
import { listStores, saveStore } from '@/features/stores/store-repo';
import type { Store } from '@/features/stores/store-types';
import { useAsync } from '@/hooks/use-async';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
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
  stores: loadedStores,
  ingredients,
}: {
  householdId: string;
  initial: ShoppingList;
  stores: Store[];
  ingredients: Map<string, Ingredient>;
}) {
  // The pantry check and the name are a draft until Save (Back asks first).
  // In the store, checking items off and adding or removing items save
  // right away (`commit`), so nothing ticked is ever lost.
  const [list, setList] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [known, setKnown] = useState(ingredients);
  // A fix in the store can move a whole category in that store's layout.
  const [stores, setStores] = useState(loadedStores);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const dirty = JSON.stringify(list) !== JSON.stringify(saved);

  /**
   * Hand-added items stay on future lists until checked off: checking one
   * off (or removing it) clears it, and unchecking puts it back.
   */
  function syncExtras(before: ShoppingList, after: ShoppingList) {
    const was = new Map(before.lines.filter((l) => l.extraId).map((l) => [l.key, l]));
    const now = new Map(after.lines.filter((l) => l.extraId).map((l) => [l.key, l]));
    for (const [key, line] of was) {
      if (!now.has(key)) deleteExtraItem(householdId, line.extraId!);
    }
    for (const [key, line] of now) {
      const before = was.get(key);
      if (line.checked && before && !before.checked) {
        deleteExtraItem(householdId, line.extraId!);
      } else if (!line.checked && (!before || before.checked)) {
        const item = extraItemFromLine(line);
        if (item) saveExtraItem(householdId, item);
      }
    }
  }

  async function commit(next: ShoppingList) {
    syncExtras(saved, next);
    setList(next);
    setSaved(next);
    await saveShoppingList(householdId, next);
  }

  async function save(): Promise<boolean> {
    if (!list.name.trim()) {
      Alert.alert('Name the list', 'Give the list a name before saving.');
      return false;
    }
    setSaving(true);
    await commit({ ...list, name: list.name.trim() });
    setSaving(false);
    return true;
  }
  const leave = useUnsavedChanges(dirty, save);

  // Switching between the pantry check and the list saves and starts at the top.
  function switchTo(next: ShoppingList) {
    commit(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  function addItem(text: string, item: Ingredient | NewItem) {
    const added = addExtraItem(householdId, text, item);
    if (!added) return;
    const nextKnown = new Map(known).set(added.ingredient.id, added.ingredient);
    setKnown(nextKnown);
    const next = withExtras(list, [added.extra], nextKnown, stores);
    if (list.status !== 'pantry') commit(next);
    else setList(next);
  }

  /**
   * Two list items that are the same: one ingredient everywhere (recipes
   * follow; words the name drops go to recipe notes), one line on this list.
   */
  async function mergeItems(keepKey: string, dropKey: string, name: string, category: CategoryId) {
    const keepLine = list.lines.find((l) => l.key === keepKey);
    const dropLine = list.lines.find((l) => l.key === dropKey);
    if (!keepLine || !dropLine) return;
    const nextKnown = new Map(known);
    const keepIng = keepLine.ingredientId ? known.get(keepLine.ingredientId) : undefined;
    const dropIng = dropLine.ingredientId ? known.get(dropLine.ingredientId) : undefined;
    const finalName = canonicalName(name);
    if (keepIng) {
      for (const ing of [keepIng, dropIng]) {
        const dropped = ing ? droppedWords(ing.name, finalName) : null;
        if (ing && dropped) await addNoteToRecipeLines(householdId, ing.id, dropped);
      }
      let target = keepIng;
      if (dropIng && dropIng.id !== keepIng.id) {
        await mergeIngredients(householdId, dropIng, keepIng);
        target = { ...keepIng, aliases: [...keepIng.aliases, dropIng.name, ...dropIng.aliases] };
        nextKnown.delete(dropIng.id);
      }
      const finalKey = ingredientNameKey(finalName);
      const final = {
        ...target,
        name: finalName,
        category,
        categorySet: true,
        aliases: target.aliases.filter((a) => ingredientNameKey(a) !== finalKey),
      };
      if (finalName !== keepIng.name) await renameIngredient(householdId, final, keepIng.name);
      else await saveIngredient(householdId, final);
      nextKnown.set(final.id, final);
    }
    setKnown(nextKnown);
    let next = mergeLines(list, keepKey, dropKey, finalName);
    const store = stores.find((s) => s.id === keepLine.storeId);
    if (store) next = { ...next, lines: replaceAtStore(next.lines, store, nextKnown) };
    commit(next);
  }

  /**
   * "Its name or notes": the ingredient's name everywhere (words it drops go
   * to its recipes' notes) and this item's notes on this list.
   */
  async function renameItem(key: string, name: string, notes: string) {
    const line = list.lines.find((l) => l.key === key);
    if (!line) return;
    const finalName = canonicalName(name);
    const ing = line.ingredientId ? known.get(line.ingredientId) : undefined;
    if (ing && finalName !== ing.name) {
      const dropped = droppedWords(ing.name, finalName);
      if (dropped) await addNoteToRecipeLines(householdId, ing.id, dropped);
      const renamed = { ...ing, name: finalName };
      await renameIngredient(householdId, renamed, ing.name);
      setKnown(new Map(known).set(renamed.id, renamed));
    }
    const noteList = notes
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);
    commit({
      ...list,
      lines: list.lines.map((l) =>
        l.key === key ? { ...l, name: finalName, notes: noteList, notesEdited: true } : l
      ),
    });
  }

  /** A final name another ingredient (not these two) already uses. */
  function mergeNameProblem(keepKey: string, dropKey: string, name: string): string | null {
    const ids = new Set(
      [keepKey, dropKey].map((k) => list.lines.find((l) => l.key === k)?.ingredientId)
    );
    const key = ingredientNameKey(name);
    const owner = [...known.values()].find(
      (i) => !ids.has(i.id) && (i.nameKey === key || i.aliasKeys.includes(key))
    );
    return owner ? `“${owner.name}” already uses this name.` : null;
  }

  const addItemField = (
    <AddItem
      ingredients={[...known.values()]}
      stores={stores.filter((s) => !s.hidden)}
      onAdd={addItem}
    />
  );

  function confirmDelete() {
    Alert.alert(`Delete ${saved.name}?`, 'The list is removed from both phones.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteShoppingList(householdId, list.id);
          leave(() => router.back());
        },
      },
    ]);
  }

  // At the top during the pantry check; out of the way at the bottom in the store.
  const nameField = (
    <TextField
      label="List name"
      testID="list-name"
      value={list.name}
      onChangeText={(name) => setList({ ...list, name })}
      maxLength={80}
    />
  );

  return (
    <Screen edges={HEADER_EDGES} scrollRef={scrollRef}>
      <Stack.Screen
        options={{
          title: saved.name,
          headerRight: () => (
            <HeaderButton
              label={saving ? 'Saving…' : 'Save'}
              accessibilityLabel="Save list"
              disabled={!dirty || saving}
              onPress={async () => {
                if (await save()) leave(() => router.back());
              }}
            />
          ),
        }}
      />
      {list.status === 'pantry' && nameField}
      {list.status === 'pantry' ? (
        <PantryCheck
          list={list}
          stores={stores}
          addItem={addItemField}
          dirty={dirty}
          onChange={setList}
          onSave={async () => {
            if (await save()) leave(() => router.back());
          }}
          onDone={() =>
            switchTo({
              ...list,
              name: list.name.trim() || saved.name,
              status: 'ready',
              lines: placeLines(list.lines, known, stores, list.tripStoreIds),
            })
          }
        />
      ) : (
        <ReadyList
          list={list}
          stores={stores}
          ingredients={known}
          onStoreChange={(store) => {
            setStores(stores.map((s) => (s.id === store.id ? store : s)));
            saveStore(householdId, store).catch((error) => console.warn('Store not saved', error));
          }}
          onIngredientChange={(ingredient) => {
            setKnown(new Map(known).set(ingredient.id, ingredient));
            saveIngredient(householdId, ingredient).catch((error) =>
              console.warn('Ingredient not saved', error)
            );
          }}
          addItem={addItemField}
          onChange={commit}
          onMergeItems={mergeItems}
          onRenameItem={renameItem}
          mergeNameProblem={mergeNameProblem}
          onDoneShopping={(finished) => {
            commit({ ...finished, status: 'done' });
            router.back();
          }}
          onBack={() => switchTo({ ...list, status: 'pantry' })}
        />
      )}
      {list.status !== 'pantry' && nameField}
      <Button label="Delete list" variant="danger" onPress={confirmDelete} />
    </Screen>
  );
}

function PantryCheck({
  list,
  stores,
  addItem,
  dirty,
  onChange,
  onSave,
  onDone,
}: {
  list: ShoppingList;
  stores: Store[];
  addItem: ReactNode;
  dirty: boolean;
  onSave: () => void;
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
        <Button label="Save list" variant="secondary" onPress={onSave} disabled={!dirty} />
        <ThemedText type="small" themeColor="textSecondary">
          Save list keeps your answers so you can finish the pantry check later. Make list saves
          too.
        </ThemedText>
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
  ingredients,
  onIngredientChange,
  onStoreChange,
  onMergeItems,
  onRenameItem,
  mergeNameProblem,
  addItem,
  onChange,
  onDoneShopping,
  onBack,
}: {
  list: ShoppingList;
  stores: Store[];
  ingredients: Map<string, Ingredient>;
  onIngredientChange: (ingredient: Ingredient) => void;
  onStoreChange: (store: Store) => void;
  onMergeItems: (keepKey: string, dropKey: string, name: string, category: CategoryId) => void;
  onRenameItem: (key: string, name: string, notes: string) => void;
  mergeNameProblem: (keepKey: string, dropKey: string, name: string) => string | null;
  addItem: ReactNode;
  onChange: (list: ShoppingList) => void;
  /** Gets the list as it is after the last check (not this render's copy). */
  onDoneShopping: (list: ShoppingList) => void;
  onBack: () => void;
}) {
  const [hideChecked, setHideChecked] = useState(false);
  // "Fix an item": she picks one item, says what's wrong, and fixes it.
  const [pickingFix, setPickingFix] = useState(false);
  const [fixingKey, setFixingKey] = useState<string | null>(null);
  const [fixAction, setFixAction] = useState<FixAction | null>(null);
  // Merging: the other item she tapped.
  const [mergeWith, setMergeWith] = useState<string | null>(null);
  function endFix() {
    setPickingFix(false);
    setFixingKey(null);
    setFixAction(null);
    setMergeWith(null);
  }
  const groups = groupReadyList(list, stores);
  const lines = new Map(list.lines.map((l) => [l.key, l]));
  const items = groups.flatMap((g) => g.sections.flatMap((s) => s.items));
  const checked = items.filter((i) => lines.get(i.ingredientId)?.checked).length;
  const showing = (key: string) => !(hideChecked && lines.get(key)?.checked);

  function toggle(key: string) {
    const wasChecked = !!lines.get(key)?.checked;
    const next: ShoppingList = {
      ...list,
      // Unchecking something on a finished trip opens it again.
      status: wasChecked && list.status === 'done' ? 'ready' : list.status,
      lines: list.lines.map((l) => (l.key === key ? { ...l, checked: !l.checked } : l)),
    };
    onChange(next);
    const allChecked = items.every((i) =>
      i.ingredientId === key ? !wasChecked : lines.get(i.ingredientId)?.checked
    );
    if (!wasChecked && allChecked && list.status !== 'done') {
      Alert.alert('Everything’s in the cart', 'Done shopping, or are a few more things needed?', [
        { text: 'Need more items', style: 'cancel' },
        { text: 'Done shopping', onPress: () => onDoneShopping(next) },
      ]);
    }
  }

  /** Done shopping from the button: asks first if anything isn't checked. */
  function finish() {
    const left = items.filter((i) => !lines.get(i.ingredientId)?.checked).length;
    if (left === 0) {
      onDoneShopping(list);
      return;
    }
    Alert.alert(
      'Finish the trip?',
      `${left} ${left === 1 ? 'item isn’t' : 'items aren’t'} checked off. Finish anyway?`,
      [
        { text: 'Keep shopping', style: 'cancel' },
        { text: 'Finish trip', onPress: () => onDoneShopping(list) },
      ]
    );
  }

  function tapItem(key: string) {
    if (pickingFix) {
      setPickingFix(false);
      setFixingKey(key);
      setFixAction(null);
    } else if (fixAction === 'merge' && !mergeWith && key !== fixingKey) {
      setMergeWith(key);
    } else toggle(key);
  }

  /**
   * Saves the fix (to the ingredient, or the store's layout) and puts the
   * list's lines at that store where they now belong.
   */
  function applyFix(key: string, store: Store, fix: AisleFix) {
    let nextIngredients = ingredients;
    let nextStore = store;
    const changeIngredient = (ingredient: Ingredient) => {
      onIngredientChange(ingredient);
      nextIngredients = new Map(ingredients).set(ingredient.id, ingredient);
    };
    if (fix.kind === 'category') changeIngredient(fix.ingredient);
    if (fix.kind === 'categoryArea') {
      nextStore = {
        ...store,
        sections: moveCategoryToSection(store.sections, fix.categoryId, fix.sectionId),
      };
      onStoreChange(nextStore);
    }
    if (fix.kind === 'itemArea' && fix.ingredient) {
      changeIngredient({
        ...fix.ingredient,
        areaOverrides: { ...fix.ingredient.areaOverrides, [store.id]: fix.sectionId },
      });
    }
    const lines =
      fix.kind === 'itemArea' && !fix.ingredient
        ? list.lines.map((l) => (l.key === key ? { ...l, sectionId: fix.sectionId } : l))
        : replaceAtStore(list.lines, nextStore, nextIngredients);
    onChange({ ...list, lines });
    endFix();
  }

  return (
    <>
      <ThemedText type="small" themeColor="textSecondary">
        {items.length === 0
          ? 'Nothing left to buy.'
          : checked === 0
            ? `${items.length} to buy at ${groups.map((g) => g.storeName).join(', ')}.`
            : `${checked} of ${items.length} in the cart.`}{' '}
        Checked items save as you go.
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
        <Chip
          label={pickingFix || fixingKey ? 'Cancel fix' : 'Fix an item'}
          accessibilityLabel={pickingFix || fixingKey ? 'Cancel fixing an item' : 'Fix an item'}
          selected={pickingFix || !!fixingKey}
          onPress={() => {
            if (pickingFix || fixingKey) endFix();
            else setPickingFix(true);
          }}
        />
      </View>
      {pickingFix && <ThemedText themeColor="attention">Tap the item to fix.</ThemedText>}
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
                  const store = stores.find((s) => s.id === group.storeId)!;
                  return (
                    <View key={item.ingredientId}>
                      <CheckRow
                        title={item.name}
                        detail={detail}
                        note={
                          item.notes?.length
                            ? `${line?.notesEdited ? 'Notes' : 'Recipe notes'}: ${item.notes.join(', ')}`
                            : null
                        }
                        checked={!!line?.checked}
                        dimWhenChecked
                        onToggle={() => tapItem(item.ingredientId)}
                        trailing={
                          line?.manual ? (
                            <RemoveButton
                              name={item.name}
                              onPress={() => onChange(removeLine(list, item.ingredientId))}
                            />
                          ) : null
                        }
                      />
                      {fixingKey === item.ingredientId && fixAction === null && (
                        <FixChooser name={item.name} onChoose={setFixAction} onCancel={endFix} />
                      )}
                      {fixingKey === item.ingredientId && fixAction === 'aisle' && (
                        <FixAisle
                          name={item.name}
                          ingredient={
                            line?.ingredientId ? (ingredients.get(line.ingredientId) ?? null) : null
                          }
                          store={store}
                          sectionId={item.sectionId}
                          onFix={(fix) => applyFix(item.ingredientId, store, fix)}
                          onCancel={endFix}
                        />
                      )}
                      {fixingKey === item.ingredientId && fixAction === 'merge' && !mergeWith && (
                        <PickOther name={item.name} onCancel={endFix} />
                      )}
                      {fixingKey === item.ingredientId && fixAction === 'merge' && mergeWith && (
                        <MergeItems
                          key={mergeWith}
                          first={{ name: item.name }}
                          second={{ name: lines.get(mergeWith)?.name ?? '' }}
                          firstIngredient={ingredients.get(line?.ingredientId ?? '') ?? null}
                          nameProblem={(name) =>
                            mergeNameProblem(item.ingredientId, mergeWith, name)
                          }
                          onMerge={(name, category) => {
                            onMergeItems(item.ingredientId, mergeWith, name, category);
                            endFix();
                          }}
                          onCancel={endFix}
                        />
                      )}
                      {fixingKey === item.ingredientId && fixAction === 'name' && (
                        <NameNotes
                          name={item.name}
                          notes={(line?.notes ?? []).join(', ')}
                          nameProblem={(name) =>
                            mergeNameProblem(item.ingredientId, item.ingredientId, name)
                          }
                          onSave={(name, notes) => {
                            onRenameItem(item.ingredientId, name, notes);
                            endFix();
                          }}
                          onCancel={endFix}
                        />
                      )}
                    </View>
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
      {list.status === 'done' ? (
        <ThemedText themeColor="textSecondary">
          This trip is finished. Uncheck an item to keep shopping.
        </ThemedText>
      ) : (
        <Button
          label="Done shopping"
          variant={items.length > 0 && checked === items.length ? 'primary' : 'secondary'}
          onPress={finish}
        />
      )}
      <Button label="Back to pantry check" variant="secondary" onPress={onBack} />
      <Button
        label="Make a packing list"
        variant="secondary"
        onPress={() => router.push({ pathname: '/packing/new', params: { fromList: list.id } })}
      />
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
