import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { cn } from 'src/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-muted text-foreground-muted',
        brand: 'bg-brand-50 text-brand-700',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-danger',
        info: 'bg-info-soft text-info',
      },
    },
    defaultVariants: { tone: 'neutral' },
  }
);

/** The tones a badge can take — exported so lookup tables can be typed. */
export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: ReactNode;
  className?: string | undefined;
}

/**
 * A status pill.
 *
 * Colour is never the only signal — every badge carries its own text, so a
 * colour-blind user reads the same thing everyone else does (WCAG 1.4.1).
 */
export function Badge({ children, tone, className }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)}>{children}</span>;
}
