import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

/** Standard "nothing here yet" placeholder — title/description/action are caller-supplied. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="border-border flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-10 text-center">
      <p className="text-foreground font-medium">{title}</p>
      {description ? (
        <p className="text-foreground-muted max-w-prose text-sm">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
