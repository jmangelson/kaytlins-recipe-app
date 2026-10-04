import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FloatingButtonProps = {
  label: string;
  onPress: () => void;
};

/** Android-style floating action button, above the tab bar on a tab screen. */
export function FloatingButton({ label, onPress }: FloatingButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.tint },
        pressed && styles.pressed,
      ]}>
      <SymbolView name={{ android: 'add', ios: 'plus' }} tintColor={theme.onTint} size={22} />
      <ThemedText style={[styles.label, { color: theme.onTint }]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: Spacing.four,
    bottom: BottomTabInset + Spacing.three,
    minHeight: 56,
    borderRadius: 16,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  label: {
    fontWeight: 600,
  },
  pressed: {
    opacity: 0.85,
  },
});
