import { createContext, useCallback, useContext, useRef, useState, type RefObject } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  TextInput,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

type ScreenProps = ScrollViewProps & {
  /** Safe-area edges to pad. Screens under a navigation header skip 'top'. */
  edges?: Edge[];
  /** For screens that scroll programmatically (e.g. back to an edited row). */
  scrollRef?: RefObject<ScrollView | null>;
};

/**
 * The share of the screen a phone keyboard covers (with its suggestion
 * strip). Android draws edge to edge and doesn't report the keyboard to the
 * app here, so this is an estimate on the generous side.
 */
const KEYBOARD_SHARE = 0.45;
/**
 * Room kept between the focused field and the keyboard, so the buttons
 * under a field (Save, Add, Cancel) stay in view while she types.
 */
const ROOM_BELOW_FIELD = 120;
/** Don't scroll a field's top up under the navigation header. */
const TOP_MARGIN = 110;

type FieldFocus = { onFocus: () => void; onBlur: () => void };

const FieldFocusContext = createContext<FieldFocus>({ onFocus: () => {}, onBlur: () => {} });

/**
 * For text inputs: pass these to the input so the screen keeps the field
 * (and the buttons under it) above the keyboard. TextField does this already.
 */
export function useRevealOnFocus(): FieldFocus {
  return useContext(FieldFocusContext);
}

/**
 * Scrollable, padded page container for form-style screens. The keyboard
 * covers the bottom of the page instead of shrinking it, so while a field
 * has focus the page gets room for the keyboard at the bottom, and the
 * field scrolls up above where the keyboard sits.
 */
export function Screen({
  children,
  contentContainerStyle,
  edges = ['top', 'right', 'bottom', 'left'],
  scrollRef,
  onScroll,
  ...rest
}: ScreenProps) {
  const ownScroll = useRef<ScrollView | null>(null);
  const scroll = scrollRef ?? ownScroll;
  const offset = useRef(0);
  const [typing, setTyping] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onFocus = useCallback(() => {
    // Moving from one field to the next: keep the room (no jump).
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setTyping(true);
    // After the keyboard room is laid out.
    setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput();
      if (!input) return;
      const keyboardTop = Dimensions.get('window').height * (1 - KEYBOARD_SHARE);
      input.measureInWindow((_x, y, _w, height) => {
        const over = y + height - (keyboardTop - ROOM_BELOW_FIELD);
        if (over <= 0) return;
        // A tall field: keep its top in view rather than its bottom.
        const by = Math.min(over, Math.max(0, y - TOP_MARGIN));
        if (by > 0) scroll.current?.scrollTo({ y: offset.current + by, animated: true });
      });
    }, 120);
  }, [scroll]);

  const onBlur = useCallback(() => {
    blurTimer.current = setTimeout(() => setTyping(false), 250);
  }, []);

  function trackScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    offset.current = event.nativeEvent.contentOffset.y;
    onScroll?.(event);
  }

  return (
    <FieldFocusContext.Provider value={{ onFocus, onBlur }}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={edges}>
          <ScrollView
            ref={scroll}
            keyboardShouldPersistTaps="handled"
            onScroll={trackScroll}
            scrollEventThrottle={16}
            contentContainerStyle={[
              styles.content,
              contentContainerStyle,
              typing && {
                paddingBottom: Dimensions.get('window').height * KEYBOARD_SHARE + Spacing.four,
              },
            ]}
            {...rest}>
            {children}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </FieldFocusContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  content: {
    flexGrow: 1,
    padding: Spacing.four,
    gap: Spacing.four,
  },
});
