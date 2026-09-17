import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'src/lib/utils';

/**
 * shadcn/ui-style variant map: our own @theme tokens (never shadcn's default
 * --primary/--secondary palette — see AGENTS.md § Tech Stack).
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-white hover:bg-brand-700',
        secondary: 'bg-surface-muted text-foreground hover:bg-border',
        ghost: 'bg-transparent text-foreground hover:bg-surface-muted',
        danger: 'bg-danger text-white hover:opacity-90',
      },
      size: {
        sm: 'px-3 py-1 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
        // Fixed square footprint, no text — an icon-only trigger (e.g. a floating
        // "+" action). Pairs with `shape="circle"`; AGENTS.md § Component
        // Conventions: a new look on an existing common component is a new `cva()`
        // variant here, never a parallel one-off component.
        icon: 'size-14 p-0',
        // The same idea at header scale — a toggle sitting in a row of small
        // text buttons, where `icon`'s 3.5rem footprint would tower over them.
        iconSm: 'size-8 p-0',
      },
      shape: {
        default: 'rounded-md',
        circle: 'rounded-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      shape: 'default',
    },
  }
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  children: ReactNode;
  /** Render as the single child element instead of a `<button>` (Radix Slot). */
  asChild?: boolean;
}

/**
 * Reusable, domain-agnostic button. `type` defaults to "button" so callers can
 * never accidentally submit a form (WCAG / react convention: explicit button type).
 */
export function Button({
  children,
  variant,
  size,
  shape,
  type = 'button',
  className,
  asChild = false,
  ...rest
}: ButtonProps) {
  if (asChild) {
    return (
      <Slot className={cn(buttonVariants({ variant, size, shape }), className)} {...rest}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      // Explicit literal branches keep react/button-has-type satisfied.
      type={type === 'submit' ? 'submit' : type === 'reset' ? 'reset' : 'button'}
      className={cn(buttonVariants({ variant, size, shape }), className)}
      {...rest}
    >
      {children}
    </button>
  );
}
