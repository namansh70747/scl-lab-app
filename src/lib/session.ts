import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '@/types';

interface SessionState {
  user: User | null;
  token: string | null;
  setUser: (user: User | null) => void;
  can: (action: Capability) => boolean;
  logout: () => void;
}

export type Capability =
  | 'edit_prices' | 'edit_ranges' | 'edit_tests' | 'manage_panels'
  | 'unlock_results' | 'manage_users' | 'view_settings' | 'edit_settings'
  | 'manage_doctors' | 'enter_results' | 'approve';

// Capabilities a technician is allowed. Everything else is admin-only.
const TECH_ALLOWED: Capability[] = ['enter_results', 'approve', 'manage_doctors'];

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setUser: (user) => set({ user }),
      can: (action) => {
        const user = get().user;
        if (!user) return false;
        if (user.role === 'admin') return true;
        if (user.role === 'technician') return TECH_ALLOWED.includes(action);
        return false;
      },
      logout: () => set({ user: null, token: null }),
    }),
    {
      name: 'scl_session',
      storage: createJSONStorage(() => localStorage),
      // Persist the logged-in user so a relaunch/reload doesn't force re-login on the
      // single lab terminal — but NEVER write the password hash to storage.
      partialize: (s) => ({ user: s.user ? { ...s.user, password_hash: '' } : null }),
    }
  )
);

/** Throws if the current user lacks the capability. Called from the query layer
 *  so a hidden button can never be the only guard (§8A.4 defense-in-depth). */
export function assertCan(action: Capability): void {
  if (!useSession.getState().can(action)) {
    throw new Error(`Not permitted: this action requires elevated (Admin) access.`);
  }
}

export function currentUserId(): number | null {
  return useSession.getState().user?.id ?? null;
}
