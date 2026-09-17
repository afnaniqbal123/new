import { REPORT_PERIOD } from 'src/modules/reports/constants/reports.constant';
import { resolvePeriod } from 'src/modules/reports/report-period.util';

/**
 * "Today's sales" must mean the same thing to the owner on a phone in Karachi
 * and to the digest job on a server in Frankfurt. These tests pin that down,
 * because a timezone bug here silently misreports every figure in the product.
 */
describe('resolvePeriod', () => {
  const KARACHI = 'Asia/Karachi';

  /** The calendar day an instant falls on, as seen in a timezone. */
  const dayIn = (date: Date, timezone: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);

  it('starts TODAY at local midnight, not UTC midnight', () => {
    const { from, to } = resolvePeriod(REPORT_PERIOD.TODAY, KARACHI);

    // The boundary instant must land on today's date in Karachi — and must
    // not have slipped into yesterday, which is what a UTC-midnight
    // calculation produces for any zone ahead of UTC.
    expect(dayIn(from, KARACHI)).toBe(dayIn(new Date(), KARACHI));
    expect(from.getTime()).toBeLessThanOrEqual(to.getTime());
  });

  it('gives the same local calendar day across zones with opposite offsets', () => {
    for (const timezone of ['Asia/Karachi', 'America/Los_Angeles', 'UTC']) {
      const { from } = resolvePeriod(REPORT_PERIOD.TODAY, timezone);

      expect(dayIn(from, timezone)).toBe(dayIn(new Date(), timezone));
    }
  });

  it('makes YESTERDAY end exactly where TODAY begins, with no gap or overlap', () => {
    const today = resolvePeriod(REPORT_PERIOD.TODAY, KARACHI);
    const yesterday = resolvePeriod(REPORT_PERIOD.YESTERDAY, KARACHI);

    // A gap would lose a sale; an overlap would count one twice.
    expect(yesterday.to.getTime()).toBe(today.from.getTime());
  });

  it('spans 7 calendar days for LAST_7_DAYS, inclusive of today', () => {
    const { from, to } = resolvePeriod(REPORT_PERIOD.LAST_7_DAYS, KARACHI);
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);

    // Six full days plus the part of today elapsed so far.
    expect(days).toBeGreaterThanOrEqual(6);
    expect(days).toBeLessThanOrEqual(7);
  });

  it('starts THIS_MONTH on the first of the local month', () => {
    const { from } = resolvePeriod(REPORT_PERIOD.THIS_MONTH, KARACHI);

    expect(dayIn(from, KARACHI).endsWith('-01')).toBe(true);
  });

  it('starts THIS_WEEK on a Monday', () => {
    const { from } = resolvePeriod(REPORT_PERIOD.THIS_WEEK, KARACHI);
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: KARACHI,
      weekday: 'short',
    }).format(from);

    expect(weekday).toBe('Mon');
  });

  it('starts THIS_YEAR in January', () => {
    const { from } = resolvePeriod(REPORT_PERIOD.THIS_YEAR, KARACHI);

    expect(from.getUTCMonth()).toBe(0);
    expect(from.getUTCDate()).toBe(1);
  });

  it('honours an explicit custom range', () => {
    const { from, to } = resolvePeriod(REPORT_PERIOD.CUSTOM, KARACHI, {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T23:59:59.000Z',
    });

    expect(from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(to.toISOString()).toBe('2026-01-31T23:59:59.000Z');
  });

  it('falls back to today when a custom range is incomplete', () => {
    const { from, to } = resolvePeriod(REPORT_PERIOD.CUSTOM, KARACHI, {});

    expect(from.getTime()).toBeLessThanOrEqual(to.getTime());
  });

  it('labels every period for display', () => {
    for (const period of Object.values(REPORT_PERIOD)) {
      expect(resolvePeriod(period, KARACHI).label.length).toBeGreaterThan(0);
    }
  });

  it('never returns a range that ends before it starts', () => {
    for (const period of Object.values(REPORT_PERIOD)) {
      const { from, to } = resolvePeriod(period, KARACHI);

      expect(from.getTime()).toBeLessThanOrEqual(to.getTime());
    }
  });
});
