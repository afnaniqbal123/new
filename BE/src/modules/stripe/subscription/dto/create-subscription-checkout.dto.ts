import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsUrl,
} from 'class-validator';

export class CreateSubscriptionCheckoutDto {
  @ApiProperty({
    description: 'Stripe Price ID for the subscription plan',
    example: 'price_1234567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  priceId: string;

  @ApiProperty({
    description: 'URL to redirect after successful subscription',
    example: 'https://yoursite.com/subscription/success',
  })
  @IsUrl()
  @IsNotEmpty()
  successUrl: string;

  @ApiProperty({
    description: 'URL to redirect if subscription is cancelled',
    example: 'https://yoursite.com/subscription/cancel',
  })
  @IsUrl()
  @IsNotEmpty()
  cancelUrl: string;

  @ApiProperty({
    description: 'Metadata to attach to the subscription',
    example: { source: 'website', campaign: 'spring-sale' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}
