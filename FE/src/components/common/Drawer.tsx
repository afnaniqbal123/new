import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type ReactNode,
} from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import { Icon } from 'src/components/common/Icon';
import { cn } from 'src/lib/utils';

/**
 * A panel that slides in from the right.
 *
 * ## Why this exists beside `Dialog`
 *
 * A centred modal is the right shape for a short, self-contained decision —
 * "delete this?", "confirm". It is the wrong shape for a **form**, which is
 * what most of this product's overlays are: a centred box either grows until
 * it is a page pretending to be a dialog, or it scrolls internally while the
 * page behind it sits idle.
 *
 * A right-hand drawer takes full height, so a ten-field form needs no internal
 * scroll at all, and it keeps the list it was opened from visible at the left —
 * which is what makes "add another" feel like part of the list rather than a
 * detour. `ConfirmDialog` stays a dialog; forms move here.
 *
 * ## What Radix gives us, and what we add
 *
 * Radix owns focus trapping, `aria-modal`, Escape, scroll locking and
 * restoring focus to the trigger. We add the geometry, the animation, and one
 * rule Radix cannot know: the panel is a flex column with a scrollable body, so
 * the header and the footer actions stay put while long content moves.
 *
 * `DrawerContent` requires a `drawerTitle` — Radix logs a warning for a dialog
 * with no accessible name and a screen reader announces nothing useful, so the
 * title is a required prop rather than a convention that can be forgotten.
 */
// Wrapped rather than re-exported, exactly as `Dialog` does: a bare
// `export const X = Primitive.Y` is a value export, and Fast Refresh then
// refuses to treat the file as component-only.
export function Drawer(props: ComponentPropsWithoutRef<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />;
}

export function DrawerTrigger(props: ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger {...props} />;
}

export function DrawerClose(props: ComponentPropsWithoutRef<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close {...props} />;
}

// `drawerTitle` rather than `title` for the same reason `Dialog` uses
// `dialogTitle`: the native HTML `title` attribute is already in these props
// and reusing the name collides under `tsc -b`'s composite build.
type DrawerContentProps = Omit<
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
  'title'
> & {
  /** Required: the drawer's accessible name, rendered as its heading. */
  drawerTitle: string;
  /** Optional line under the title explaining what the form is for. */
  description?: string;
  /** Pinned to the bottom — save/cancel live here, always reachable. */
  footer?: ReactNode;
};

export const DrawerContent = forwardRef<
  ComponentRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(function DrawerContent({ drawerTitle, description, footer, children, className, ...rest }, ref) {
  const { t } = useTranslation();

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="bg-surface-inverted/50 animate-fade-in fixed inset-0 z-50 backdrop-blur-sm" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'bg-surface border-border shadow-overlay animate-slide-in-right fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l',
          className
        )}
        {...rest}
      >
        <header className="border-border flex items-start gap-4 border-b px-5 py-4">
          <span className="min-w-0 flex-1">
            <DialogPrimitive.Title className="text-foreground text-base font-semibold tracking-tight">
              {drawerTitle}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-foreground-muted mt-1 text-sm">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </span>

          <DialogPrimitive.Close
            aria-label={t('BUTTON_CLOSE')}
            className="text-foreground-subtle hover:bg-surface-muted hover:text-foreground focus-visible:ring-brand-500 -mr-1 rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <Icon name="close" className="size-4.5" />
          </DialogPrimitive.Close>
        </header>

        {/* The only scrolling region, so the header and footer never move. */}
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer ? (
          <footer className="border-border bg-surface-muted flex items-center justify-end gap-2 border-t px-5 py-4">
            {footer}
          </footer>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
