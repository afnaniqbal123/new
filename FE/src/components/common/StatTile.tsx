import type { ReactNode } from 'react';
import { cn } from 'src/lib/utils';

interface StatTileProps {
  label: string;
  /** The figure itself — usually a <Money /> or a plain count. */
  value: ReactNode;
  /** One short line under the figure: a count, a comparison, a warning. */
  hint?: string | undefined;
  /** A decorative glyph. Hidden from assistive tech — the label carries meaning. */
  icon?: ReactNode | undefined;
  /** Draws attention without shouting. For figures that need acting on. */
  emphasis?: 'none' | 'warning' | 'danger' | undefined;
  className?: string | undefined;
}

/**
 * One headline figure.
 *
 * Deliberately plain: no sparkline, no percentage-change badge. The figures on
 * this dashboard are what a shop owner checks in ten seconds before opening,
 * and decoration competes with the number for the only attention they have.
 */
export function StatTile({
  label,
  value,
  hint,
  icon,
  emphasis = 'none',
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        'border-border bg-surface-raised shadow-card rounded-xl border p-4',
        emphasis === 'warning' && 'border-warning',
        emphasis === 'danger' && 'border-danger',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-foreground-muted text-xs font-medium tracking-wide uppercase">{label}</p>
        {icon ? (
          <span aria-hidden="true" className="text-foreground-subtle">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-2">{value}</div>
      {hint ? <p className="text-foreground-subtle mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}
