import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
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
      {/* One weight only: Android under-measures a bold weight layered over the
          default and clips the label ("Add recipe" → "Add"). */}
      <ThemedText type="smallBold" style={[styles.label, { color: theme.onTint }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: Spacing.four,
    // Tab screens end above the tab bar, so no tab inset here.
    bottom: Spacing.three,
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
    fontSize: 16,
  },
  pressed: {
    opacity: 0.85,
  },
});
