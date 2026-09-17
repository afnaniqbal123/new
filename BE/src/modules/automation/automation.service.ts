import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import {
  AutomationRun,
  AutomationRunDocument,
} from 'src/modules/automation/automation-run.schema';
import {
  AUTOMATION_KIND,
  AUTOMATION_STATUS,
  DELIVERY_CHANNEL,
  DORMANT_AFTER_DAYS,
  REMINDER_AFTER_DAYS_OVERDUE,
} from 'src/modules/automation/constants/automation.constant';
import {
  AutomationJob,
  JobRunnerService,
} from 'src/modules/automation/job-runner.service';
import { OrganizationService } from 'src/modules/organization/organization.service';
import { ReportsService } from 'src/modules/reports/reports.service';
import { CustomerService } from 'src/modules/customer/customer.service';
import { CatalogService } from 'src/modules/catalog/catalog.service';
import { InventoryService } from 'src/modules/inventory/inventory.service';
import { ClerkService } from 'src/modules/ai/clerk.service';
import { NotificationService } from 'src/modules/notifications/services/notification.service';

/**
 * The automation layer — what makes this daily-use software rather than a
 * system someone has to remember to open.
 *
 * ## How scheduling works, and why it is an hourly tick
 *
 * Every organization has its own timezone and its own configured digest
 * hours. A single cron per digest would fire at one moment worldwide, which
 * is 9am for exactly one timezone.
 *
 * So the cron runs **hourly**, and each tick asks every organization: is it
 * currently your morning-digest hour? That turns a scheduling problem into a
 * filtering problem, which is far easier to reason about and to test.
 *
 * Duplicate runs are prevented by a unique index on
 * (organization, kind, localDate, localHour) rather than by checking first —
 * two instances ticking at the same second is precisely the case a
 * check-then-write loses.
 */
