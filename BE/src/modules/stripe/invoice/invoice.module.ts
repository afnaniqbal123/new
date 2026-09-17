import { Module, forwardRef } from '@nestjs/common';
import { StripeModule } from '../stripe.module';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { UserModule } from 'src/modules/user/user.module';

/**
 * Invoice module for managing Stripe invoices.
 * This module handles invoice operations (list, create).
 * TODO: Replace with your actual User module
 */
@Module({
  imports: [
    StripeModule,
    forwardRef(() => UserModule), // TODO: Replace with your actual User module
  ],
  providers: [InvoiceService],
  controllers: [InvoiceController],
  exports: [InvoiceService],
})
export class InvoiceModule {}
