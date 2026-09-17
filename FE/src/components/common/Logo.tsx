import { useTranslation } from 'react-i18next';
import { cn } from 'src/lib/utils';

interface LogoProps {
  /** Renders the wordmark beside the mark. Off for tight spaces. */
  showName?: boolean;
  className?: string;
  /** Extra classes for the mark itself — size overrides go here. */
  markClassName?: string;
}

/**
 * The BusinessOS mark.
 *
 * ## What it draws
 *
 * An isometric carton with its lid open and a line lifting out of it. The two
 * ideas the product is actually about — stock you can account for, and orders
 * arriving from somewhere else — in one glyph. It replaced a rounded square
 * with a letter "B" in it, which is what a logo looks like before anyone has
 * decided what the product is.
 *
 * ## Why it is drawn rather than imported
 *
 * An inline SVG inherits `currentColor` for the strokes and takes its fill
 * from a gradient defined against the theme's own tokens, so it follows light
 * and dark mode with no second asset and no flash of the wrong version. A PNG
 * would need four files and would still be wrong on a themed surface.
 *
 * ## Sizing
 *
 * The mark is `size-9` by default and scales cleanly to `size-6` — below that
 * the carton's inner lines merge, so use the mark alone rather than shrinking
 * further. `gradientUnits="userSpaceOnUse"` keeps the gradient stable at every
 * size; the default (`objectBoundingBox`) re-maps it per element and makes two
 * different-sized marks look like different colours.
 */
export function Logo({ showName = true, className, markClassName }: LogoProps) {
  const { t } = useTranslation();

  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <svg
        viewBox="0 0 40 40"
        // Decorative when the name is beside it; the name is the label. Alone,
        // it is the only thing identifying the product, so it gets a title.
        {...(showName
          ? { 'aria-hidden': 'true', focusable: 'false' }
          : { role: 'img', 'aria-label': t('APP_NAME') })}
        className={cn('size-9 shrink-0', markClassName)}
      >
        <defs>
          <linearGradient
            id="logo-tile"
            x1="0"
            y1="0"
            x2="40"
            y2="40"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="var(--color-brand-500)" />
            <stop offset="100%" stopColor="var(--color-brand-700)" />
          </linearGradient>
        </defs>

        <rect width="40" height="40" rx="11" fill="url(#logo-tile)" />

        {/* The carton: front face, side face, and the open lid. */}
        <g
          fill="none"
          stroke="var(--color-foreground-inverted)"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 19.5 20 24l9-4.5V28l-9 4.5L11 28z" />
          <path d="M11 19.5 20 15l9 4.5" />
          <path d="M20 24v8.5" opacity="0.55" />
          {/* The line lifting out — an order leaving the box. */}
          <path d="M20 15V8" opacity="0.9" />
          <path d="M16.5 10.5 20 7l3.5 3.5" opacity="0.9" />
        </g>
      </svg>

      {showName ? (
        <span className="text-foreground text-lg font-semibold tracking-tight">
          {t('APP_NAME')}
        </span>
      ) : null}
    </span>
  );
}
