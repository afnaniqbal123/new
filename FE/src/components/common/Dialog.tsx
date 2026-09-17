import type { ComponentPropsWithoutRef, ComponentRef, ReactNode } from 'react';
import { forwardRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from 'src/lib/utils';

/**
 * Accessible modal built on Radix's Dialog primitive — focus trap, Escape-to-close,
 * and ARIA wiring come from Radix; only tokens and layout are ours. This is the
 * reference shape for adding further complex primitives (Popover, Select, Tabs…)
 * via `pnpm dlx shadcn add <component>` — see AGENTS.md § Tech Stack.
 *
 * Each part is wrapped in its own named function (not a bare re-export of the Radix
 * primitive) so Fast Refresh can treat this file as component-only.
 */
export function Dialog(props: ComponentPropsWithoutRef<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />;
}

export function DialogTrigger(props: ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger {...props} />;
}

export function DialogClose(props: ComponentPropsWithoutRef<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close {...props} />;
}

// `dialogTitle` (not `title`) — the native HTML `title` attribute (tooltip text,
// typed `string`) is already part of ComponentPropsWithoutRef<'div'>-like props
// here; reusing that name collides with it under `tsc -b`'s composite build.
type DialogContentProps = Omit<
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
  'title'
> & {
  dialogTitle: ReactNode;
};

export const DialogContent = forwardRef<
  ComponentRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function DialogContent({ className, children, dialogTitle, ...rest }, ref) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="bg-surface-inverted/40 fixed inset-0 z-50" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'bg-surface border-border fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border p-6 shadow-lg',
          className
        )}
        {...rest}
      >
        <DialogPrimitive.Title className="text-foreground mb-4 text-lg font-semibold">
          {dialogTitle}
        </DialogPrimitive.Title>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
