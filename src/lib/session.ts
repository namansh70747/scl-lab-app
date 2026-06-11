import { create } from 'zustand';
import { User } from '@/types';

interface SessionState {
  user: User | null;
  token: string | null;
  setUser: (user: User | null) => void;
  can: (action: 'edit_prices' | 'edit_ranges' | 'unlock_results' | 'manage_users' | 'view_settings' | 'approve') => boolean;
  logout: () => void;
}

export const useSession = create<SessionState>((set, get) => ({
  user: null,
  token: null,
  setUser: (user) => set({ user }),
  can: (action) => {
    const user = get().user;
    if (!user) return false;
    if (user.role === 'admin') return true;
    // Technician can only approve results
    if (user.role === 'technician') {
      return action === 'approve';
    }
    return false;
  },
  logout: () => set({ user: null, token: null }),
}));
