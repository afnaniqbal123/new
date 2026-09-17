import { Types } from 'mongoose';

/**
 * What a completed sale promises to modules outside `sales`.
 *
 * The same reasoning as `ProductView`: a consumer that imports
 * `sale.schema.ts` is coupled to how sales happens to store things, and
 * `architecture:check` blocks it for that reason. `SaleDocument` is
 * structurally assignable to this, so no mapping is needed at the boundary —
 * the type simply narrows what a caller is allowed to rely on.
 *
 * Deliberately minimal. If another module needs more than this, that is worth
 * noticing rather than accommodating silently.
 */
export interface SaleRef {
  readonly _id: Types.ObjectId;
  readonly invoiceNumber: string;
  readonly grandTotal: number;
  readonly paidTotal: number;
  readonly dueTotal: number;
}
