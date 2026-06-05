import { create } from "zustand";

export interface User {
  id: string;
  email: string;
  role: string;
  emailVerified?: boolean;
  referralCode?: string;
  tier?: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  setAuth: (token: string, refreshToken: string, user: User) => void;
  logout: () => void;
}

function safeParseUser(): User | null {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem("user");
    return null;
  }
}

export const useAuth = create<AuthState>((set) => ({
  token: localStorage.getItem("accessToken"),
  refreshToken: localStorage.getItem("refreshToken"),
  user: safeParseUser(),
  setAuth: (token, refreshToken, user) => {
    localStorage.setItem("accessToken", token);
    localStorage.setItem("refreshToken", refreshToken);
    localStorage.setItem("user", JSON.stringify(user));
    set({ token, refreshToken, user });
  },
  logout: () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    set({ token: null, refreshToken: null, user: null });
  },
}));
