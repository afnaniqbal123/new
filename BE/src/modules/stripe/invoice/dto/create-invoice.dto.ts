import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceDto {
  @ApiProperty({
    description: 'User ID to create invoice for',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({
    description: 'Amount in cents (e.g., 2000 = $20.00)',
    example: 2000,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Type(() => Number)
  amount: number;

  @ApiProperty({
    description: 'Currency code (ISO 4217 format)',
    example: 'usd',
  })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({
    description: 'Description of the invoice item',
    example: 'Service fee',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Metadata to attach to the invoice item',
    example: { orderId: '12345', source: 'website' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}
