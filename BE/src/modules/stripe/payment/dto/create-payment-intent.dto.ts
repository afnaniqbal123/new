import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsString,
  IsEmail,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaymentIntentDto {
  @ApiProperty({
    description: 'Amount in cents (minimum 50 cents)',
    example: 2000,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(50)
  @Type(() => Number)
  amount: number;

  @ApiProperty({
    description: 'Currency code (ISO 4217 format)',
    example: 'usd',
    default: 'usd',
  })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({
    description: 'Description of the payment',
    example: 'Product purchase',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Metadata to attach to the payment',
    example: { orderId: 'ORD-123', productId: 'PROD-456' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;

  @ApiProperty({
    description: 'Email for guest payments (required when not authenticated)',
    example: 'customer@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  guestEmail?: string;
}
