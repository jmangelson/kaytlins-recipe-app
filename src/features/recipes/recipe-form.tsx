import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  formatIngredientAmount,
  parseDraftIngredients,
  validateDraft,
  type DraftErrors,
} from '@/features/recipes/recipe-draft';
import { pickRecipePhoto } from '@/features/recipes/recipe-photo';
import type { PhotoChange } from '@/features/recipes/recipe-repo';
import type { RecipeDraft } from '@/features/recipes/recipe-types';
import type { Tag } from '@/features/stores/store-types';
import { useTheme } from '@/hooks/use-theme';

const HEADER_EDGES: Edge[] = ['right', 'bottom', 'left'];

type RecipeFormProps = {
  initialDraft: RecipeDraft;
  /** Existing photo (base64 JPEG) when editing. */
  initialPhoto: string | null;
  tags: Tag[];
  saveLabel: string;
  onSave: (draft: RecipeDraft, photo: PhotoChange) => Promise<void>;
};

export function RecipeForm({
  initialDraft,
  initialPhoto,
  tags,
  saveLabel,
  onSave,
}: RecipeFormProps) {
  const theme = useTheme();
  const [draft, setDraft] = useState(initialDraft);
  const [photo, setPhoto] = useState<PhotoChange>({ kind: 'unchanged' });
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const parsed = parseDraftIngredients(draft.ingredientsText);
  const hasErrors = Object.values(errors).some(Boolean);
  const shownPhoto =
    photo.kind === 'set' ? photo.jpegBase64 : photo.kind === 'remove' ? null : initialPhoto;

  function update<K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
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

  async function save() {
    const found = validateDraft(draft);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(draft, photo);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Saving failed. Please try again.');
      setSaving(false);
    }
  }

  return (
    <Screen edges={HEADER_EDGES}>
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

      {tags.length > 0 && (
        <View style={styles.group}>
          <ThemedText type="smallBold">Tags</ThemedText>
          <View style={styles.tags}>
            {tags.map((tag) => (
              <Chip
                key={tag.id}
                label={tag.name}
                selected={draft.tagIds.includes(tag.id)}
                onPress={() => toggleTag(tag.id)}
              />
            ))}
          </View>
        </View>
      )}

      <TextField
        label="Ingredients"
        testID="recipe-ingredients"
        hint="One per line, like “1 ½ cups flour, sifted”. You can paste a whole list."
        value={draft.ingredientsText}
        onChangeText={(v) => update('ingredientsText', v)}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.ingredients}
      />
      {parsed.length > 0 && (
        <View
          style={[styles.preview, { borderColor: theme.border }]}
          accessibilityLabel="How the ingredients were read">
          <ThemedText type="small" themeColor="textSecondary">
            Read as {parsed.length} {parsed.length === 1 ? 'ingredient' : 'ingredients'}:
          </ThemedText>
          {parsed.map((p, index) => (
            <View key={index} style={styles.previewRow}>
              <ThemedText type="smallBold" style={styles.previewAmount}>
                {formatIngredientAmount(p) || '—'}
              </ThemedText>
              <ThemedText type="small" style={styles.previewName}>
                {p.name}
                {p.note ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {` (${p.note})`}
                  </ThemedText>
                ) : null}
              </ThemedText>
            </View>
          ))}
        </View>
      )}

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
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  preview: {
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.three,
    gap: Spacing.one,
    marginTop: -Spacing.two,
  },
  previewRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  previewAmount: {
    width: 88,
  },
  previewName: {
    flex: 1,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 12,
  },
});
