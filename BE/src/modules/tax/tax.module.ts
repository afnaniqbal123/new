import { Module } from '@nestjs/common';
import { TaxService } from 'src/modules/tax/tax.service';

/**
 * The tax engine. No controller and no schema of its own — tax is arithmetic
 * applied to other modules' documents, not a resource with a lifecycle.
 *
 * Adding a country means adding an adapter and registering it in
 * `TaxService`; no module outside this one changes. CONTEXT.md D7.
 */
@Module({
  providers: [TaxService],
  exports: [TaxService],
})
export class TaxModule {}
