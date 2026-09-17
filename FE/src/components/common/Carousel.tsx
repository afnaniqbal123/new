import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from 'src/components/common/Icon';

interface CarouselProps {
  /** One node per slide. Each is rendered in its own labelled group. */
  slides: readonly { id: string; content: ReactNode }[];
  /** Accessible name for the whole carousel — what the set of slides is. */
  label: string;
  /** Milliseconds between automatic advances. Omit to disable autoplay. */
  autoplayMs?: number;
}

/**
 * A slide deck that behaves like one.
 *
 * ## The accessibility contract this keeps
 *
 * Carousels are the classic accessibility failure, so the rules here are not
 * optional:
 *
 * - The region is `aria-roledescription="carousel"` with a real label, and
 *   each slide announces its position ("2 of 4").
 * - **Autoplay stops permanently the moment anyone interacts** — clicking an
 *   arrow, a dot, or focusing anything inside. Content that moves while you
 *   are reading it is the whole problem with carousels, and pausing only on
 *   hover does not help a keyboard user.
 * - It also pauses while the tab is hidden and while the carousel is scrolled
 *   out of view, and never starts at all under `prefers-reduced-motion`.
 * - Arrow keys move between slides while focus is on its controls.
 * - Off-screen slides are `inert`, so a screen reader and the tab order only
 *   ever reach the visible one.
 *
 * ## Why transform rather than a scroll container
 *
 * A single translated track keeps every slide the same width as the viewport
 * of the carousel, which is what makes "2 of 4" honest. A scroll-snap
 * container can rest between two slides, and then the announced position is a
 * guess.
 */
export function Carousel({ slides, label, autoplayMs }: CarouselProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [engaged, setEngaged] = useState(false);
  const [visible, setVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const count = slides.length;

  const go = useCallback(
    (next: number) => {
      setIndex(((next % count) + count) % count);
    },
    [count]
  );

  /** Any deliberate interaction ends autoplay for the rest of the visit. */
  const engage = useCallback(() => {
    setEngaged(true);
  }, []);

  /**
   * Left/right arrows move between slides.
   *
   * Attached to the control buttons rather than to the carousel container: a
   * `role="group"` div is not an interactive element, and hanging key
   * listeners on one both trips `jsx-a11y/no-noninteractive-element-interactions`
   * and creates a target that a keyboard user cannot reach to use. The
   * buttons are already in the tab order, which is where someone pressing an
   * arrow key will actually be.
   */
  const onArrowKey = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;

      event.preventDefault();
      engage();
      go(index + (event.key === 'ArrowRight' ? 1 : -1));
    },
    [engage, go, index]
  );

  useEffect(() => {
    const node = containerRef.current;

    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry?.isIntersecting ?? false);
      },
      { threshold: 0.4 }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (autoplayMs === undefined || engaged || !visible || count < 2) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = window.setInterval(() => {
      // Hidden tab: browsers throttle rather than stop timers, so skipping
      // here keeps the deck where the reader left it.
      if (!document.hidden) setIndex((current) => (current + 1) % count);
    }, autoplayMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [autoplayMs, engaged, visible, count]);

  return (
    <div
      ref={containerRef}
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      className="relative"
      onFocusCapture={engage}
    >
      <div className="overflow-hidden rounded-2xl">
        <div
          className="flex transition-transform duration-500 ease-out"
          // The one inline style in the app: the offset is a live value that
          // cannot be a class. `--tw-translate-x` would need the same runtime
          // number, so a utility buys nothing here.
          style={{ transform: `translateX(-${String(index * 100)}%)` }}
        >
          {slides.map((slide, slideIndex) => (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={t('CAROUSEL_SLIDE_POSITION', {
                index: slideIndex + 1,
                total: count,
              })}
              // Keeps off-screen slides out of the tab order and out of the
              // accessibility tree, which is what stops a carousel from
              // hiding focus somewhere nobody can see.
              inert={slideIndex !== index}
              className="w-full shrink-0"
            >
              {slide.content}
            </div>
          ))}
        </div>
      </div>

      {count > 1 ? (
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label={t('CAROUSEL_PREVIOUS')}
            onKeyDown={onArrowKey}
            onClick={() => {
              engage();
              go(index - 1);
            }}
            className="border-border text-foreground-muted hover:border-brand-500 hover:text-brand-600 flex size-9 items-center justify-center rounded-full border transition-colors"
          >
            <Icon name="arrowRight" className="size-4 rotate-180" />
          </button>

          <ul className="flex items-center gap-2">
            {slides.map((slide, slideIndex) => (
              <li key={slide.id}>
                <button
                  type="button"
                  aria-label={t('CAROUSEL_GO_TO', { index: slideIndex + 1 })}
                  aria-current={slideIndex === index}
                  onKeyDown={onArrowKey}
                  onClick={() => {
                    engage();
                    go(slideIndex);
                  }}
                  className={`block h-2 rounded-full transition-all ${
                    slideIndex === index ? 'bg-brand-500 w-6' : 'bg-border hover:bg-brand-400 w-2'
                  }`}
                />
              </li>
            ))}
          </ul>

          <button
            type="button"
            aria-label={t('CAROUSEL_NEXT')}
            onKeyDown={onArrowKey}
            onClick={() => {
              engage();
              go(index + 1);
            }}
            className="border-border text-foreground-muted hover:border-brand-500 hover:text-brand-600 flex size-9 items-center justify-center rounded-full border transition-colors"
          >
            <Icon name="arrowRight" className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
