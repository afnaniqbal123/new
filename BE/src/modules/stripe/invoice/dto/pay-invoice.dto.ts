// dto/pay-invoice.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class PayInvoiceDto {
  @ApiProperty({
    description:
      'Whether to charge the customer’s saved card (true) or mark as paid manually (false)',
    example: true,
  })
  @IsBoolean()
  payWithCard: boolean;
}
