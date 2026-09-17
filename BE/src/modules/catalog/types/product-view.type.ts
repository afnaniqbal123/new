import { Types } from 'mongoose';
import { TAX_TREATMENT } from 'src/modules/catalog/constants/catalog.constant';

/**
 * What the catalogue promises other modules about a product.
 *
 * This exists so that sales, purchasing and inventory depend on a *contract*
 * rather than on `product.schema.ts`. Importing the schema would couple every
 * consumer to how the catalogue happens to store things today — and is
 * blocked by `architecture:check`'s foreign-schema rule for exactly that
 * reason.
 *
 * It is deliberately a read-only projection: a consumer can price a line or
 * stamp a ledger row from it, and cannot write to the catalogue through it.
 * Changing the catalogue's storage is then a change to one mapping function
 * here, not to four other modules.
 */
export interface ProductView {
  readonly id: string;
  readonly _id: Types.ObjectId;
  readonly name: string;
  readonly sku: string;
  readonly unit: string;
  readonly packSize: number;

  /** Weighted-average cost, minor units. */
  readonly averageCost: number;
  readonly lastPurchasePrice: number;
  readonly sellingPrice: number;
  readonly minimumPrice: number;

  readonly taxTreatment: TAX_TREATMENT;
  /** Null means "inherit the organization default" — not "zero-rated". */
  readonly taxRatePercent: number | null;

  readonly stockOnHand: number;
  readonly reorderLevel: number;
  readonly reorderQuantity: number;
  readonly trackStock: boolean;
  readonly trackBatches: boolean;

  readonly preferredSupplier: Types.ObjectId | null;
}
