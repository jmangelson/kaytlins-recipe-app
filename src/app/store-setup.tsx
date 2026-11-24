import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { DraggableList } from '@/components/draggable-list';
import { IconButton } from '@/components/icon-button';
import { ErrorScreen, LoadingScreen } from '@/components/loading-screen';
import { Screen, useRevealOnFocus } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  categoriesByDepartment,
  categoryName,
  type CategoryId,
} from '@/features/ingredients/categories';
import { useHousehold } from '@/features/session/session-provider';
import { moveCategoryToSection, nameProblem } from '@/features/stores/store-edit';
import { listStores, newId, saveStore } from '@/features/stores/store-repo';
import {
  nextAisleName,
  sectionsFromTemplate,
  STORE_TEMPLATES,
  suggestTemplate,
  type StoreTemplate,
} from '@/features/stores/store-templates';
import type { Store, StoreSection } from '@/features/stores/store-types';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];
const STEPS = ['Store', 'Areas', 'Sort', 'Review'] as const;
/** Common areas offered as one-tap additions. */
const QUICK_AREAS = ['Produce', 'Bakery', 'Deli', 'Meat & seafood', 'Dairy', 'Frozen', 'Pharmacy'];

type Layout = StoreTemplate['id'] | 'keep';

/**
 * Walks her through setting up a store: what kind of store it is (a
 * starting layout tuned to how those stores are arranged), its areas in
 * walking order, which area holds each kind of food, then a review.
 *   /store-setup          a new store
 *   /store-setup?id=…     redo an existing store's layout
 */
export default function StoreSetupScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { household } = useHousehold();
  const data = useAsync(() => listStores(household.id), [household.id]);

  if (data.state.status === 'loading') return <LoadingScreen label="Loading stores" />;
  if (data.state.status === 'error') {
    return (
      <ErrorScreen message={`Couldn't load stores. ${data.state.message}`} onRetry={data.reload} />
    );
  }
  const stores = data.state.data;
  const existing = id ? (stores.find((s) => s.id === id) ?? null) : null;
  if (id && !existing) return <ErrorScreen message="This store no longer exists." />;
  return <Setup householdId={household.id} stores={stores} existing={existing} />;
}

