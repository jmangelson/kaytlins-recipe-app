import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type HeaderButtonProps = {
  label: string;
  /** Spoken label when it should say more than the visible text. */
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
};

/** Text button for the right side of a navigation header (Edit, Save). */
export function HeaderButton({ label, accessibilityLabel, onPress, disabled }: HeaderButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={styles.button}>
      <ThemedText style={[styles.text, { color: disabled ? theme.textSecondary : theme.tint }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  text: {
    fontWeight: 600,
  },
});
