import { create } from "zustand";

import { apiGet } from "./api";

type Me = { id: number; email: string; role: "boss" | "user" };

type AuthState = {
  me: Me | null;
  loading: boolean;
  refreshMe: () => Promise<void>;
  clear: () => void;
};

/**
 * Why Zustand (instead of Redux Toolkit) here?
 *
 * - Our initial global state needs are small: mainly `me` (current user session).
 * - Zustand is lightweight, minimal boilerplate, and very common in production.
 * - Redux Toolkit is also professional, but adds more files/actions/slices.
 *
 * If later you want Redux:
 * - We can migrate this store into an RTK slice without changing your UI much.
 */
export const useAuthStore = create<AuthState>((set) => ({
  me: null,
  loading: false,

  refreshMe: async () => {
    set({ loading: true });
    try {
      const me = await apiGet<Me>("/api/users/me");
      set({ me, loading: false });
    } catch {
      set({ me: null, loading: false });
    }
  },

  clear: () => set({ me: null })
}));
