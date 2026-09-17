import { create } from 'zustand';

export type ToastVariant = 'error' | 'success' | 'info';

export interface ToastItem {
  id: string;
  // `| undefined`, not just `?`, because every `toast.*` helper below always
  // passes `title` through from its own optional parameter, present or not.
  title?: string | undefined;
  description: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: ToastItem[];
  add: (toast: Omit<ToastItem, 'id'>) => void;
  remove: (id: string) => void;
}

/**
 * Toast queue. UI-only client state — a Zustand slice like any other, so it can
 * be pushed to from outside React too (e.g. the axios/query-client error handlers
 * in src/services/queryClient.ts) via `useToastStore.getState().add(...)`.
 */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (toast) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
  },
  remove: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));

/** Convenience callers for non-component code (interceptors, query-cache handlers). */
export const toast = {
  error: (description: string, title?: string) => {
    useToastStore.getState().add({ description, title, variant: 'error' });
  },
  success: (description: string, title?: string) => {
    useToastStore.getState().add({ description, title, variant: 'success' });
  },
  info: (description: string, title?: string) => {
    useToastStore.getState().add({ description, title, variant: 'info' });
  },
};
