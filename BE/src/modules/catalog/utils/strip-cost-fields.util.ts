import { Action } from 'src/modules/authorization/constants/authorization.constant';
import type { AppAbility } from 'src/modules/authorization/types/app-ability.type';
import { PRODUCT_COST_SUBJECT } from 'src/modules/catalog/constants/catalog.constant';

/**
 * The product fields that reveal margin.
 *
 * `averageCost` and `lastPurchasePrice` are obvious. `minimumPrice` is here
 * because it is a floor derived from cost — telling a cashier the floor is
 * 150 when the shelf price is 200 discloses the margin just as effectively as
 * printing the cost would.
 */
const COST_FIELDS = [
  'averageCost',
  'lastPurchasePrice',
  'minimumPrice',
] as const;

/**
 * Removes cost fields from a product (or a list of them) unless the caller
 * may read `PRODUCT_COST_SUBJECT`.
 *
 * Applied in the controller rather than the service so that internal callers
 * — the sale path, which genuinely needs `averageCost` to stamp a ledger row
 * — are unaffected. It is a presentation rule, not a data-access one.
 *
 * An absent ability means no grants at all, so the fields are stripped. That
 * is the safe direction: a missing ability must never read as permission.
 */
export function stripCostFields<T>(
  input: T,
  ability: AppAbility | undefined,
): T {
  if (ability?.can(Action.Read, PRODUCT_COST_SUBJECT)) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item: unknown) => stripOne(item)) as T;
  }

  return stripOne(input) as T;
}

function stripOne(item: unknown): unknown {
  if (item === null || typeof item !== 'object') {
    return item;
  }

  // Mongoose documents do not spread into a plain object usefully — the
  // enumerable own properties are internals, not the fields. `toObject` is
  // what actually yields the document's data.
  const candidate = item as { toObject?: () => Record<string, unknown> };
  const plain =
    typeof candidate.toObject === 'function'
      ? candidate.toObject()
      : ({ ...(item as Record<string, unknown>) } as Record<string, unknown>);

  for (const field of COST_FIELDS) {
    delete plain[field];
  }

  return plain;
}
