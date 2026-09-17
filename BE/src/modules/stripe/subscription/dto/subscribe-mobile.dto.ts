import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class SubscribeMobileDto {
  @ApiProperty({
    description: 'Stripe Price ID for the subscription plan',
    example: 'price_1234567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  priceId: string;

  @ApiProperty({
    description:
      'The SetupIntent id returned by payment-sheet, after the mobile PaymentSheet has confirmed it (card saved to the customer)',
    example: 'seti_1234567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  setupIntentId: string;
}