function Setup({
  householdId,
  stores,
  existing,
}: {
  householdId: string;
  stores: Store[];
  existing: Store | null;
}) {
  const theme = useTheme();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(existing?.name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [layout, setLayout] = useState<Layout | null>(existing ? 'keep' : null);
  // The layout the areas came from, so going back and changing it starts over.
  const [areasFrom, setAreasFrom] = useState<Layout | null>(null);
  const [sections, setSections] = useState<StoreSection[]>(existing?.sections ?? []);
  const [reordering, setReordering] = useState(false);
  const [newArea, setNewArea] = useState('');
  const [openCategory, setOpenCategory] = useState<CategoryId | null>(null);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  function goTo(nextStep: number) {
    setReordering(false);
    setOpenCategory(null);
    setStep(nextStep);
    // Each step starts at its top, not where the Next button was.
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  const suggested = suggestTemplate(name);
  const chosen: Layout = layout ?? suggested;
  const areaOf = new Map<CategoryId, StoreSection>();
  for (const section of sections) {
    for (const categoryId of section.categoryIds) areaOf.set(categoryId, section);
  }
  const groups = categoriesByDepartment().filter((g) => g.categories.length > 0);
  const unsorted = groups.flatMap((g) => g.categories).filter((c) => !areaOf.has(c.id));

  function next() {
    if (step === 0) {
      const problem = nameProblem(
        name,
        stores.filter((s) => s.id !== existing?.id).map((s) => s.name),
        'store',
        60
      );
      setNameError(problem);
      if (problem) return;
      if (areasFrom !== chosen) {
        if (chosen !== 'keep') {
          setSections(sectionsFromTemplate(STORE_TEMPLATES.find((t) => t.id === chosen)!));
        } else {
          setSections(existing?.sections ?? []);
        }
        setAreasFrom(chosen);
      }
    }
    goTo(Math.min(step + 1, STEPS.length - 1));
  }

  function addArea(areaName: string) {
    const trimmed = areaName.trim();
    if (!trimmed) return;
    setSections((current) => [
      ...current,
      { id: newId('area'), name: trimmed, order: current.length, categoryIds: [] },
    ]);
    setNewArea('');
  }

  async function finish() {
    setSaving(true);
    const store: Store = {
      id: existing?.id ?? newId('store'),
      name: name.trim(),
      order: existing?.order ?? stores.length,
      hidden: existing?.hidden ?? false,
      sections: sections.filter((s) => s.name.trim()),
    };
    await saveStore(householdId, store);
    router.replace({ pathname: '/store/[id]', params: { id: store.id } });
  }

  return (
    <Screen edges={HEADER_EDGES} scrollRef={scrollRef}>
      <Stack.Screen options={{ title: existing ? 'Redo store layout' : 'Set up a store' }} />
      <ThemedText type="smallBold" themeColor="tint">
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
      </ThemedText>

      {step === 0 && (
        <>
          <TextField
            label="Store name"
            testID="setup-store-name"
            value={name}
            onChangeText={(v) => {
              setName(v);
              setNameError(null);
            }}
            placeholder="e.g. Smith's on Main"
            maxLength={60}
            error={nameError ?? undefined}
          />
          <View style={styles.group}>
            <ThemedText type="smallBold" accessibilityRole="header">
              What kind of store is it?
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              It starts with the areas stores like it usually have, in the order you walk them.
              You’ll adjust them next.
            </ThemedText>
            {existing && (
              <LayoutCard
                title="Keep its current areas"
                description={`${existing.sections.length} areas; just re-check them and how food is sorted.`}
                selected={chosen === 'keep'}
                onPress={() => setLayout('keep')}
              />
            )}
            {STORE_TEMPLATES.map((template) => (
              <LayoutCard
                key={template.id}
                title={template.name}
                description={template.description}
                badge={!existing && template.id === suggested && name.trim() ? 'Suggested' : null}
                selected={chosen === template.id}
                onPress={() => setLayout(template.id)}
              />
            ))}
            {existing && chosen !== 'keep' && (
              <ThemedText type="small" themeColor="attention">
                This replaces {existing.name}’s areas with the new layout.
              </ThemedText>
            )}
          </View>
        </>
      )}

      {step === 1 && (
        <View style={styles.group}>
          <View style={styles.row}>
            <ThemedText type="smallBold" accessibilityRole="header" style={styles.flex}>
              Areas in walking order
            </ThemedText>
            {sections.length > 1 && (
              <Chip
                label={reordering ? 'Done' : 'Reorder'}
                accessibilityLabel={reordering ? 'Done reordering' : 'Reorder areas'}
                selected={reordering}
                onPress={() => setReordering(!reordering)}
              />
            )}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Picture walking in the entrance. Rename areas to match the signs (add aisle numbers,
            like “Aisle 7 · Canned goods”), remove ones this store doesn’t have, and add any that
            are missing.
          </ThemedText>
          {reordering ? (
            <DraggableList
              items={sections}
              keyOf={(section) => section.id}
              labelOf={(section) => section.name}
              onReorder={setSections}
              renderRow={(section, index) => (
                <>
                  <ThemedText themeColor="textSecondary" style={styles.position}>
                    {index + 1}
                  </ThemedText>
                  <ThemedText numberOfLines={2} style={styles.flex}>
                    {section.name}
                  </ThemedText>
                </>
              )}
            />
          ) : (
            sections.map((section, index) => (
              <View key={section.id} style={styles.row}>
                <ThemedText themeColor="textSecondary" style={styles.position}>
                  {index + 1}
                </ThemedText>
                <AreaNameInput
                  label={`Area ${index + 1} name`}
                  value={section.name}
                  onChange={(v) =>
                    setSections((current) =>
                      current.map((s) => (s.id === section.id ? { ...s, name: v } : s))
                    )
                  }
                />
                <IconButton
                  icon={{ android: 'close', ios: 'xmark' }}
                  label={`Remove ${section.name || `area ${index + 1}`}`}
                  onPress={() =>
                    setSections((current) => current.filter((s) => s.id !== section.id))
                  }
                />
              </View>
            ))
          )}
          {sections.length === 0 && (
            <ThemedText themeColor="textSecondary">
              No areas yet. Add the first one you reach from the entrance.
            </ThemedText>
          )}
          {!reordering && (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                Add an area
              </ThemedText>
              <View style={styles.chips}>
                <Chip
                  label={nextAisleName(sections)}
                  accessibilityLabel={`Add ${nextAisleName(sections)}`}
                  onPress={() => addArea(nextAisleName(sections))}
                />
                {QUICK_AREAS.filter(
                  (q) => !sections.some((s) => s.name.toLowerCase() === q.toLowerCase())
                ).map((quick) => (
                  <Chip
                    key={quick}
                    label={quick}
                    accessibilityLabel={`Add ${quick}`}
                    onPress={() => addArea(quick)}
                  />
                ))}
              </View>
              <TextField
                label="Or name one"
                testID="setup-new-area"
                value={newArea}
                onChangeText={setNewArea}
                placeholder="e.g. Bulk foods"
                maxLength={60}
              />
              <Button
                label="Add area"
                variant="secondary"
                onPress={() => addArea(newArea)}
                disabled={!newArea.trim()}
              />
            </>
          )}
        </View>
      )}

      {step === 2 && (
        <View style={styles.group}>
          <ThemedText type="smallBold" accessibilityRole="header">
            Which area holds each kind of food?
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Tap a kind of food to move it to another area.{' '}
            {unsorted.length === 0
              ? 'Everything has an area.'
              : `${unsorted.length} not sorted yet; on lists they go under “Other” at the end.`}
          </ThemedText>
          {groups.map(({ department, categories }) => (
            <View key={department.id} style={styles.group}>
              <ThemedText type="small" themeColor="textSecondary">
                {department.name}
              </ThemedText>
              {categories.map((category) => {
                const area = areaOf.get(category.id);
                const open = openCategory === category.id;
                return (
                  <View
                    key={category.id}
                    style={[styles.category, { borderColor: open ? theme.tint : theme.border }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${category.name}, in ${area?.name ?? 'no area'}`}
                      onPress={() => setOpenCategory(open ? null : category.id)}
                      style={styles.categoryRow}>
                      <ThemedText style={styles.flex}>{category.name}</ThemedText>
                      <ThemedText
                        type="small"
                        themeColor={area ? 'textSecondary' : 'attention'}
                        style={styles.areaLabel}>
                        {area?.name ?? 'Not sorted'}
                      </ThemedText>
                    </Pressable>
                    {open && (
                      <View style={styles.chips}>
                        {sections.map((section) => (
                          <Chip
                            key={section.id}
                            wrap
                            label={section.name || 'Unnamed area'}
                            accessibilityLabel={`Move ${category.name} to ${section.name}`}
                            selected={area?.id === section.id}
                            onPress={() => {
                              setSections((current) =>
                                moveCategoryToSection(current, category.id, section.id)
                              );
                              setOpenCategory(null);
                            }}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}

      {step === 3 && (
        <View style={styles.group}>
          <ThemedText type="smallBold" accessibilityRole="header">
            {name.trim()}: {sections.length} areas
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Shopping lists will follow this order. You can change any of it later from the store.
          </ThemedText>
          {sections.map((section, index) => (
            <View key={section.id} style={[styles.review, { borderBottomColor: theme.border }]}>
              <ThemedText>
                {index + 1}. {section.name || 'Unnamed area'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {section.categoryIds.length
                  ? section.categoryIds.map(categoryName).join(', ')
                  : 'Nothing sorted here yet'}
              </ThemedText>
            </View>
          ))}
          {unsorted.length > 0 && (
            <ThemedText type="small" themeColor="attention">
              Not sorted: {unsorted.map((c) => c.name).join(', ')}
            </ThemedText>
          )}
        </View>
      )}

      <View style={styles.nav}>
        {step > 0 && (
          <View style={styles.flex}>
            <Button label="Back" variant="secondary" onPress={() => goTo(step - 1)} />
          </View>
        )}
        <View style={styles.flex}>
          {step < STEPS.length - 1 ? (
            <Button label="Next" onPress={next} disabled={reordering} />
          ) : (
            <Button label="Save store" onPress={finish} disabled={saving} />
          )}
        </View>
      </View>
    </Screen>
  );
}

/** One area's name, editable in place (a compact field in the list). */
function AreaNameInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const theme = useTheme();
  const field = useRevealOnFocus();
  return (
    <TextInput
      accessibilityLabel={label}
      value={value}
      onChangeText={onChange}
      onFocus={field.onFocus}
      onBlur={field.onBlur}
      maxLength={60}
      placeholder="Area name"
      placeholderTextColor={theme.textSecondary}
      style={[
        styles.areaInput,
        { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement },
      ]}
    />
  );
}

function LayoutCard({
  title,
  description,
  selected,
  badge = null,
  onPress,
}: {
  title: string;
  description: string;
  selected: boolean;
  badge?: string | null;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={title}
      onPress={onPress}
      style={[
        styles.card,
        {
          borderColor: selected ? theme.tint : theme.border,
          backgroundColor: selected ? theme.backgroundElement : undefined,
        },
      ]}>
      <View style={styles.row}>
        <ThemedText type="smallBold" style={styles.flex}>
          {title}
        </ThemedText>
        {badge && (
          <ThemedText type="small" themeColor="tint">
            {badge}
          </ThemedText>
        )}
        {selected && (
          <ThemedText type="smallBold" themeColor="tint">
            ✓
          </ThemedText>
        )}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {description}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  position: {
    width: 24,
    textAlign: 'right',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  category: {
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 40,
  },
  areaInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  areaLabel: {
    maxWidth: '50%',
    textAlign: 'right',
  },
  review: {
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.half,
  },
  nav: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
