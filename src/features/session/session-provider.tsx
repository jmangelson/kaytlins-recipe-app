import { onAuthStateChanged, type User } from '@react-native-firebase/auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  loadUserHousehold,
  needsSeeding,
  seedHousehold,
  type Household,
} from '@/features/household/household-service';
import { auth } from '@/lib/firebase';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'needsHousehold'; user: User }
  | { status: 'ready'; user: User; household: Household }
  | { status: 'error'; user: User; message: string };

type SessionContextValue = {
  session: SessionState;
  /** Re-reads the signed-in user's household (after creating or joining one). */
  refreshHousehold: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

async function resolveSession(user: User | null): Promise<SessionState> {
  if (!user) return { status: 'signedOut' };
  try {
    const household = await loadUserHousehold(user.uid);
    if (household && needsSeeding(household)) {
      // Not awaited: offline, the commit only resolves once the server sees it,
      // but the writes are visible locally immediately.
      seedHousehold(household.id).catch((error) => console.warn('Seeding failed', error));
    }
    return household ? { status: 'ready', user, household } : { status: 'needsHousehold', user };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'error', user, message };
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let latest = 0;
    return onAuthStateChanged(auth, (user) => {
      // Ignore results from an older auth event that finishes after a newer one.
      const request = ++latest;
      resolveSession(user).then((next) => {
        if (request === latest) setSession(next);
      });
    });
  }, []);

  const refreshHousehold = useCallback(async () => {
    setSession(await resolveSession(auth.currentUser));
  }, []);

  const value = useMemo(() => ({ session, refreshHousehold }), [session, refreshHousehold]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

/** For screens that only render once a household is ready. */
export function useHousehold(): { user: User; household: Household } {
  const { session } = useSession();
  if (session.status !== 'ready') throw new Error('No household is loaded');
  return { user: session.user, household: session.household };
}
