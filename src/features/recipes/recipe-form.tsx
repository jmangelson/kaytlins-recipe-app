import { Image } from 'expo-image';
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Ingredient } from '@/features/ingredients/ingredient-model';
import { IngredientRowsEditor } from '@/features/recipes/ingredient-rows-editor';
import { validateDraft, type DraftErrors } from '@/features/recipes/recipe-draft';
import { newRecipePhotoId, type RecipePhoto } from '@/features/recipes/recipe-repo';
import { pickScanPages } from '@/features/scan/scan-photos';
import { useHousehold } from '@/features/session/session-provider';
import type { RecipeDraft } from '@/features/recipes/recipe-types';
import type { Tag } from '@/features/stores/store-types';
import {
  missingGroups,
  missingGroupsMessage,
  TAG_GROUPS,
  tagsByGroup,
} from '@/features/stores/tag-groups';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';

/** Photos per recipe (each is its own ~300 KB document). */
const MAX_PHOTOS = 10;
const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

type RecipeFormProps = {
  initialDraft: RecipeDraft;
  /** Her photos when editing, or the scanned pages for a new scanned recipe. */
  initialPhotos: RecipePhoto[];
  tags: Tag[];
  /** Her canonical ingredient list, for matching and picking. */
  ingredients: Ingredient[];
  saveLabel: string;
  onSave: (draft: RecipeDraft, photos: RecipePhoto[]) => Promise<void>;
  /** Shown above the fields (the scan button, or what a scan noticed). */
  header?: ReactNode;
  /** The starting draft isn't saved anywhere yet (a scan), so Back asks. */
  unsavedFromStart?: boolean;
};

