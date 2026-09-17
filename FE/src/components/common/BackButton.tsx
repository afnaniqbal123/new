import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from 'src/components/common/Icon';

interface BackButtonProps {
  /**
   * Where to go when there is no history to go back to — a deep link opened
   * in a fresh tab, or a page reached by a redirect.
   */
  fallbackTo: string;
  /** Overrides the default "Back" label, e.g. "Back to customers". */
  label?: string;
}

/**
 * Goes back, and knows where it is when it cannot.
 *
 * `navigate(-1)` alone is a trap: on a deep link opened in a new tab there is
 * no entry to return to, so the button either does nothing or leaves the site
 * entirely. This checks `history.length` and falls back to a real route, so
 * the control always means something.
 *
 * Every detail route gets one. A sale, a customer, a purchase order — anything
 * reached *from* a list needs a way back to that list that is not the browser
 * chrome, because on a tablet at a counter there often isn't any.
 */
export function BackButton({ fallbackTo, label }: BackButtonProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => {
        // `> 2` rather than `> 1`: a fresh tab starts at 1 and the app's own
        // initial render can already have pushed one entry.
        if (window.history.length > 2) {
          void navigate(-1);
        } else {
          void navigate(fallbackTo, { replace: true });
        }
      }}
      className="text-foreground-muted hover:text-foreground focus-visible:ring-brand-500 -ml-1 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <Icon name="arrowRight" className="size-4 rotate-180" />
      {label ?? t('BUTTON_BACK')}
    </button>
  );
}
