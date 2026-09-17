import * as ToastPrimitive from '@radix-ui/react-toast';
import { cva } from 'class-variance-authority';
import { useTranslation } from 'react-i18next';
import { cn } from 'src/lib/utils';
import { useToastStore, type ToastVariant } from 'src/stores/toastStore';

const toastVariants = cva(
  'border-border bg-surface text-foreground grid grid-cols-[1fr_auto] items-center gap-x-3 rounded-md border p-4 shadow-lg',
  {
    variants: {
      variant: {
        error: 'border-danger',
        success: 'border-success',
        info: 'border-border',
      } satisfies Record<ToastVariant, string>,
    },
    defaultVariants: { variant: 'info' },
  }
);

/**
 * Mounts once at the app root (see src/App.tsx). Renders every toast currently
 * in `useToastStore`, driven by Radix's Toast primitive for focus management,
 * swipe-to-dismiss, and the `aria-live` region — see AGENTS.md § Tech Stack.
 */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const remove = useToastStore((state) => state.remove);
  const { t } = useTranslation();

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((item) => (
        <ToastPrimitive.Root
          key={item.id}
          className={toastVariants({ variant: item.variant })}
          onOpenChange={(open) => {
            if (!open) remove(item.id);
          }}
        >
          <div className="flex flex-col gap-1">
            {item.title ? (
              <ToastPrimitive.Title className="text-sm font-semibold">
                {item.title}
              </ToastPrimitive.Title>
            ) : null}
            <ToastPrimitive.Description className="text-foreground-muted text-sm">
              {item.description}
            </ToastPrimitive.Description>
          </div>
          <ToastPrimitive.Close
            aria-label={t('TOAST_DISMISS')}
            className={cn('text-foreground-muted hover:text-foreground text-sm')}
          >
            {t('ICON_CLOSE')}
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed right-0 bottom-0 z-50 m-0 flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
    </ToastPrimitive.Provider>
  );
}
