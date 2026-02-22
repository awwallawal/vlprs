import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@vlprs/shared';

interface AuthState {
  accessToken: string | null;
  user: User | null;
  setAuth: (accessToken: string, user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setAuth: (accessToken, user) => set({ accessToken, user }),
      clearAuth: () => set({ accessToken: null, user: null }),
    }),
    {
      name: 'vlprs-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
      }),
    },
  ),
);
