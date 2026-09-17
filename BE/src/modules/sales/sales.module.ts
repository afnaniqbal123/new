import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SalesService } from 'src/modules/sales/sales.service';
import { SaleReturnService } from 'src/modules/sales/sale-return.service';
import { SalesController } from 'src/modules/sales/sales.controller';
import { Sale, SaleSchema } from 'src/modules/sales/sale.schema';
import {
  SaleReturn,
  SaleReturnSchema,
} from 'src/modules/sales/sale-return.schema';
import { SalesPolicy } from 'src/modules/sales/policies/sales.policy';
import { CatalogModule } from 'src/modules/catalog/catalog.module';
import { InventoryModule } from 'src/modules/inventory/inventory.module';
import { CustomerModule } from 'src/modules/customer/customer.module';
import { OrganizationModule } from 'src/modules/organization/organization.module';
import { TaxModule } from 'src/modules/tax/tax.module';
import { AuthModule } from 'src/modules/auth/auth.module';

/**
 * Owns sales, invoices and returns — the POS path.
 *
 * The module with the most collaborators in the system, by necessity:
 * completing a sale has to make stock, tax, credit and invoice numbering all
 * agree. Each of those stays owned by its own module; this one sequences them.
 * See `SalesService`'s class comment for why the order is what it is.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Sale.name, schema: SaleSchema },
      { name: SaleReturn.name, schema: SaleReturnSchema },
    ]),
    CatalogModule,
    InventoryModule,
    CustomerModule,
    OrganizationModule,
    TaxModule,
    AuthModule,
  ],
  controllers: [SalesController],
  providers: [SalesService, SaleReturnService, SalesPolicy],
  exports: [SalesService, SaleReturnService],
})
export class SalesModule {}
