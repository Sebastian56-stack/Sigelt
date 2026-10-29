import { useColorScheme as useRNColorScheme } from 'react-native';
import { useHydrated } from './use-hydrated';

export function useColorScheme() {
  const hasHydrated = useHydrated();
  const colorScheme = useRNColorScheme();
  return hasHydrated ? colorScheme : 'light';
}
