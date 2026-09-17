import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class CreateSubscriptionIntentDto {
  @ApiProperty({
    description: 'Stripe Price ID for the subscription plan',
    example: 'price_1234567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  priceId: string;

  @ApiProperty({
    description:
      'Stripe Payment Method ID (optional - uses default card if not provided)',
    example: 'pm_1234567890abcdef',
    required: false,
  })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @ApiProperty({
    description: 'Metadata to attach to the subscription',
    example: { source: 'mobile-app', campaign: 'spring-sale' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}
