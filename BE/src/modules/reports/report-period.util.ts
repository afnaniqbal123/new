import { REPORT_PERIOD } from 'src/modules/reports/constants/reports.constant';

export interface ResolvedPeriod {
  from: Date;
  to: Date;
  label: string;
}

/**
 * Turns a named period into a concrete instant range.
 *
 * Resolved on the server, in the Organization's timezone, and never on the
 * client. "Today's sales" must mean the same thing to the owner checking on a
 * phone in Karachi and to the digest job running on a server in Frankfurt —
 * and a client-supplied range would quietly mean whatever the browser's clock
 * said.
 *
 * The timezone offset is applied by formatting into the target zone and
 * reading the parts back, which handles DST without a date library: the
 * offset for a given instant is whatever `Intl` says it is at that instant,
 * not a fixed number.
 */
export function resolvePeriod(
  period: REPORT_PERIOD,
  timezone: string,
  custom?: { from?: string; to?: string },
): ResolvedPeriod {
  if (period === REPORT_PERIOD.CUSTOM) {
    const from = custom?.from
      ? new Date(custom.from)
      : startOfDayIn(timezone, 0);
    const to = custom?.to ? new Date(custom.to) : new Date();

    return { from, to, label: 'Custom range' };
  }

  const now = new Date();

  switch (period) {
    case REPORT_PERIOD.TODAY:
      return {
        from: startOfDayIn(timezone, 0),
        to: now,
        label: 'Today',
      };

    case REPORT_PERIOD.YESTERDAY:
      return {
        from: startOfDayIn(timezone, -1),
        to: startOfDayIn(timezone, 0),
        label: 'Yesterday',
      };

    case REPORT_PERIOD.THIS_WEEK: {
      // Week starts Monday — the convention in every market this targets.
      const parts = zonedParts(now, timezone);
      const weekday = (parts.weekday + 6) % 7;

      return {
        from: startOfDayIn(timezone, -weekday),
        to: now,
        label: 'This week',
      };
    }

    case REPORT_PERIOD.LAST_7_DAYS:
      return {
        from: startOfDayIn(timezone, -6),
        to: now,
        label: 'Last 7 days',
      };

    case REPORT_PERIOD.THIS_MONTH: {
      const parts = zonedParts(now, timezone);

      return {
        from: startOfDayIn(timezone, -(parts.day - 1)),
        to: now,
        label: 'This month',
      };
    }

    case REPORT_PERIOD.LAST_MONTH: {
      const parts = zonedParts(now, timezone);
      const firstOfThisMonth = startOfDayIn(timezone, -(parts.day - 1));
      const lastMonthEnd = new Date(firstOfThisMonth);
      const daysInLastMonth = new Date(
        parts.year,
        parts.month - 1,
        0,
      ).getDate();

      return {
        from: new Date(
          firstOfThisMonth.getTime() - daysInLastMonth * 86_400_000,
        ),
        to: lastMonthEnd,
        label: 'Last month',
      };
    }

    case REPORT_PERIOD.LAST_30_DAYS:
      return {
        from: startOfDayIn(timezone, -29),
        to: now,
        label: 'Last 30 days',
      };

    case REPORT_PERIOD.THIS_YEAR: {
      const parts = zonedParts(now, timezone);

      return {
        from: new Date(Date.UTC(parts.year, 0, 1)),
        to: now,
        label: 'This year',
      };
    }

    default:
      return { from: startOfDayIn(timezone, 0), to: now, label: 'Today' };
  }
}

/** Calendar parts of an instant, as seen in a given timezone. */
function zonedParts(
  date: Date,
  timezone: string,
): { year: number; month: number; day: number; weekday: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: Math.max(weekdays.indexOf(parts.weekday ?? 'Sun'), 0),
  };
}

/**
 * Midnight, `dayOffset` days from today, in the given timezone — returned as
 * the UTC instant that midnight corresponds to.
 *
 * Computed by measuring the zone's actual offset at that instant rather than
 * assuming a fixed one, so a range that spans a DST change stays correct.
 */
function startOfDayIn(timezone: string, dayOffset: number): Date {
  const now = new Date();
  const target = new Date(now.getTime() + dayOffset * 86_400_000);
  const parts = zonedParts(target, timezone);

  // Midnight in the target zone, expressed first as if it were UTC…
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day);

  // …then corrected by the zone's real offset at that moment.
  const offsetMinutes = zoneOffsetMinutes(new Date(asUtc), timezone);

  return new Date(asUtc + offsetMinutes * 60_000);
}

/**
 * How far the given timezone is from UTC at a specific instant, in minutes.
 * Positive west of UTC — the sign convention that makes the addition above
 * read correctly.
 */
function zoneOffsetMinutes(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    // Intl renders midnight as "24" in some locales' hour12:false output.
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );

  return (date.getTime() - asIfUtc) / 60_000;
}
