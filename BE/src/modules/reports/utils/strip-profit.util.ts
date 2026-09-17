import { Action } from 'src/modules/authorization/constants/authorization.constant';
import type { AppAbility } from 'src/modules/authorization/types/app-ability.type';
import { PROFIT_REPORT_SUBJECT } from 'src/modules/reports/constants/reports.constant';

/**
 * Figures that disclose margin.
 *
 * `cost` and `profit` are obvious. `marginPercent` and `topTenSharePercent`
 * are here because a percentage discloses the same fact as the absolute
 * number when the revenue beside it is already visible — stripping one and
 * not the other would be theatre.
 */
const PROFIT_KEYS = [
  'profit',
  'cost',
  'costTotal',
  'marginPercent',
  'tiedUpCapital',
  'restockCost',
  'value',
  // Stock valuation is the catalogue priced at cost — margin information by
  // another name, and just as sensitive as printing the cost on each line.
  'stockValue',
] as const;

/**
 * Removes margin figures from a report or dashboard for a caller who may not
 * read `PROFIT_REPORT_SUBJECT`.
 *
 * Done at the controller, not the service, for the same reason cost fields
 * are stripped there: internal callers — the digest job, the AI clerk
 * answering an owner's question — genuinely need the numbers. This is a
 * presentation rule about *this response*, not a data-access rule.
 *
 * An absent ability strips, because a missing ability must never read as
 * permission.
 */
export function stripProfitFigures<T>(
  input: T,
  ability: AppAbility | undefined,
): T {
  if (ability?.can(Action.Read, PROFIT_REPORT_SUBJECT)) {
    return input;
  }

  return stripDeep(input) as T;
}

function stripDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripDeep);
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  /*
   * An ObjectId is an object, so without this it falls through to the spread
   * below — which copies its *internal buffer* and produces
   * `{ i0: 6989222, i1: ... }` instead of an id. The response still had the
   * right shape, so nothing failed here; the frontend's Zod schema rejected
   * the payload and the whole dashboard rendered as "An error occurred" for
   * exactly the roles this function strips for (cashier, viewer) and nobody
   * else. Duck-typed rather than `instanceof Types.ObjectId` so a second copy
   * of bson in the tree cannot quietly defeat the check.
   */
  const maybeObjectId = value as { toHexString?: unknown };

  if (typeof maybeObjectId.toHexString === 'function') {
    return (maybeObjectId as { toHexString: () => string }).toHexString();
  }

  // Buffers are objects too, and spreading one yields a map of byte indices.
  if (Buffer.isBuffer(value)) {
    return value;
  }

  // Mongoose documents do not spread usefully — their enumerable own
  // properties are internals rather than fields.
  const candidate = value as { toObject?: () => Record<string, unknown> };
  const plain =
    typeof candidate.toObject === 'function'
      ? candidate.toObject()
      : ({ ...(value as Record<string, unknown>) } as Record<string, unknown>);

  for (const key of PROFIT_KEYS) {
    delete plain[key];
  }

  for (const [key, nested] of Object.entries(plain)) {
    plain[key] = stripDeep(nested);
  }

  return plain;
}
