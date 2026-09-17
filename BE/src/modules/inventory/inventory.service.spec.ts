import { InventoryService } from 'src/modules/inventory/inventory.service';
import { STOCK_REASON } from 'src/modules/inventory/constants/inventory.constant';

/**
 * The negative-stock invariant on the manual-adjustment path (Invariant #1).
 *
 * Sales and transfers have always asserted sufficient stock before moving
 * anything. `recordAdjustment` did not, and a write-off larger than the
 * quantity on hand wrote an impossible balance straight into an append-only
 * ledger — where it cannot be edited away afterwards, only corrected by
 * another movement. It surfaced as "-29 in stock" on the dashboard, the
 * catalogue and the reorder screen simultaneously.
 *
 * These tests pin the three things that make the fix correct rather than
 * merely present: outbound lines are checked, inbound ones are not, and the
 * quantities handed to the check are positive amounts *required* rather than
 * the signed movement the ledger stores.
 */
describe('InventoryService.recordAdjustment', () => {
  function buildService() {
    const assertSufficientStock = jest.fn().mockResolvedValue(undefined);
    const recordMovements = jest.fn().mockResolvedValue([]);

    // Only the two collaborators this method calls are needed; constructing
    // the real service would drag in Mongoose models that say nothing about
    // the branch under test.
    const service = Object.create(
      InventoryService.prototype,
    ) as InventoryService;

    Object.assign(service, { assertSufficientStock, recordMovements });

    return { service, assertSufficientStock, recordMovements };
  }

  const ORG = 'org-1';
  const LOCATION = 'loc-1';

  it('checks availability for an outbound line, as a positive quantity', async () => {
    const { service, assertSufficientStock, recordMovements } = buildService();

    await service.recordAdjustment(
      ORG,
      LOCATION,
      [
        {
          productId: 'p-1',
          locationId: LOCATION,
          quantity: -30,
          reason: STOCK_REASON.WRITE_OFF,
        },
      ],
      'user-1',
    );

    // The ledger stores -30; the check asks "are 30 available?".
    expect(assertSufficientStock).toHaveBeenCalledWith(ORG, LOCATION, [
      { productId: 'p-1', quantity: 30 },
    ]);
    expect(recordMovements).toHaveBeenCalled();
  });

  it('does not write anything when the check refuses', async () => {
    const { service, assertSufficientStock, recordMovements } = buildService();

    assertSufficientStock.mockRejectedValue(new Error('Not enough stock'));

    await expect(
      service.recordAdjustment(ORG, LOCATION, [
        {
          productId: 'p-1',
          locationId: LOCATION,
          quantity: -30,
          reason: STOCK_REASON.WRITE_OFF,
        },
      ]),
    ).rejects.toThrow('Not enough stock');

    // The whole point: the ledger is append-only, so a movement written before
    // the refusal could not be taken back.
    expect(recordMovements).not.toHaveBeenCalled();
  });

  it('skips the check entirely for an inbound-only adjustment', async () => {
    const { service, assertSufficientStock, recordMovements } = buildService();

    await service.recordAdjustment(ORG, LOCATION, [
      {
        productId: 'p-1',
        locationId: LOCATION,
        quantity: 40,
        reason: STOCK_REASON.OPENING,
        unitCost: 1000,
      },
    ]);

    // Adding stock cannot breach the invariant, and querying availability to
    // prove that would be a database round trip per opening-stock line.
    expect(assertSufficientStock).not.toHaveBeenCalled();
    expect(recordMovements).toHaveBeenCalled();
  });

  it('checks only the outbound lines of a mixed batch', async () => {
    const { service, assertSufficientStock } = buildService();

    await service.recordAdjustment(ORG, LOCATION, [
      {
        productId: 'p-1',
        locationId: LOCATION,
        quantity: 10,
        reason: STOCK_REASON.ADJUSTMENT,
      },
      {
        productId: 'p-2',
        locationId: LOCATION,
        quantity: -5,
        reason: STOCK_REASON.ADJUSTMENT,
      },
    ]);

    expect(assertSufficientStock).toHaveBeenCalledWith(ORG, LOCATION, [
      { productId: 'p-2', quantity: 5 },
    ]);
  });
});
