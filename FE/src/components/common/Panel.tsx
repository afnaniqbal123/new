import type { ReactNode } from 'react';
import { cn } from 'src/lib/utils';

interface PanelProps {
  children: ReactNode;
  title?: string | undefined;
  /** Shown beside the title — a link, a filter, a count. */
  action?: ReactNode | undefined;
  /** Removes the inner padding, for a panel wrapping a full-bleed table. */
  flush?: boolean | undefined;
  className?: string | undefined;
}

/**
 * A titled surface.
 *
 * The single card treatment in the product. Every list, chart and form sits
 * in one of these, so the app reads as one system rather than as a set of
 * screens that each invented their own border radius.
 */
export function Panel({ children, title, action, flush = false, className }: PanelProps) {
  return (
    <section
      className={cn('border-border bg-surface-raised shadow-card rounded-xl border', className)}
    >
      {title ? (
        <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-foreground text-sm font-semibold">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className={flush ? '' : 'p-4'}>{children}</div>
    </section>
  );
}
