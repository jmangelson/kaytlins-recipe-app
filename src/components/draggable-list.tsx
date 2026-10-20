import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Every row is this tall, so a drag maps straight to a position. */
export const DRAG_ROW_HEIGHT = 56;

type Positions = Record<string, number>;

function positionsOf(keys: string[]): Positions {
  return Object.fromEntries(keys.map((key, index) => [key, index]));
}

/**
 * A list she reorders by dragging each row's handle (≡); the other rows
 * slide out of the way and the new order is reported on drop. Screen
 * readers get Move up / Move down actions on the handle instead.
 */
export function DraggableList<T>({
  items,
  keyOf,
  labelOf,
  renderRow,
  onReorder,
}: {
  items: T[];
  keyOf: (item: T) => string;
  /** Spoken name of a row ("Produce"). */
  labelOf: (item: T) => string;
  renderRow: (item: T, index: number) => ReactNode;
  onReorder: (items: T[]) => void;
}) {
  const keys = items.map(keyOf);
  const positions = useSharedValue<Positions>(positionsOf(keys));
  const keyList = keys.join('\n');
  useEffect(() => {
    positions.set(positionsOf(keyList.split('\n')));
  }, [keyList, positions]);

  function drop(order: Positions) {
    const next = [...items].sort((a, b) => order[keyOf(a)] - order[keyOf(b)]);
    if (next.some((item, index) => item !== items[index])) onReorder(next);
  }

  function move(index: number, delta: -1 | 1) {
    const to = index + delta;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[index], next[to]] = [next[to], next[index]];
    onReorder(next);
  }

  return (
    <View style={{ height: items.length * DRAG_ROW_HEIGHT }}>
      {items.map((item, index) => (
        <DraggableRow
          key={keyOf(item)}
          id={keyOf(item)}
          index={index}
          count={items.length}
          positions={positions}
          label={labelOf(item)}
          onDrop={drop}
          onMove={(delta) => move(index, delta)}>
          {renderRow(item, index)}
        </DraggableRow>
      ))}
    </View>
  );
}

function DraggableRow({
  id,
  index,
  count,
  positions,
  label,
  onDrop,
  onMove,
  children,
}: {
  id: string;
  index: number;
  count: number;
  positions: SharedValue<Positions>;
  label: string;
  onDrop: (order: Positions) => void;
  onMove: (delta: -1 | 1) => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const dragging = useSharedValue(false);
  const top = useSharedValue(index * DRAG_ROW_HEIGHT);
  const startTop = useSharedValue(0);

  // Slide into place when another row's drag moves this one.
  useAnimatedReaction(
    () => positions.get()[id],
    (position, previous) => {
      if (position !== undefined && position !== previous && !dragging.get()) {
        top.set(withTiming(position * DRAG_ROW_HEIGHT, { duration: 150 }));
      }
    }
  );

  const pan = Gesture.Pan()
    .minDistance(1)
    .onStart(() => {
      dragging.set(true);
      startTop.set(top.get());
    })
    .onUpdate((event) => {
      const y = Math.min(
        Math.max(startTop.get() + event.translationY, 0),
        (count - 1) * DRAG_ROW_HEIGHT
      );
      top.set(y);
      const from = positions.get()[id];
      const to = Math.round(y / DRAG_ROW_HEIGHT);
      if (to === from) return;
      // Rows between the old and new spot shift one place toward the old.
      const next: Positions = {};
      for (const key of Object.keys(positions.get())) {
        const p = positions.get()[key];
        if (key === id) next[key] = to;
        else if (from < to && p > from && p <= to) next[key] = p - 1;
        else if (from > to && p >= to && p < from) next[key] = p + 1;
        else next[key] = p;
      }
      positions.set(next);
    })
    .onFinalize(() => {
      dragging.set(false);
      top.set(withTiming(positions.get()[id] * DRAG_ROW_HEIGHT, { duration: 150 }));
      scheduleOnRN(onDrop, positions.get());
    });

  const style = useAnimatedStyle(() => ({
    top: top.get(),
    zIndex: dragging.get() ? 10 : 0,
    elevation: dragging.get() ? 6 : 0,
    opacity: dragging.get() ? 0.95 : 1,
  }));

  return (
    <Animated.View
      style={[
        styles.row,
        { backgroundColor: theme.background, borderBottomColor: theme.border },
        style,
      ]}>
      <View style={styles.content}>{children}</View>
      <GestureDetector gesture={pan}>
        <View
          style={styles.handle}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Drag ${label}`}
          accessibilityHint="Drag up or down to move it"
          accessibilityActions={[
            { name: 'moveUp', label: 'Move up' },
            { name: 'moveDown', label: 'Move down' },
          ]}
          onAccessibilityAction={(event) =>
            onMove(event.nativeEvent.actionName === 'moveUp' ? -1 : 1)
          }>
          <ThemedText type="subtitle" themeColor="textSecondary">
            ≡
          </ThemedText>
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: DRAG_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  handle: {
    width: 56,
    height: DRAG_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
