import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryService } from 'src/modules/inventory/inventory.service';
import { StockTransferService } from 'src/modules/inventory/stock-transfer.service';
import { InventoryController } from 'src/modules/inventory/inventory.controller';
import {
  StockLedgerEntry,
  StockLedgerEntrySchema,
} from 'src/modules/inventory/stock-ledger.schema';
import {
  StockTransfer,
  StockTransferSchema,
} from 'src/modules/inventory/stock-transfer.schema';
import { InventoryPolicy } from 'src/modules/inventory/policies/inventory.policy';
import { CatalogModule } from 'src/modules/catalog/catalog.module';
import { OrganizationModule } from 'src/modules/organization/organization.module';
import { AuthModule } from 'src/modules/auth/auth.module';

/**
 * Owns the stock ledger — the append-only truth about stock — and transfers
 * between locations.
 *
 * Exported for every module that moves stock: sales, purchasing, and returns
 * all write through `InventoryService.recordMovements` rather than touching
 * the ledger collection themselves.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StockLedgerEntry.name, schema: StockLedgerEntrySchema },
      { name: StockTransfer.name, schema: StockTransferSchema },
    ]),
    CatalogModule,
    OrganizationModule,
    AuthModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService, StockTransferService, InventoryPolicy],
  exports: [InventoryService, StockTransferService],
})
export class InventoryModule {}