export function RecipeForm({
  initialDraft,
  initialPhotos,
  tags,
  ingredients,
  saveLabel,
  onSave,
  header,
  unsavedFromStart = false,
}: RecipeFormProps) {
  const [draft, setDraft] = useState(initialDraft);
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const { household } = useHousehold();
  const theme = useTheme();
  const [photos, setPhotos] = useState(initialPhotos);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const hasErrors = Object.values(errors).some(Boolean);
  const tagGroups = tagsByGroup(tags);

  function update<K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    const errorKey = key === 'rows' ? 'ingredients' : key;
    if (errorKey in errors) setErrors((e) => ({ ...e, [errorKey]: undefined }));
  }

  function toggleTag(id: string) {
    update(
      'tagIds',
      draft.tagIds.includes(id) ? draft.tagIds.filter((t) => t !== id) : [...draft.tagIds, id]
    );
  }

  async function addPhotos(source: 'camera' | 'library') {
    setPhotoError(null);
    try {
      const picked = await pickScanPages(source, MAX_PHOTOS - photos.length);
      setPhotos((p) => [
        ...p,
        ...picked.map((page) => ({
          id: newRecipePhotoId(household.id),
          jpegBase64: page.base64,
          isNew: true,
        })),
      ]);
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : "Couldn't add that photo.");
    }
  }

  function save() {
    const found = validateDraft(draft);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    // Type, Course, and Meal are encouraged, not required.
    const missing = missingGroups(draft.tagIds, tags);
    if (missing.length === 0) {
      saveNow();
      return;
    }
    Alert.alert(
      missingGroupsMessage(missing),
      'Course and Meal help meal plans suggest recipes. You can add them later.',
      [
        { text: 'Go back', style: 'cancel' },
        { text: 'Save anyway', onPress: saveNow },
      ]
    );
  }

  async function saveNow() {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(draft, photos);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Saving failed. Please try again.');
      setSaving(false);
    }
  }

  // Back asks before dropping changes. Its Save runs the normal save (which
  // may stop for errors or the tag question) instead of leaving right away.
  // While saving, onSave navigates away itself.
  const dirty =
    !saving &&
    (unsavedFromStart ||
      JSON.stringify(draft) !== JSON.stringify(initialDraft) ||
      photos.map((p) => p.id).join() !== initialPhotos.map((p) => p.id).join());
  useUnsavedChanges(dirty, async () => {
    save();
    return false;
  });

  return (
    <Screen
      edges={HEADER_EDGES}
      scrollRef={scrollRef}
      // ScrollView types this ref as never-null; it's only read after mount.
      innerViewRef={contentRef as RefObject<View>}>
      {header}
      <TextField
        label="Recipe name"
        testID="recipe-name"
        value={draft.name}
        onChangeText={(v) => update('name', v)}
        placeholder="e.g. Chicken enchiladas"
        maxLength={120}
        error={errors.name}
      />
      <TextField
        label="Servings"
        testID="recipe-servings"
        value={draft.servings}
        onChangeText={(v) => update('servings', v)}
        keyboardType="number-pad"
        maxLength={3}
        error={errors.servings}
      />

      {TAG_GROUPS.map((group) =>
        tagGroups[group.id].length === 0 ? null : (
          <View key={group.id} style={styles.group}>
            <View style={styles.groupHeader}>
              <ThemedText type="smallBold" accessibilityRole="header">
                {group.name}
              </ThemedText>
              {!tagGroups[group.id].some((t) => draft.tagIds.includes(t.id)) && (
                <ThemedText type="small" themeColor="attention">
                  Not set
                </ThemedText>
              )}
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {group.hint}
            </ThemedText>
            <View style={styles.tags}>
              {tagGroups[group.id].map((tag) => (
                <Chip
                  key={tag.id}
                  label={tag.name}
                  selected={draft.tagIds.includes(tag.id)}
                  onPress={() => toggleTag(tag.id)}
                />
              ))}
            </View>
          </View>
        )
      )}

      <IngredientRowsEditor
        rows={draft.rows}
        onChange={(rows) => update('rows', rows)}
        ingredients={ingredients}
        error={errors.ingredients}
        scrollRef={scrollRef}
        contentRef={contentRef}
      />

      <TextField
        label="Notes or source"
        testID="recipe-notes"
        hint="Optional, like “Grandma’s card” or a cookbook page."
        value={draft.notes}
        onChangeText={(v) => update('notes', v)}
        multiline
        maxLength={5000}
      />

      <View style={styles.group}>
        <ThemedText type="smallBold">Photos</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Optional. The finished dish, or the directions to read while cooking.
        </ThemedText>
        {photos.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoRow}>
            {photos.map((photo, index) => (
              <View key={photo.id} style={styles.photoBox}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${photo.jpegBase64}` }}
                  style={[styles.photo, { borderColor: theme.border }]}
                  contentFit="cover"
                  accessibilityLabel={`Photo ${index + 1}`}
                />
                <IconButton
                  icon={{ android: 'close', ios: 'xmark' }}
                  label={`Remove photo ${index + 1}`}
                  onPress={() => setPhotos((p) => p.filter((x) => x.id !== photo.id))}
                />
              </View>
            ))}
          </ScrollView>
        )}
        {photos.length < MAX_PHOTOS ? (
          <>
            <Button label="Take photo" variant="secondary" onPress={() => addPhotos('camera')} />
            <Button
              label="Choose photos"
              variant="secondary"
              onPress={() => addPhotos('library')}
            />
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            That’s the most photos for one recipe ({MAX_PHOTOS}).
          </ThemedText>
        )}
        {photoError && (
          <ThemedText type="small" themeColor="danger">
            {photoError}
          </ThemedText>
        )}
      </View>

      {/* Save sits at the bottom; field errors may be scrolled out of view. */}
      {hasErrors && (
        <ThemedText themeColor="danger" accessibilityLiveRegion="polite">
          Check the fields marked in red above.
        </ThemedText>
      )}
      {saveError && <ThemedText themeColor="danger">{saveError}</ThemedText>}
      <Button label={saveLabel} onPress={save} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  photoRow: {
    gap: Spacing.three,
  },
  photoBox: {
    alignItems: 'center',
  },
  photo: {
    width: 120,
    height: 160,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
