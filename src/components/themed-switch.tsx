import { Switch, type SwitchProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** Android switch in the app's blue instead of the platform default teal. */
export function ThemedSwitch(props: SwitchProps) {
  const theme = useTheme();
  return (
    <Switch
      trackColor={{ false: theme.border, true: theme.backgroundSelected }}
      thumbColor={props.value ? theme.tint : theme.backgroundElement}
      {...props}
    />
  );
}
