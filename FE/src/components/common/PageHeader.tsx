import type { ReactNode } from 'react';
import { BackButton } from 'src/components/common/BackButton';
import { cn } from 'src/lib/utils';

interface PageHeaderProps {
  title: string;
  /**
   * One line of context. Not a subtitle for its own sake — omit if obvious.
   *
   * `| undefined` explicitly: `exactOptionalPropertyTypes` is on, and callers
   * pass an optional field (a date, a phone number) straight through.
   */
  description?: string | undefined;
  /** Buttons, filters — anything the page acts with. */
  actions?: ReactNode | undefined;
  /**
   * Renders a back control above the title, returning here when there is no
   * history to pop (a deep link opened in a fresh tab).
   *
   * Set it on every page reached *from* another — a sale, a customer, a
   * purchase order. Not on a top-level destination the sidebar links to;
   * "back" from a root has no meaning and the control would be noise.
   */
  backTo?: string | undefined;
  /** Overrides the back control's label, e.g. "Back to customers". */
  backLabel?: string | undefined;
  className?: string | undefined;
}

/**
 * The top of every page.
 *
 * Exists so that the `h1` is in exactly one place: heading order is a WCAG
 * requirement, and a per-page header is how a product ends up with three
 * `h1`s on one screen and none on another.
 */
export function PageHeader({
  title,
  description,
  actions,
  backTo,
  backLabel,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-3', className)}>
      {backTo ? (
        <BackButton fallbackTo={backTo} {...(backLabel ? { label: backLabel } : {})} />
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-foreground truncate text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          {description ? (
            <p className="text-foreground-muted mt-1 max-w-prose text-sm">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
