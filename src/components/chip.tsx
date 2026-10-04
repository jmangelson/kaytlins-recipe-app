import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ChipProps = {
  label: string;
  /** When set, the chip is a toggle button. */
  selected?: boolean;
  onPress?: () => void;
  /** Spoken label when the visible text alone is ambiguous. */
  accessibilityLabel?: string;
};

/** Small rounded label; becomes a toggle when `onPress` is given. */
export function Chip({ label, selected = false, onPress, accessibilityLabel }: ChipProps) {
  const theme = useTheme();
  const colors = selected
    ? { backgroundColor: theme.tint, borderColor: theme.tint }
    : { backgroundColor: theme.backgroundElement, borderColor: theme.border };
  const text = (
    <ThemedText type="small" style={selected ? { color: theme.onTint } : undefined}>
      {label}
    </ThemedText>
  );

  if (!onPress) return <View style={[styles.chip, colors]}>{text}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.chip, styles.toggle, colors, pressed && styles.pressed]}>
      {text}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  toggle: {
    minHeight: 40,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
