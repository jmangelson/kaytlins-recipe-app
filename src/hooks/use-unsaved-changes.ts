import { useNavigation } from 'expo-router';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Alert } from 'react-native';

/**
 * Back never saves on its own. While `dirty`, leaving the screen (Back,
 * gesture, or navigation) asks: Keep editing, Discard, or Save. `save`
 * returns false when it couldn't save (e.g. a name is missing), which keeps
 * her on the screen.
 *
 * Returns `leave`, for leaving on purpose without asking (after Save or
 * Delete): `leave(() => router.back())`.
 */
export function useUnsavedChanges(dirty: boolean, save: () => Promise<boolean>) {
  const navigation = useNavigation();
  const latest = useRef({ dirty, save });
  const leaving = useRef(false);
  useLayoutEffect(() => {
    latest.current = { dirty, save };
  });

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (leaving.current || !latest.current.dirty) return;
        event.preventDefault();
        const go = () => {
          leaving.current = true;
          navigation.dispatch(event.data.action);
        };
        Alert.alert('Save your changes?', 'You have changes that aren’t saved yet.', [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: go },
          {
            text: 'Save',
            onPress: async () => {
              if (await latest.current.save()) go();
            },
          },
        ]);
      }),
    [navigation]
  );

  return function leave(navigate: () => void) {
    leaving.current = true;
    navigate();
  };
}
