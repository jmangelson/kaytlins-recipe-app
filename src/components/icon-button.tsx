import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type IconButtonProps = {
  /** Material symbol (Android) and SF Symbol (iOS). */
  icon: { android: AndroidSymbol; ios: SFSymbol };
  /** Spoken label, e.g. "Move Produce up". */
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
};

/** 44 dp square icon button with an accessible label. */
export function IconButton({ icon, label, onPress, disabled, tone = 'default' }: IconButtonProps) {
  const theme = useTheme();
  const color = disabled ? theme.border : tone === 'danger' ? theme.danger : theme.textSecondary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={2}
      style={({ pressed }) => [
        styles.button,
        pressed && { backgroundColor: theme.backgroundSelected },
      ]}>
      <SymbolView name={icon} tintColor={color} size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
