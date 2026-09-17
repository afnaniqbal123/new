import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ConfirmPaymentDto {
  @ApiProperty({
    description: 'Stripe Payment Intent ID',
    example: 'pi_1234567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  paymentIntentId: string;
}
