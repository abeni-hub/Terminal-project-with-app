import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session, Permission } from '@/src/types/user';
import { STORAGE_KEYS } from '@/src/constants';

interface AuthState {
  session: Session | null;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  setSession: (session: Session) => void;
  clearSession: () => void;
  isAuthenticated: () => boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
}

function isValidSession(session: unknown): session is Session {
  if (!session || typeof session !== 'object') return false;
  const s = session as Record<string, unknown>;
  return (
    !!s.user &&
    !!s.role &&
    Array.isArray(s.permissions) &&
    typeof s.token === 'string' &&
    typeof s.expiresAt === 'number'
  );
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      _hasHydrated: false,
      setHasHydrated: (state: boolean) => set({ _hasHydrated: state }),
      setSession: (session) => set({ session }),
      clearSession: () => set({ session: null }),
      isAuthenticated: () => get().session !== null,
      hasPermission: (permission: string) => {
        const session = get().session;
        if (!session || !session.permissions) return false;
        return session.permissions.some((p: Permission) => p.name === permission);
      },
      hasAnyPermission: (permissions: string[]) => {
        const session = get().session;
        if (!session || !session.permissions) return false;
        return permissions.some((perm) => session.permissions.some((p: Permission) => p.name === perm));
      },
    }),
    {
      name: STORAGE_KEYS.SESSION,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      // Migrate/clear stale sessions from older versions that lack permissions/role
      migrate: (persisted: unknown) => {
        if (persisted && typeof persisted === 'object' && 'session' in persisted) {
          const s = (persisted as { session: unknown }).session;
          if (isValidSession(s)) return { session: s, _hasHydrated: true } as unknown as AuthState;
        }
        return { session: null, _hasHydrated: true } as unknown as AuthState;
      },
      version: 2,
    },
  ),
);
