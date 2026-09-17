import { cn } from 'src/lib/utils';

/**
 * The icon set.
 *
 * ## Why these are hand-drawn rather than a library
 *
 * An icon font or a package like lucide-react would add a dependency and, more
 * to the point, ship hundreds of glyphs to deliver the twenty this product
 * uses. Every path here is inline, so the bundler keeps only what is actually
 * referenced, and the whole set costs less than the import statement would.
 *
 * ## Conventions every path follows
 *
 * A 24×24 box, stroke-only, `currentColor`, round caps and joins. That means an
 * icon inherits its colour from the text beside it — so it participates in the
 * theme automatically, in light and dark, with no per-icon token (AGENTS.md
 * § Styling Tokens). Never add a `fill` other than `none`; a filled glyph mixed
 * into this set reads as a different weight at the same size.
 *
 * ## Accessibility
 *
 * Decorative by default: `aria-hidden`, because an icon next to its own label
 * announced twice is noise. Pass `title` only when the icon is the *only*
 * carrier of meaning, and it becomes a labelled `img` role instead.
 */
const PATHS = {
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  cart: 'M3 4h2l2.4 10.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L20.5 8H6M9 20h.01M17 20h.01',
  receipt:
    'M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3zM9 8h6M9 12h6M9 16h4',
  chat: 'M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-3.8-.9L3 21l1.9-5.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z',
  box: 'M21 16V8l-9-5-9 5v8l9 5zM3.3 7.5 12 12.5l8.7-5M12 12.5V21',
  layers: 'M12 3 3 8l9 5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5',
  truck:
    'M3 6h11v10H3zM14 9h4l3 3v4h-7zM7.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  users:
    'M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM22 20v-1.5a4 4 0 0 0-3-3.9M16 4.1a4 4 0 0 1 0 7.8',
  building:
    'M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M15 21V10h3a2 2 0 0 1 2 2v9M2 21h20M8 7h3M8 11h3M8 15h3',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  sparkles:
    'M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  card: 'M3 6h18v12H3zM3 10h18M6.5 14.5h3',
  settings:
    'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 15h-.3a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 4.5 6.2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5v-.3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z',
  shield: 'M12 21s7-3.5 7-9V5.5L12 3 5 5.5V12c0 5.5 7 9 7 9zM9.2 11.8l2 2 3.6-3.6',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  check: 'M4 12.5 9 17.5 20 6.5',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3.5 2',
  globe:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.8 5.6 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.6-3.8-9S9.5 5.5 12 3z',
  scale: 'M12 3v18M7 21h10M6 7l-3 6a3 3 0 0 0 6 0zM18 7l-3 6a3 3 0 0 0 6 0zM6 7l6-2 6 2',
  lock: 'M6 11h12v10H6zM9 11V7.5a3 3 0 0 1 6 0V11',
  phone: 'M7 2h10v20H7zM10.5 18.5h3',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',
  monitor: 'M3 5h18v11H3zM9 20h6M12 16v4',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff:
    'M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.2A9.5 9.5 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.2 6.2A17 17 0 0 0 2 12s3.6 7 10 7a9.9 9.9 0 0 0 4-.8',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  className?: string;
  /**
   * Supply ONLY when the icon carries meaning no adjacent text already does —
   * it turns the graphic into a labelled `img` for assistive technology.
   */
  title?: string;
}

export function Icon({ name, className, title }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-5 shrink-0', className)}
      {...(title ? { role: 'img' } : { 'aria-hidden': 'true', focusable: 'false' })}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}
