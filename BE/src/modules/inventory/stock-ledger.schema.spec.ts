import { HttpException, HttpStatus } from '@nestjs/common';
import { model } from 'mongoose';
import { INVENTORY_RESPONSE } from 'src/modules/inventory/constants/api-response/inventory.response';
import {
  StockLedgerEntry,
  StockLedgerEntrySchema,
} from 'src/modules/inventory/stock-ledger.schema';

/**
 * The append-only guarantee (CONTEXT.md Invariant #3) is the foundation every
 * stock figure rests on, so it is tested directly rather than trusted.
 *
 * No database is involved: `validate()` and the pre-save hook run against an
 * unsaved document, which is exactly the layer the rule lives in.
 */
describe('StockLedgerEntry schema', () => {
  const LedgerModel = model(
    `StockLedgerEntrySpec_${String(Date.now())}`,
    StockLedgerEntrySchema,
  );

  const validEntry = () =>
    new LedgerModel({
      organization: '507f1f77bcf86cd799439011',
      product: '507f1f77bcf86cd799439012',
      location: '507f1f77bcf86cd799439013',
      quantity: -5,
      unitCost: 10000,
      balanceAfter: 15,
      reason: 'SALE',
    } satisfies Partial<Record<keyof StockLedgerEntry, unknown>>);

  it('accepts a well-formed new movement', async () => {
    await expect(validEntry().validate()).resolves.toBeUndefined();
  });

  it('requires a location, so a movement can always be reconciled', async () => {
    const entry = validEntry();
    entry.set('location', undefined);

    await expect(entry.validate()).rejects.toThrow(/location/i);
  });

  it('requires a known reason', async () => {
    const entry = validEntry();
    entry.set('reason', 'SOMETHING_ELSE');

    await expect(entry.validate()).rejects.toThrow(/reason/i);
  });

  it('refuses to save a modification to an existing movement', async () => {
    const entry = validEntry();

    // Simulates a document loaded from the database rather than newly built —
    // the exact state a well-meaning "just fix the note" edit would be in.
    entry.isNew = false;
    entry.set('note', 'corrected afterwards');

    await expect(entry.save()).rejects.toThrow(HttpException);
  });

  it('refuses with a 409 naming the remedy, not an opaque 500', async () => {
    const entry = validEntry();
    entry.isNew = false;

    // The refusal reaches the client as a real response envelope, so someone
    // who tried to edit a movement is told what to do instead.
    await expect(entry.save()).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: {
        status: HttpStatus.CONFLICT,
        message: INVENTORY_RESPONSE.LEDGER_IMMUTABLE,
      },
    });
  });
});
