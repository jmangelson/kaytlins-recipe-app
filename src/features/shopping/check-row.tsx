import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
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
  /** A separate control at the end of the row (e.g. remove). */
  trailing?: ReactNode;
};

/** Full-width row with a checkbox; the whole row toggles. */
export function CheckRow({
  title,
  detail,
  checked,
  onToggle,
  dimWhenChecked,
  accessibilityLabel,
  trailing,
}: CheckRowProps) {
  const name = accessibilityLabel ?? title;
  const theme = useTheme();
  const dim = dimWhenChecked && checked;
  const row = (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={detail ? `${name}, ${detail}` : name}
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.row,
        trailing ? styles.fill : null,
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
  if (!trailing) return row;
  return (
    <View style={styles.withTrailing}>
      {row}
      {trailing}
    </View>
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
  fill: {
    flex: 1,
  },
  withTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  done: {
    textDecorationLine: 'line-through',
  },
});
