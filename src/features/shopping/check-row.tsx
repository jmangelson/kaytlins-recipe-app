import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CheckRowProps = {
  title: string;
  detail?: string | null;
  checked: boolean;
  onToggle: () => void;
  /** Dim the text once checked (a checklist item that's done). */
  dimWhenChecked?: boolean;
  /** Spoken name when the title alone is ambiguous ("Day 1 Dinner"). */
  accessibilityLabel?: string;
};

/** Full-width row with a checkbox; the whole row toggles. */
export function CheckRow({
  title,
  detail,
  checked,
  onToggle,
  dimWhenChecked,
  accessibilityLabel,
}: CheckRowProps) {
  const name = accessibilityLabel ?? title;
  const theme = useTheme();
  const dim = dimWhenChecked && checked;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={detail ? `${name}, ${detail}` : name}
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.backgroundElement },
      ]}>
      <SymbolView
        name={{
          ios: checked ? 'checkmark.square.fill' : 'square',
          android: checked ? 'check_box' : 'check_box_outline_blank',
        }}
        tintColor={checked ? theme.tint : theme.textSecondary}
        size={24}
      />
      <View style={styles.text}>
        <ThemedText
          themeColor={dim ? 'textSecondary' : undefined}
          style={dim ? styles.done : undefined}>
          {title}
        </ThemedText>
        {detail ? (
          <ThemedText type="small" themeColor="textSecondary">
            {detail}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 48,
    paddingVertical: Spacing.one,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  done: {
    textDecorationLine: 'line-through',
  },
});
