import { create } from 'zustand';

/**
 * System settings store — móvil web no tiene OS-level autostart ni tray,
 * así que esta versión es solo un stub para preservar la API que usa la app desktop.
 */

export interface SystemSettingsState {
  launchAtStartup: boolean;
  minimizeToTray: boolean;
  loaded: boolean;
  storageKey: 'flowtrack-minimize-to-tray';

  init: () => Promise<void>;
  setLaunchAtStartup: (value: boolean) => Promise<void>;
  setMinimizeToTray: (value: boolean) => void;
}

const STORAGE_KEY = 'flowtrack-minimize-to-tray';

export const useSystemSettings = create<SystemSettingsState>((set) => ({
  launchAtStartup: false,
  minimizeToTray: false,
  loaded: false,
  storageKey: STORAGE_KEY,

  init: async () => {
    set({ loaded: true });
  },

  setLaunchAtStartup: async () => {
    /* no-op en web */
  },

  setMinimizeToTray: (value) => {
    localStorage.setItem(STORAGE_KEY, String(value));
    set({ minimizeToTray: value });
  },
}));
