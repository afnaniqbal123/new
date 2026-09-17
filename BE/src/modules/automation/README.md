# Automation

The scheduled work that makes this daily-use software rather than a system
someone has to remember to open.

## What it owns

| Collection      | What it is                                            |
| --------------- | ----------------------------------------------------- |
| `AutomationRun` | One execution of one automation, for one org, one hour |

## What runs

| Kind                | When                                  |
| ------------------- | ------------------------------------- |
| `MORNING_DIGEST`    | The org's configured morning hour     |
| `EVENING_SUMMARY`   | The org's configured evening hour     |
| `PAYMENT_REMINDER`  | Overdue receivables                   |
| `LOW_STOCK_ALERT`   | Stock at or below reorder level       |
| `DORMANT_CUSTOMER`  | A regular who has stopped buying      |
| `RECONCILIATION`    | Cache-versus-ledger drift check       |

## Why the cron is hourly

Every organization has its own timezone and its own configured digest hours. A
single daily cron fires at one moment worldwide, which is 9am for exactly one
timezone.

So the cron runs **hourly**, and each tick asks every organization: is it
currently your morning-digest hour, in your timezone? That turns a scheduling
problem into a filtering problem — far easier to reason about, and trivial to
test by feeding it an hour.

## Duplicate prevention

A unique index on `(organization, kind, localDate, localHour)`, not a
check-then-write. Two instances ticking in the same second is precisely the
case a check-then-write loses, and a customer receiving two payment reminders
is a real cost.

## Queue

`JobRunnerService` uses BullMQ when `REDIS_URL` is set and runs in-process
otherwise. In-process means no retries, nothing surviving a restart, and every
instance running every job — fine for one machine, not for two. The warning at
startup says so (CONTEXT.md D13).
