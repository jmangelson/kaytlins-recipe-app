import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
};

export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const filled = variant === 'primary';
  const foreground = filled ? theme.onTint : variant === 'danger' ? theme.danger : theme.tint;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        filled
          ? { backgroundColor: theme.tint }
          : { borderColor: variant === 'danger' ? theme.danger : theme.border, borderWidth: 1 },
        (pressed || isDisabled) && styles.dimmed,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <ThemedText style={[styles.label, { color: foreground }]}>{label}</ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    // Full width + centered text: Android under-measures shrink-wrapped
    // bold labels and clips the last word ("Share invite code" -> "Share invite").
    alignSelf: 'stretch',
    textAlign: 'center',
    fontWeight: 600,
  },
  dimmed: {
    opacity: 0.6,
  },
});
