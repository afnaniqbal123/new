import type { ComponentPropsWithoutRef } from 'react';
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from 'src/lib/utils';

/**
 * Accessible dropdown built on Radix — roving focus, keyboard nav, and typeahead
 * come from Radix; only tokens/layout are ours. Used by ThemeToggle; reach for it
 * for any menu-triggered-by-a-button UI. See AGENTS.md § Tech Stack.
 */
export function DropdownMenu(props: ComponentPropsWithoutRef<typeof DropdownPrimitive.Root>) {
  return <DropdownPrimitive.Root {...props} />;
}

export function DropdownMenuTrigger(
  props: ComponentPropsWithoutRef<typeof DropdownPrimitive.Trigger>
) {
  return <DropdownPrimitive.Trigger {...props} />;
}

export function DropdownMenuContent({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        sideOffset={4}
        className={cn(
          'bg-surface border-border z-50 min-w-40 rounded-md border p-1 shadow-lg',
          className
        )}
        {...rest}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof DropdownPrimitive.Item>) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        'text-foreground hover:bg-surface-muted flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
        className
      )}
      {...rest}
    />
  );
}

export function DropdownMenuRadioGroup(
  props: ComponentPropsWithoutRef<typeof DropdownPrimitive.RadioGroup>
) {
  return <DropdownPrimitive.RadioGroup {...props} />;
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<typeof DropdownPrimitive.RadioItem>) {
  return (
    <DropdownPrimitive.RadioItem
      className={cn(
        'text-foreground hover:bg-surface-muted flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
        className
      )}
      {...rest}
    >
      {children}
    </DropdownPrimitive.RadioItem>
  );
}
