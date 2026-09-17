import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'src/lib/utils';
import { formatMoney } from 'src/utils/money';

const moneyVariants = cva('tabular', {
  variants: {
    /**
     * What the amount *means*, not what colour it is.
     *
     * A `debt` amount is amber rather than red because money owed is a state,
     * not an error — and colouring routine receivables red trains people to
     * stop seeing red at all, which is a real cost the first time something
     * genuinely is wrong.
     */
    tone: {
      default: 'text-foreground',
      muted: 'text-foreground-muted',
      positive: 'text-success',
      debt: 'text-warning',
      negative: 'text-danger',
    },
    size: {
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-xl font-semibold',
      xl: 'text-3xl font-semibold tracking-tight',
    },
  },
  defaultVariants: { tone: 'default', size: 'md' },
});

interface MoneyProps extends VariantProps<typeof moneyVariants> {
  /** The amount, in the currency's minor units. Never a major-unit float. */
  amount: number;
  /** ISO 4217 code, from the organization. */
  currency: string;
  /** Abbreviates large figures — for dashboard tiles, not for reconciliation. */
  compact?: boolean | undefined;
  /** Renders the number alone, for a column with a currency in its header. */
  hideCurrency?: boolean | undefined;
  /** Prefixes a positive amount with "+". For ledger movements. */
  showSign?: boolean | undefined;
  className?: string | undefined;
}

/**
 * Renders a monetary amount.
 *
 * The only place the app turns minor units into something a person reads, so
 * that grouping, currency symbol and decimal precision are decided once. Every
 * amount is tabular-figured, because these numbers are read in columns and a
 * total that shifts sideways as its digits change is hard to scan.
 */
export function Money({
  amount,
  currency,
  tone,
  size,
  compact = false,
  hideCurrency = false,
  showSign = false,
  className,
}: MoneyProps) {
  const formatted = formatMoney(amount, currency, {
    compact,
    showCurrency: !hideCurrency,
  });

  return (
    <span className={cn(moneyVariants({ tone, size }), className)}>
      {showSign && amount > 0 ? '+' : ''}
      {formatted}
    </span>
  );
}
