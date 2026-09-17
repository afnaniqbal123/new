import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AutomationService } from 'src/modules/automation/automation.service';
import { JobRunnerService } from 'src/modules/automation/job-runner.service';
import { AutomationController } from 'src/modules/automation/automation.controller';
import {
  AutomationRun,
  AutomationRunSchema,
} from 'src/modules/automation/automation-run.schema';
import { AutomationPolicy } from 'src/modules/automation/policies/automation.policy';
import { OrganizationModule } from 'src/modules/organization/organization.module';
import { ReportsModule } from 'src/modules/reports/reports.module';
import { CustomerModule } from 'src/modules/customer/customer.module';
import { CatalogModule } from 'src/modules/catalog/catalog.module';
import { InventoryModule } from 'src/modules/inventory/inventory.module';
import { AiModule } from 'src/modules/ai/ai.module';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { AuthModule } from 'src/modules/auth/auth.module';

/**
 * Scheduled work: digests, reminders, alerts and reconciliation.
 *
 * `ScheduleModule.forRoot()` is registered here rather than in `AppModule`
 * because this is the only module with a cron — keeping the registration
 * beside its single consumer means removing this module removes the
 * scheduler with it, rather than leaving a global nobody uses.
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: AutomationRun.name, schema: AutomationRunSchema },
    ]),
    OrganizationModule,
    ReportsModule,
    CustomerModule,
    CatalogModule,
    InventoryModule,
    AiModule,
    NotificationsModule,
    AuthModule,
  ],
  controllers: [AutomationController],
  providers: [AutomationService, JobRunnerService, AutomationPolicy],
  exports: [AutomationService, JobRunnerService],
})
export class AutomationModule {}
