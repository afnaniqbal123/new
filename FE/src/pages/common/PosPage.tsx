import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAYMENT_METHOD_LABEL } from 'src/constants/labels';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from 'src/components/common/PageHeader';
import { Panel } from 'src/components/common/Panel';
import { Money } from 'src/components/common/Money';
import { Badge } from 'src/components/common/Badge';
import { Button } from 'src/components/common/Button';
import { SearchInput } from 'src/components/common/SearchInput';
import { EmptyState } from 'src/components/common/EmptyState';
import { Icon } from 'src/components/common/Icon';
import { Seo } from 'src/components/common/Seo';
import { QueryKey } from 'src/constants/queryKeys';
import { useCustomers, useOrganization, useProducts } from 'src/hooks/common/useBusinessData';
import { useCreateSale } from 'src/hooks/common/useBusinessMutations';
import { businessService, type SaleLineInput } from 'src/services/common/businessService';
import { formatQuantity } from 'src/utils/money';
import type { Product } from 'src/schemas/common/business.schema';

/** One line in the basket. Quantity only — never a price. */
interface BasketLine {
  product: Product;
  quantity: number;
}

const PAYMENT_METHODS = ['CASH', 'BANK', 'CARD'] as const;

/**
 * The counter.
 *
 * ## The one design decision that matters here
 *
 * **This screen never calculates money.** It holds a list of products and
 * quantities, sends them to `POST /sales/quote`, and displays what comes
 * back. The cashier therefore sees the *server's* total, computed by the same
 * code that will charge it — so the figure on screen and the figure on the
 * invoice cannot disagree.
 *
 * The tempting alternative — multiply price by quantity in the browser for
 * instant feedback — introduces a second pricing engine that must stay in
 * step with tax rules, customer discounts, minimum prices and rounding. It
 * would be wrong the first time a customer had a standing discount, and wrong
 * silently.
 *
 * The quote is debounced rather than fired per keystroke, which keeps it
 * responsive without a request per basket tap.
 */