@Injectable()
export class AutomationService implements OnModuleInit {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    @InjectModel(AutomationRun.name)
    private readonly runModel: Model<AutomationRunDocument>,
    private readonly jobRunner: JobRunnerService,
    private readonly organizationService: OrganizationService,
    private readonly reportsService: ReportsService,
    private readonly customerService: CustomerService,
    private readonly catalogService: CatalogService,
    private readonly inventoryService: InventoryService,
    private readonly clerkService: ClerkService,
    private readonly notificationService: NotificationService,
  ) {}

  onModuleInit(): void {
    // Registered rather than injected so the runner stays ignorant of what a
    // job means — and so there is no cycle between the two.
    this.jobRunner.registerHandler((job) => this.execute(job));
  }

  /**
   * The hourly tick.
   *
   * Deliberately cheap: it reads each organization's settings and enqueues
   * work, rather than doing any of the work itself. A tick that did the work
   * would hold the event loop for as long as the slowest organization takes.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async tick(): Promise<void> {
    const organizations = await this.organizationService.findAllForAutomation();

    for (const organization of organizations) {
      try {
        await this.scheduleForOrganization(organization);
      } catch (error) {
        // One organization's failure must not stop the others' digests.
        this.logger.error(
          `Automation scheduling failed for organization ${String(organization._id)}.`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  private async scheduleForOrganization(organization: {
    _id: unknown;
    timezone: string;
    settings: {
      automationsEnabled: boolean;
      morningDigestHour: number;
      eveningDigestHour: number;
    };
  }): Promise<void> {
    if (!organization.settings.automationsEnabled) return;

    const organizationId = String(organization._id);
    const allowed = await this.organizationService.hasFeature(
      organizationId,
      'automations',
    );

    if (!allowed) return;

    const localHour = this.localHour(organization.timezone);

    if (localHour === organization.settings.morningDigestHour) {
      await this.enqueueOnce(
        organizationId,
        AUTOMATION_KIND.MORNING_DIGEST,
        organization.timezone,
        localHour,
      );
      await this.enqueueOnce(
        organizationId,
        AUTOMATION_KIND.PAYMENT_REMINDER,
        organization.timezone,
        localHour,
      );
      await this.enqueueOnce(
        organizationId,
        AUTOMATION_KIND.LOW_STOCK_ALERT,
        organization.timezone,
        localHour,
      );
    }

    if (localHour === organization.settings.eveningDigestHour) {
      await this.enqueueOnce(
        organizationId,
        AUTOMATION_KIND.EVENING_SUMMARY,
        organization.timezone,
        localHour,
      );
    }

    // Reconciliation runs overnight, when nobody is selling and a full ledger
    // re-sum costs nothing anyone will notice.
    if (localHour === 3) {
      await this.enqueueOnce(
        organizationId,
        AUTOMATION_KIND.RECONCILIATION,
        organization.timezone,
        localHour,
      );
    }
  }

  /**
   * Claims a run slot, then enqueues — in that order.
   *
   * The unique index makes the insert the lock. If a second instance is
   * mid-tick for the same hour, its insert fails and it simply does not
   * enqueue, with no coordination needed between the two.
   */
  private async enqueueOnce(
    organizationId: string,
    kind: AUTOMATION_KIND,
    timezone: string,
    localHour: number,
  ): Promise<void> {
    const localDate = this.localDate(timezone);

    try {
      await this.runModel.create({
        organization: new Types.ObjectId(organizationId),
        kind,
        status: AUTOMATION_STATUS.PENDING,
        localDate,
        localHour,
      });
    } catch {
      // Duplicate key — already claimed for this hour. Nothing to do, and
      // nothing worth logging: this is the mechanism working.
      return;
    }

    await this.jobRunner.enqueue({ kind, organizationId });
  }

  /** Runs one job. The single entry point both queue modes call. */
  async execute(job: AutomationJob): Promise<void> {
    const kind = job.kind as AUTOMATION_KIND;

    switch (kind) {
      case AUTOMATION_KIND.MORNING_DIGEST:
        await this.runMorningDigest(job.organizationId);
        break;

      case AUTOMATION_KIND.EVENING_SUMMARY:
        await this.runEveningSummary(job.organizationId);
        break;

      case AUTOMATION_KIND.PAYMENT_REMINDER:
        await this.runPaymentReminders(job.organizationId);
        break;

      case AUTOMATION_KIND.LOW_STOCK_ALERT:
        await this.runLowStockAlert(job.organizationId);
        break;

      case AUTOMATION_KIND.DORMANT_CUSTOMER:
        await this.runDormantCustomers(job.organizationId);
        break;

      case AUTOMATION_KIND.RECONCILIATION:
        await this.runReconciliation(job.organizationId);
        break;

      default:
        this.logger.warn(`Unknown automation kind: ${job.kind}`);
    }
  }

  // --- The automations ---------------------------------------------------

  /**
   * "Good morning. You have 7 products running low and 4 payments overdue."
   *
   * Every figure is computed deterministically first; the AI, if configured,
   * only writes a sentence around numbers it was handed. If the AI is
   * unavailable the digest still goes out with the figures — the numbers are
   * the product, the prose is decoration. CONTEXT.md D9.
   */
  private async runMorningDigest(organizationId: string): Promise<void> {
    await this.complete(
      organizationId,
      AUTOMATION_KIND.MORNING_DIGEST,
      async () => {
        const dashboard =
          await this.reportsService.getDashboard(organizationId);
        const overdue = await this.customerService.findOverdue(organizationId);

        const facts = {
          lowStockCount: dashboard.lowStockCount,
          overdueCustomers: overdue.length,
          receivables: dashboard.receivables,
          payables: dashboard.payables,
          currency: dashboard.currency,
        };

        const narrative = await this.clerkService.writeDigestNarrative(facts);

        const summary =
          narrative ||
          `Good morning. ${String(dashboard.lowStockCount)} product(s) running low and ${String(overdue.length)} customer(s) with overdue payments.`;

        await this.notifyTeam(organizationId, 'Morning briefing', summary);

        return {
          summary,
          payload: facts,
          itemsAffected: dashboard.lowStockCount + overdue.length,
          channels: [DELIVERY_CHANNEL.IN_APP],
        };
      },
    );
  }

  /** "Today's sales: PKR 4,320 across 18 invoices." */
  private async runEveningSummary(organizationId: string): Promise<void> {
    await this.complete(
      organizationId,
      AUTOMATION_KIND.EVENING_SUMMARY,
      async () => {
        const dashboard =
          await this.reportsService.getDashboard(organizationId);

        const facts = {
          revenue: dashboard.today.revenue,
          orders: dashboard.today.count,
          collected: dashboard.today.collected,
          currency: dashboard.currency,
        };

        const narrative = await this.clerkService.writeDigestNarrative(facts);

        const summary =
          narrative ||
          `Today: ${String(dashboard.today.count)} sale(s), ${dashboard.currency} ${(dashboard.today.revenue / 100).toFixed(2)} taken.`;

        await this.notifyTeam(organizationId, 'Evening summary', summary);

        return {
          summary,
          payload: facts,
          itemsAffected: dashboard.today.count,
          channels: [DELIVERY_CHANNEL.IN_APP],
        };
      },
    );
  }

  /**
   * Chases overdue customers.
   *
   * Notifies in-app rather than messaging customers automatically. Sending a
   * payment chase to a customer without someone deciding to is a good way to
   * damage a relationship the business spent years building — so the
   * automation surfaces *who* to chase, and a human presses send.
   */
  private async runPaymentReminders(organizationId: string): Promise<void> {
    await this.complete(
      organizationId,
      AUTOMATION_KIND.PAYMENT_REMINDER,
      async () => {
        const overdue = await this.customerService.findOverdue(
          organizationId,
          REMINDER_AFTER_DAYS_OVERDUE,
        );

        if (overdue.length === 0) {
          return {
            summary: 'No overdue payments.',
            payload: {},
            itemsAffected: 0,
            channels: [],
          };
        }

        const total = overdue.reduce(
          (sum, customer) => sum + customer.outstanding,
          0,
        );

        const summary = `${String(overdue.length)} customer(s) have overdue payments totalling ${String(total)} (minor units).`;

        await this.notifyTeam(organizationId, 'Overdue payments', summary);

        return {
          summary,
          payload: {
            total,
            customers: overdue.slice(0, 20).map((customer) => ({
              id: String(customer._id),
              name: customer.name,
              outstanding: customer.outstanding,
            })),
          },
          itemsAffected: overdue.length,
          channels: [DELIVERY_CHANNEL.IN_APP],
        };
      },
    );
  }

  private async runLowStockAlert(organizationId: string): Promise<void> {
    await this.complete(
      organizationId,
      AUTOMATION_KIND.LOW_STOCK_ALERT,
      async () => {
        const low = await this.catalogService.findLowStock(organizationId, 100);

        if (low.length === 0) {
          return {
            summary: 'Nothing running low.',
            payload: {},
            itemsAffected: 0,
            channels: [],
          };
        }

        const summary = `${String(low.length)} product(s) at or below reorder level.`;

        await this.notifyTeam(organizationId, 'Low stock', summary);

        return {
          summary,
          payload: {
            products: low.slice(0, 20).map((product) => ({
              id: product.id,
              name: product.name,
              sku: product.sku,
              stockOnHand: product.stockOnHand,
              reorderLevel: product.reorderLevel,
            })),
          },
          itemsAffected: low.length,
          channels: [DELIVERY_CHANNEL.IN_APP],
        };
      },
    );
  }

  /** "Ahmed hasn't purchased in 32 days." */
  private async runDormantCustomers(organizationId: string): Promise<void> {
    await this.complete(
      organizationId,
      AUTOMATION_KIND.DORMANT_CUSTOMER,
      async () => {
        const dormant = await this.customerService.findDormant(
          organizationId,
          DORMANT_AFTER_DAYS,
        );

        const summary =
          dormant.length === 0
            ? 'No dormant customers.'
            : `${String(dormant.length)} customer(s) have not purchased in ${String(DORMANT_AFTER_DAYS)} days.`;

        if (dormant.length > 0) {
          await this.notifyTeam(
            organizationId,
            'Customers going quiet',
            summary,
          );
        }

        return {
          summary,
          payload: {
            customers: dormant.slice(0, 20).map((customer) => ({
              id: String(customer._id),
              name: customer.name,
              lastPurchaseAt: customer.lastPurchaseAt,
            })),
          },
          itemsAffected: dormant.length,
          channels: dormant.length > 0 ? [DELIVERY_CHANNEL.IN_APP] : [],
        };
      },
    );
  }

  /**
   * Rebuilds cached stock levels from the ledger.
   *
   * The repair pass that makes the two-write design in `InventoryService`
   * safe: if a process died between writing a movement and updating the
   * product's cached total, this puts them back in agreement — from the
   * ledger, which is the truth.
   */
  private async runReconciliation(organizationId: string): Promise<void> {
    await this.complete(
      organizationId,
      AUTOMATION_KIND.RECONCILIATION,
      async () => {
        const { items } = await this.catalogService.findProducts(
          organizationId,
          { limit: 500, page: 1 },
        );

        let corrected = 0;

        for (const product of items) {
          const actual = await this.inventoryService.recalculateStock(
            organizationId,
            String(product._id),
          );

          if (actual !== product.stockOnHand) corrected += 1;
        }

        return {
          summary:
            corrected === 0
              ? 'Stock reconciled; no differences found.'
              : `Stock reconciled; ${String(corrected)} product(s) corrected from the ledger.`,
          payload: { checked: items.length, corrected },
          itemsAffected: corrected,
          channels: [],
        };
      },
    );
  }

  /**
   * Fans a digest out to the organization's team.
   *
   * The fan-out lives here rather than in `NotificationService` because that
   * module knows nothing about organizations — teaching it would make the
   * notification layer depend on the tenant module for the sake of one loop.
   *
   * Failures are swallowed per recipient: one member's undeliverable
   * notification must not lose the digest for everyone else.
   */
  private async notifyTeam(
    organizationId: string,
    title: string,
    message: string,
  ): Promise<void> {
    const members = await this.organizationService.listMembers(organizationId);

    await Promise.all(
      members.map(async (member) => {
        const id = member._id.toString();

        try {
          await this.notificationService.sendToUser(id, {
            type: 'automation',
            title,
            message,
          });
        } catch (error) {
          this.logger.warn(
            `Could not notify user ${id}: ${error instanceof Error ? error.message : 'unknown'}`,
          );
        }
      }),
    );
  }

  // --- Plumbing ----------------------------------------------------------

  /**
   * Runs a piece of work and records the outcome against its claimed slot.
   *
   * The slot row already exists — `enqueueOnce` created it as the lock — so
   * this updates rather than inserts. A failure is recorded as FAILED with
   * the message, which is what makes "why didn't I get my digest?" answerable.
   */
  private async complete(
    organizationId: string,
    kind: AUTOMATION_KIND,
    work: () => Promise<{
      summary: string;
      payload: Record<string, unknown>;
      itemsAffected: number;
      channels: DELIVERY_CHANNEL[];
    }>,
  ): Promise<void> {
    const filter = {
      organization: new Types.ObjectId(organizationId),
      kind,
    };

    try {
      await this.runModel.findOneAndUpdate(
        filter,
        { $set: { status: AUTOMATION_STATUS.RUNNING } },
        { sort: { createdAt: -1 } },
      );

      const result = await work();

      await this.runModel.findOneAndUpdate(
        filter,
        {
          $set: {
            status: AUTOMATION_STATUS.COMPLETED,
            summary: result.summary,
            payload: result.payload,
            itemsAffected: result.itemsAffected,
            channels: result.channels,
            completedAt: new Date(),
          },
        },
        { sort: { createdAt: -1 } },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown failure';

      this.logger.error(
        `Automation ${kind} failed for organization ${organizationId}: ${message}`,
      );

      await this.runModel.findOneAndUpdate(
        filter,
        {
          $set: {
            status: AUTOMATION_STATUS.FAILED,
            error: message,
            completedAt: new Date(),
          },
        },
        { sort: { createdAt: -1 } },
      );
    }
  }

  /** Triggers an automation by hand, from the settings screen. */
  async trigger(organizationId: string, kind: AUTOMATION_KIND): Promise<void> {
    const settings = await this.organizationService.getSettings(organizationId);
    const localDate = this.localDate(settings.timezone);
    const localHour = this.localHour(settings.timezone);

    // A manual run reuses the same slot mechanism, so triggering by hand at
    // the same hour the schedule would have fired does not double up.
    await this.runModel.updateOne(
      {
        organization: new Types.ObjectId(organizationId),
        kind,
        localDate,
        localHour,
      },
      {
        $setOnInsert: {
          organization: new Types.ObjectId(organizationId),
          kind,
          localDate,
          localHour,
          status: AUTOMATION_STATUS.PENDING,
        },
      },
      { upsert: true },
    );

    await this.jobRunner.enqueue({ kind, organizationId });
  }

  async getRuns(
    organizationId: string,
    limit = 50,
  ): Promise<AutomationRunDocument[]> {
    return this.runModel
      .find({ organization: new Types.ObjectId(organizationId) })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  /** The most recent completed run of a kind — what the UI shows as "latest". */
  async getLatest(
    organizationId: string,
    kind: AUTOMATION_KIND,
  ): Promise<AutomationRunDocument | null> {
    return this.runModel
      .findOne({
        organization: new Types.ObjectId(organizationId),
        kind,
        status: AUTOMATION_STATUS.COMPLETED,
      })
      .sort({ createdAt: -1 });
  }

  isDistributed(): boolean {
    return this.jobRunner.isDistributed();
  }

  private localHour(timezone: string): number {
    return (
      Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: '2-digit',
          hour12: false,
        }).format(new Date()),
        // `hour12: false` can render midnight as 24 in some locales; the modulo
        // in the caller's comparison would then never match hour 0.
      ) % 24
    );
  }

  private localDate(timezone: string): string {
    // `en-CA` formats as YYYY-MM-DD, which sorts correctly as a string.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }
}
