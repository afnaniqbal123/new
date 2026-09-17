import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomerService } from 'src/modules/customer/customer.service';
import { CustomerController } from 'src/modules/customer/customer.controller';
import { Customer, CustomerSchema } from 'src/modules/customer/customer.schema';
import {
  CustomerLedgerEntry,
  CustomerLedgerEntrySchema,
} from 'src/modules/customer/customer-ledger.schema';
import { CustomerPolicy } from 'src/modules/customer/policies/customer.policy';
import { AuthModule } from 'src/modules/auth/auth.module';

/**
 * Owns customers and the receivables ledger — one module because they are one
 * aggregate, and the credit-limit invariant needs both to be enforced at all.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: CustomerLedgerEntry.name, schema: CustomerLedgerEntrySchema },
    ]),
    AuthModule,
  ],
  controllers: [CustomerController],
  providers: [CustomerService, CustomerPolicy],
  exports: [CustomerService],
})
export class CustomerModule {}
