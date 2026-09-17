import { Types } from 'mongoose';
import { stripProfitFigures } from 'src/modules/reports/utils/strip-profit.util';
import { Action } from 'src/modules/authorization/constants/authorization.constant';
import { PROFIT_REPORT_SUBJECT } from 'src/modules/reports/constants/reports.constant';
import type { AppAbility } from 'src/modules/authorization/types/app-ability.type';

/** Minimal stand-in: the util only ever asks `can(Read, PROFIT_REPORT_SUBJECT)`. */
function abilityThatCan(allowed: boolean): AppAbility {
  return {
    can: (action: unknown, subject: unknown) =>
      allowed && action === Action.Read && subject === PROFIT_REPORT_SUBJECT,
  } as unknown as AppAbility;
}

describe('stripProfitFigures', () => {
  const denied = abilityThatCan(false);

  it('removes every margin figure for a caller without profit access', () => {
    const result = stripProfitFigures(
      {
        today: { revenue: 1000, profit: 400, cost: 600 },
        stockValue: 50_000,
        rows: [{ name: 'Cola', revenue: 100, marginPercent: 22 }],
      },
      denied,
    );

    expect(result).toEqual({
      today: { revenue: 1000 },
      rows: [{ name: 'Cola', revenue: 100 }],
    });
  });

  it('returns the input untouched when the caller may read profit', () => {
    const input = { today: { revenue: 1000, profit: 400 } };

    expect(stripProfitFigures(input, abilityThatCan(true))).toBe(input);
  });

  it('strips when there is no ability at all', () => {
    expect(stripProfitFigures({ profit: 1 }, undefined)).toEqual({});
  });

  /**
   * The regression this file exists for.
   *
   * `stripDeep` recurses into every object. An ObjectId *is* an object, so it
   * used to be spread like a plain one — yielding `{ i0, i1, i2, i3 }`, its
   * internal buffer, in place of the id. The backend returned 200 and the
   * payload had the right shape, so nothing failed server-side; the client's
   * schema rejected it and the dashboard showed "An error occurred" for
   * precisely the roles this function strips for, and for nobody else.
   */
  it('keeps an ObjectId an id rather than spreading its internals', () => {
    const id = new Types.ObjectId();

    const result = stripProfitFigures(
      { recentSales: [{ _id: id, invoiceNumber: 'KT-000098', profit: 900 }] },
      denied,
    ) as { recentSales: { _id: unknown; invoiceNumber: string }[] };

    expect(result.recentSales[0]?._id).toBe(id.toHexString());
    expect(result.recentSales[0]?.invoiceNumber).toBe('KT-000098');
    expect(result.recentSales[0]).not.toHaveProperty('profit');
  });

  it('converts a Mongoose document through toObject, ids intact', () => {
    const id = new Types.ObjectId();
    const document = {
      toObject: () => ({ _id: id, total: 500, profit: 120 }),
    };

    // Through `unknown`: the input's `sale` is a document-shaped object and
    // the output's is the plain object it becomes, which TypeScript rightly
    // says do not overlap — that transformation is the thing under test.
    const result = stripProfitFigures(
      { sale: document },
      denied,
    ) as unknown as {
      sale: { _id: unknown; total: number };
    };

    expect(result.sale._id).toBe(id.toHexString());
    expect(result.sale.total).toBe(500);
    expect(result.sale).not.toHaveProperty('profit');
  });

  it('leaves dates as dates', () => {
    const when = new Date('2026-09-13T00:00:00.000Z');

    const result = stripProfitFigures({ completedAt: when }, denied);

    expect(result.completedAt).toBe(when);
  });
});
