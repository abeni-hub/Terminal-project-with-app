import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface UIState {
  theme: Theme;
  sidebarCollapsed: boolean;
  sidebarOpen: boolean;
  commandOpen: boolean;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  online: boolean;
  setOnline: (online: boolean) => void;
  lastSyncAt: string | null;
  setLastSyncAt: (date: string) => void;
  pendingSync: number;
  setPendingSync: (count: number) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'light',
      sidebarCollapsed: false,
      sidebarOpen: false,
      commandOpen: false,
      online: true,
      lastSyncAt: new Date().toISOString(),
      pendingSync: 0,
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      setOnline: (online) => set({ online }),
      setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
      setPendingSync: (pendingSync) => set({ pendingSync }),
    }),
    { name: 'aato-ui' },
  ),
);
