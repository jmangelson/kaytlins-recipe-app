import { useLayoutEffect, useRef } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { useRevealOnFocus } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Helper text under the label. */
  hint?: string;
  /** Validation message shown under the field. */
  error?: string;
};

export function TextField({
  label,
  hint,
  error,
  multiline,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();
  const field = useRevealOnFocus();
  // A focused field that goes away (a panel closes) closes the keyboard;
  // otherwise Android moves focus, and the page, to the next field.
  useLayoutEffect(() => {
    const node = input.current;
    return () => {
      if (node?.isFocused()) Keyboard.dismiss();
    };
  }, []);
  const input = useRef<TextInput>(null);

  return (
    <View style={styles.container}>
      {/* Tapping the label moves into the field, like a form label should. */}
      <Pressable onPress={() => input.current?.focus()} accessible={false}>
        <ThemedText type="smallBold">{label}</ThemedText>
        {hint && (
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        )}
      </Pressable>
      <TextInput
        ref={input}
        accessibilityLabel={label}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          multiline && styles.multiline,
          {
            color: theme.text,
            borderColor: error ? theme.danger : theme.border,
            backgroundColor: theme.backgroundElement,
          },
        ]}
        {...rest}
        onFocus={(event) => {
          field.onFocus();
          onFocus?.(event);
        }}
        onBlur={(event) => {
          field.onBlur();
          onBlur?.(event);
        }}
      />
      {error && (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  multiline: {
    minHeight: 120,
    paddingVertical: Spacing.two,
  },
});
