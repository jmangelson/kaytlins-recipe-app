import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ListRowProps = {
  title: string;
  subtitle?: string | null;
  /** Shows the subtitle as something needing attention. */
  subtitleTone?: 'default' | 'attention';
  onPress: () => void;
  /** Hide the bottom divider when the parent draws one across a wider row. */
  divider?: boolean;
};

/** Tappable row that opens another screen. */
export function ListRow({
  title,
  subtitle,
  subtitleTone = 'default',
  onPress,
  divider = true,
}: ListRowProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        divider && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}>
      <View style={styles.text}>
        <ThemedText>{title}</ThemedText>
        {subtitle ? (
          <ThemedText
            type="small"
            themeColor={subtitleTone === 'attention' ? 'attention' : 'textSecondary'}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right' }}
        tintColor={theme.textSecondary}
        size={20}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingVertical: Spacing.two,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
});
