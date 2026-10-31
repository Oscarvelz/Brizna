import { create } from "zustand";

export type UndoEntry = {
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
};

type UndoState = {
  past: UndoEntry[];
  future: UndoEntry[];
  busy: boolean;
  push: (entry: UndoEntry) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
};

export const useUndo = create<UndoState>((set, get) => ({
  past: [],
  future: [],
  busy: false,
  push: (entry) =>
    set({
      past: [...get().past.slice(-19), entry],
      future: [],
    }),
  undo: async () => {
    const { past, future, busy } = get();
    const last = past[past.length - 1];
    if (!last || busy) return;
    set({ busy: true, past: past.slice(0, -1), future: [last, ...future] });
    try {
      await last.undo();
    } finally {
      set({ busy: false });
    }
  },
  redo: async () => {
    const { past, future, busy } = get();
    const next = future[0];
    if (!next || busy) return;
    set({ busy: true, future: future.slice(1), past: [...past, next] });
    try {
      await next.redo();
    } finally {
      set({ busy: false });
    }
  },
}));
