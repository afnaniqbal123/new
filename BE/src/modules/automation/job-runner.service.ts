import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { CONFIG } from 'src/constants/config.constant';
import { AUTOMATION_QUEUE } from 'src/modules/automation/constants/automation.constant';

/** What a queued job carries. Deliberately small — ids, not documents. */
export interface AutomationJob {
  kind: string;
  organizationId: string;
}

/** The function that actually performs a job, registered by the service. */
export type JobHandler = (job: AutomationJob) => Promise<void>;

/**
 * Runs background work — through Redis when it is available, in-process when
 * it is not.
 *
 * ## Why the fallback exists
 *
 * Requiring Redis to run the application would mean a developer cannot start
 * it without provisioning one, and a small deployment cannot run at all
 * without paying for one. Neither is acceptable for a product whose first
 * customers are small distributors. CONTEXT.md D13.
 *
 * ## What the fallback is honestly not
 *
 * In-process execution has no retries, no persistence across a restart, and
 * no coordination between instances — two instances would each run the same
 * scheduled job. That is fine for development and for a single-instance
 * deployment, and it is **not** fine at scale. The distinction is logged
 * loudly at boot rather than left for someone to discover, and
 * `isDistributed()` lets callers report it in the UI.
 */
@Injectable()
export class JobRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobRunnerService.name);

  private queue: Queue<AutomationJob> | null = null;
  private worker: Worker<AutomationJob> | null = null;
  private handler: JobHandler | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const redisUrl = this.config.get<string>(CONFIG.REDIS_URL);

    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL is not set — background jobs run in-process. No retries, no persistence across restarts, and every instance runs every scheduled job. Set REDIS_URL before running more than one instance.',
      );

      return;
    }

    try {
      this.queue = new Queue<AutomationJob>(AUTOMATION_QUEUE, {
        connection: { url: redisUrl },
        defaultJobOptions: {
          // Three attempts with backoff: the failures worth retrying here are
          // transient (a WhatsApp send, a Gemini call), and a fourth attempt
          // on a genuine bug is just noise.
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 200 },
          removeOnFail: { count: 500 },
        },
      });

      this.worker = new Worker<AutomationJob>(
        AUTOMATION_QUEUE,
        async (job) => {
          if (!this.handler) return;

          await this.handler(job.data);
        },
        {
          connection: { url: redisUrl },
          // Small: these jobs are database-heavy, and the bottleneck is Mongo
          // rather than the Node event loop.
          concurrency: 4,
        },
      );

      this.worker.on('failed', (job, error) => {
        this.logger.error(
          `Automation job ${job?.data.kind ?? 'unknown'} failed for organization ${job?.data.organizationId ?? 'unknown'}: ${error.message}`,
        );
      });

      this.logger.log('Background jobs are running through Redis (BullMQ).');
    } catch (error) {
      // A misconfigured Redis must not stop the application booting — the
      // in-process path still works, and a shop can still take orders.
      this.logger.error(
        'Failed to connect to Redis; falling back to in-process jobs.',
        error instanceof Error ? error.stack : undefined,
      );

      this.queue = null;
      this.worker = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  /** Whether jobs survive a restart and are shared across instances. */
  isDistributed(): boolean {
    return this.queue !== null;
  }

  /**
   * Registers the function that performs jobs.
   *
   * Set by `AutomationService` on init rather than injected, because the
   * runner must not depend on the service it runs work for — that would be a
   * cycle, and the runner is deliberately ignorant of what a job means.
   */
  registerHandler(handler: JobHandler): void {
    this.handler = handler;
  }

  /**
   * Schedules a job.
   *
   * With Redis, it is enqueued and returns immediately. Without, it runs
   * in-process — but **not awaited**, so an HTTP request that triggers an
   * automation still returns promptly rather than blocking on a digest.
   */
  async enqueue(job: AutomationJob): Promise<void> {
    if (this.queue) {
      await this.queue.add(job.kind, job);

      return;
    }

    if (!this.handler) {
      this.logger.warn(
        `No handler registered; dropping ${job.kind} for organization ${job.organizationId}.`,
      );

      return;
    }

    // Deliberately not awaited. `void` marks that as intentional rather than
    // an unhandled promise, and the catch means a failed job cannot become an
    // unhandled rejection that takes the process down.
    void this.handler(job).catch((error: unknown) => {
      this.logger.error(
        `In-process automation ${job.kind} failed for organization ${job.organizationId}.`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }
}