export function PosPage() {
  const { t } = useTranslation();
  // Held as the *debounced* value: SearchInput is uncontrolled and debounces
  // internally, so this state only ever changes at the rate we want to query.
  const [search, setSearch] = useState('');
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [onCredit, setOnCredit] = useState(false);
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>('CASH');

  const { data: organization } = useOrganization();
  const { data: productPage } = useProducts({
    search: search || undefined,
    limit: 24,
  });
  const { data: customerPage } = useCustomers({ limit: 100 });
  const createSale = useCreateSale();

  const currency = organization?.currency ?? 'PKR';
  const products = productPage?.items ?? [];
  const customers = customerPage?.items ?? [];

  /** The lines, in the shape the API takes. Also the quote's cache key. */
  const lines: SaleLineInput[] = useMemo(
    () =>
      basket.map((line) => ({
        product: line.product._id,
        quantity: line.quantity,
      })),
    [basket]
  );

  /**
   * The authoritative total.
   *
   * A query rather than local arithmetic — see this component's doc comment.
   * Keyed on the lines and the customer because both change the answer: a
   * customer's standing discount and tax registration are inputs to pricing.
   */
  const { data: quote, isFetching: isPricing } = useQuery({
    queryKey: [QueryKey.SALE_QUOTE, lines, customerId],
    queryFn: () =>
      businessService.quoteSale({
        customer: customerId || undefined,
        lines,
      }),
    enabled: lines.length > 0,
    placeholderData: (previous) => previous,
  });

  function addToBasket(product: Product) {
    setBasket((current) => {
      const existing = current.find((line) => line.product._id === product._id);

      if (existing) {
        return current.map((line) =>
          line.product._id === product._id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }

      return [...current, { product, quantity: 1 }];
    });
  }

  function setQuantity(productId: string, quantity: number) {
    setBasket((current) =>
      quantity <= 0
        ? current.filter((line) => line.product._id !== productId)
        : current.map((line) => (line.product._id === productId ? { ...line, quantity } : line))
    );
  }

  const selectedCustomer = customers.find((customer) => customer._id === customerId);

  /**
   * Whether the basket can be completed.
   *
   * Credit needs a customer to owe it — the API enforces this, and checking
   * here too means the cashier is told before they press the button rather
   * than after.
   */
  const canComplete = basket.length > 0 && quote !== undefined && (!onCredit || customerId !== '');

  function completeSale() {
    if (!quote) return;

    createSale.mutate(
      {
        customer: customerId || undefined,
        lines,
        // An empty payment list *is* the credit case — the backend derives
        // sale type from what was actually paid, never from a flag.
        payments: onCredit ? [] : [{ method, amount: quote.grandTotal }],
      },
      {
        onSuccess: () => {
          setBasket([]);
          setCustomerId('');
          setOnCredit(false);
        },
      }
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Seo title={t('POS_TITLE')} />
      <PageHeader title={t('POS_TITLE')} />

      <div className="lg:grid-cols-pos grid gap-4">
        {/* --- Product picker --- */}
        <div className="flex flex-col gap-4">
          <SearchInput
            onChange={setSearch}
            delayMs={250}
            placeholder={t('POS_SEARCH_PLACEHOLDER')}
            label={t('SEARCH')}
          />

          {products.length === 0 ? (
            <EmptyState title={t('POS_NO_PRODUCTS')} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => {
                const outOfStock = product.trackStock && product.stockOnHand <= 0;

                return (
                  <li key={product._id}>
                    <button
                      type="button"
                      onClick={() => {
                        addToBasket(product);
                      }}
                      // Out-of-stock products stay clickable: the
                      // organization may allow negative stock, and the API is
                      // the authority on that. The badge warns; it does not
                      // pre-empt a decision the server makes.
                      className="border-border bg-surface-raised hover:border-brand-400 focus-visible:border-brand-500 flex w-full flex-col gap-1 rounded-xl border p-3 text-left transition-colors"
                    >
                      <span className="text-foreground line-clamp-2 text-sm font-medium">
                        {product.name}
                      </span>
                      <span className="text-foreground-subtle font-mono text-xs">
                        {product.sku}
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-2">
                        <Money amount={product.sellingPrice} currency={currency} size="sm" />
                        {product.trackStock ? (
                          <Badge tone={outOfStock ? 'danger' : 'neutral'}>
                            {outOfStock
                              ? t('POS_OUT_OF_STOCK')
                              : t('POS_IN_STOCK', {
                                  count: product.stockOnHand,
                                })}
                          </Badge>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* --- Basket --- */}
        <div className="flex flex-col gap-4">
          <Panel title={t('POS_BASKET')} flush>
            {basket.length === 0 ? (
              <div className="p-4">
                <EmptyState title={t('POS_BASKET_EMPTY')} />
              </div>
            ) : (
              <ul className="divide-border divide-y">
                {basket.map((line) => (
                  <li key={line.product._id} className="flex flex-col gap-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-foreground text-sm font-medium">
                        {line.product.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setQuantity(line.product._id, 0);
                        }}
                        aria-label={t('POS_REMOVE_LINE', {
                          name: line.product.name,
                        })}
                        // size-11 (44px) keeps the tap target at the
                        // accessible minimum; -m-2 offsets the extra box so
                        // it doesn't visually crowd the row.
                        className="text-foreground-subtle hover:text-danger hover:bg-surface-muted -m-2 flex size-11 shrink-0 items-center justify-center rounded-md"
                      >
                        <Icon name="close" className="size-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={`qty-${line.product._id}`}
                        className="text-foreground-muted text-xs"
                      >
                        {t('POS_QUANTITY')}
                      </label>
                      <input
                        id={`qty-${line.product._id}`}
                        type="number"
                        min={0}
                        step="any"
                        value={line.quantity}
                        onChange={(event) => {
                          setQuantity(line.product._id, Number(event.target.value));
                        }}
                        className="border-border bg-surface text-foreground tabular w-20 rounded-md border px-2 py-1 text-sm"
                      />
                      <span className="text-foreground-subtle text-xs">{line.product.unit}</span>
                      <span className="ml-auto">
                        <Money
                          amount={line.product.sellingPrice}
                          currency={currency}
                          size="sm"
                          tone="muted"
                        />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <div className="flex flex-col gap-3">
              <div>
                <label
                  htmlFor="pos-customer"
                  className="text-foreground-muted mb-1 block text-xs font-medium"
                >
                  {t('POS_CUSTOMER')}
                </label>
                <select
                  id="pos-customer"
                  value={customerId}
                  onChange={(event) => {
                    setCustomerId(event.target.value);
                  }}
                  className="border-border bg-surface text-foreground w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">{t('POS_WALK_IN')}</option>
                  {customers.map((customer) => (
                    <option key={customer._id} value={customer._id}>
                      {customer.businessName || customer.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCustomer ? (
                <p className="text-foreground-subtle text-xs">
                  {t('CUSTOMERS_OUTSTANDING')}{' '}
                  <Money
                    amount={selectedCustomer.outstanding}
                    currency={currency}
                    size="sm"
                    tone={selectedCustomer.outstanding > 0 ? 'debt' : 'muted'}
                  />{' '}
                  / {t('CUSTOMERS_CREDIT_LIMIT')}{' '}
                  <Money
                    amount={selectedCustomer.creditLimit}
                    currency={currency}
                    size="sm"
                    tone="muted"
                  />
                </p>
              ) : null}

              {/* --- Totals, straight from the server --- */}
              <dl className="border-border flex flex-col gap-1 border-t pt-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-foreground-muted">{t('POS_SUBTOTAL')}</dt>
                  <dd>
                    <Money amount={quote?.subtotal ?? 0} currency={currency} size="sm" />
                  </dd>
                </div>
                {quote && quote.discountTotal > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-foreground-muted">{t('POS_DISCOUNT')}</dt>
                    <dd>
                      <Money
                        amount={-quote.discountTotal}
                        currency={currency}
                        size="sm"
                        tone="positive"
                      />
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-foreground-muted">{quote?.taxLabel ?? t('POS_TAX')}</dt>
                  <dd>
                    <Money
                      amount={(quote?.taxTotal ?? 0) + (quote?.additionalTaxTotal ?? 0)}
                      currency={currency}
                      size="sm"
                    />
                  </dd>
                </div>
                <div className="border-border mt-1 flex items-baseline justify-between border-t pt-2">
                  <dt className="text-foreground font-semibold">{t('POS_TOTAL')}</dt>
                  <dd>
                    <Money amount={quote?.grandTotal ?? 0} currency={currency} size="lg" />
                  </dd>
                </div>
              </dl>

              {isPricing ? (
                <p role="status" className="text-foreground-subtle text-xs">
                  {t('POS_PRICING')}
                </p>
              ) : null}

              <fieldset className="flex flex-col gap-2">
                <legend className="text-foreground-muted mb-1 text-xs font-medium">
                  {t('POS_PAYMENT_METHOD')}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_METHODS.map((candidate) => (
                    <Button
                      key={candidate}
                      type="button"
                      size="sm"
                      variant={!onCredit && method === candidate ? 'primary' : 'secondary'}
                      onClick={() => {
                        setMethod(candidate);
                        setOnCredit(false);
                      }}
                    >
                      {t(PAYMENT_METHOD_LABEL[candidate] ?? 'PAYMENT_CASH')}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant={onCredit ? 'primary' : 'secondary'}
                    onClick={() => {
                      setOnCredit(true);
                    }}
                  >
                    {t('POS_ON_CREDIT')}
                  </Button>
                </div>
              </fieldset>

              {onCredit && !customerId ? (
                <p role="alert" className="text-danger text-xs">
                  {t('DRAFT_NEEDS_CUSTOMER')}
                </p>
              ) : null}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setBasket([]);
                  }}
                  disabled={basket.length === 0}
                >
                  {t('POS_CLEAR')}
                </Button>
                <Button
                  type="button"
                  onClick={completeSale}
                  disabled={!canComplete || createSale.isPending}
                  className="flex-1"
                >
                  {createSale.isPending ? t('LOADING') : t('POS_COMPLETE_SALE')}
                </Button>
              </div>

              {basket.length > 0 ? (
                <p className="text-foreground-subtle text-center text-xs">
                  {formatQuantity(basket.reduce((sum, line) => sum + line.quantity, 0))}{' '}
                  {t('POS_QUANTITY')}
                </p>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
