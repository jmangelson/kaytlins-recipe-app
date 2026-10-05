import { Image } from 'expo-image';
import { useRef, useState, type RefObject } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Ingredient } from '@/features/ingredients/ingredient-model';
import { IngredientRowsEditor } from '@/features/recipes/ingredient-rows-editor';
import { validateDraft, type DraftErrors } from '@/features/recipes/recipe-draft';
import { pickRecipePhoto } from '@/features/recipes/recipe-photo';
import type { PhotoChange } from '@/features/recipes/recipe-repo';
import type { RecipeDraft } from '@/features/recipes/recipe-types';
import type { Tag } from '@/features/stores/store-types';
import {
  missingGroups,
  missingGroupsMessage,
  TAG_GROUPS,
  tagsByGroup,
} from '@/features/stores/tag-groups';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

type RecipeFormProps = {
  initialDraft: RecipeDraft;
  /** Existing photo (base64 JPEG) when editing. */
  initialPhoto: string | null;
  tags: Tag[];
  /** Her canonical ingredient list, for matching and picking. */
  ingredients: Ingredient[];
  saveLabel: string;
  onSave: (draft: RecipeDraft, photo: PhotoChange) => Promise<void>;
};

export function RecipeForm({
  initialDraft,
  initialPhoto,
  tags,
  ingredients,
  saveLabel,
  onSave,
}: RecipeFormProps) {
  const [draft, setDraft] = useState(initialDraft);
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const [photo, setPhoto] = useState<PhotoChange>({ kind: 'unchanged' });
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const hasErrors = Object.values(errors).some(Boolean);
  const tagGroups = tagsByGroup(tags);
  const shownPhoto =
    photo.kind === 'set' ? photo.jpegBase64 : photo.kind === 'remove' ? null : initialPhoto;

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

  async function choosePhoto(source: 'camera' | 'library') {
    setPhotoError(null);
    try {
      const jpegBase64 = await pickRecipePhoto(source);
      if (jpegBase64) setPhoto({ kind: 'set', jpegBase64 });
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
      await onSave(draft, photo);
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
    (JSON.stringify(draft) !== JSON.stringify(initialDraft) || photo.kind !== 'unchanged');
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
        <ThemedText type="smallBold">Photo</ThemedText>
        {shownPhoto ? (
          <>
            <Image
              source={{ uri: `data:image/jpeg;base64,${shownPhoto}` }}
              style={styles.photo}
              contentFit="cover"
              accessibilityLabel="Recipe photo"
            />
            <Button
              label="Remove photo"
              variant="secondary"
              onPress={() => setPhoto({ kind: 'remove' })}
            />
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Optional.
          </ThemedText>
        )}
        <Button label="Take photo" variant="secondary" onPress={() => choosePhoto('camera')} />
        <Button label="Choose photo" variant="secondary" onPress={() => choosePhoto('library')} />
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
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 12,
  },
});
