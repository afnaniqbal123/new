import { Module } from '@nestjs/common';
import { ReportsService } from 'src/modules/reports/reports.service';
import { ReportsController } from 'src/modules/reports/reports.controller';
import { ReportsPolicy } from 'src/modules/reports/policies/reports.policy';
import { SalesModule } from 'src/modules/sales/sales.module';
import { CatalogModule } from 'src/modules/catalog/catalog.module';
import { InventoryModule } from 'src/modules/inventory/inventory.module';
import { CustomerModule } from 'src/modules/customer/customer.module';
import { PurchasingModule } from 'src/modules/purchasing/purchasing.module';
import { OrganizationModule } from 'src/modules/organization/organization.module';
import { AuthModule } from 'src/modules/auth/auth.module';

/**
 * Owns no collection. Every figure comes from the module that owns the data;
 * this one composes them — and publishes the closed report list that doubles
 * as the AI clerk's tool surface. See `ReportsService`.
 */
@Module({
  imports: [
    SalesModule,
    CatalogModule,
    InventoryModule,
    CustomerModule,
    PurchasingModule,
    OrganizationModule,
    AuthModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsPolicy],
  exports: [ReportsService],
})
export class ReportsModule {}
