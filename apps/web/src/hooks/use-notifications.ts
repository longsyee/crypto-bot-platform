import { create } from "zustand";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt: string;
}

interface NotificationState {
  items: Notification[];
  unreadCount: number;
  addNotification: (n: Omit<Notification, "id" | "read" | "createdAt">) => void;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  unreadCount: 0,

  addNotification: (n) => {
    const id = Math.random().toString(36).slice(2);
    const item: Notification = { ...n, id, read: false, createdAt: new Date().toISOString() };
    set((state) => ({
      items: [item, ...state.items].slice(0, 50),
      unreadCount: state.unreadCount + 1,
    }));
  },

  markAsRead: (id) =>
    set((state) => {
      const items = state.items.map((i) => (i.id === id ? { ...i, read: true } : i));
      const unreadCount = items.filter((i) => !i.read).length;
      return { items, unreadCount };
    }),

  markAllRead: () =>
    set((state) => ({
      items: state.items.map((i) => ({ ...i, read: true })),
      unreadCount: 0,
    })),

  removeNotification: (id) =>
    set((state) => {
      const items = state.items.filter((i) => i.id !== id);
      const unreadCount = items.filter((i) => !i.read).length;
      return { items, unreadCount };
    }),

  clearAll: () => set({ items: [], unreadCount: 0 }),
}));
