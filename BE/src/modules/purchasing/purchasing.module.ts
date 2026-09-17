import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PurchasingService } from 'src/modules/purchasing/purchasing.service';
import { PurchasingController } from 'src/modules/purchasing/purchasing.controller';
import {
  Supplier,
  SupplierLedgerEntry,
  SupplierLedgerEntrySchema,
  SupplierSchema,
} from 'src/modules/purchasing/supplier.schema';
import {
  GoodsReceipt,
  GoodsReceiptSchema,
  PurchaseOrder,
  PurchaseOrderSchema,
} from 'src/modules/purchasing/purchase-order.schema';
import { PurchasingPolicy } from 'src/modules/purchasing/policies/purchasing.policy';
import { CatalogModule } from 'src/modules/catalog/catalog.module';
import { InventoryModule } from 'src/modules/inventory/inventory.module';
import { OrganizationModule } from 'src/modules/organization/organization.module';
import { AuthModule } from 'src/modules/auth/auth.module';

/**
 * Owns suppliers, purchase orders, goods receipts and the payables ledger.
 *
 * Goods receipt is the document that writes stock and moves weighted-average
 * cost — see `PurchasingService`. The purchase order writes neither.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Supplier.name, schema: SupplierSchema },
      { name: SupplierLedgerEntry.name, schema: SupplierLedgerEntrySchema },
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
      { name: GoodsReceipt.name, schema: GoodsReceiptSchema },
    ]),
    CatalogModule,
    InventoryModule,
    OrganizationModule,
    AuthModule,
  ],
  controllers: [PurchasingController],
  providers: [PurchasingService, PurchasingPolicy],
  exports: [PurchasingService],
})
export class PurchasingModule {}
