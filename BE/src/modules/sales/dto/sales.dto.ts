import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  DISCOUNT_TYPE,
  PAYMENT_METHOD,
  SALE_SOURCE,
  SALE_STATUS,
} from 'src/modules/sales/constants/sales.constant';

export class SaleLineDto {
  @ApiProperty({ description: 'Product id' })
  @IsMongoId()
  product: string;

  /**
   * Fractional quantities are supported deliberately — goods sold by weight
   * are half a distributor's catalogue, and forcing integers would make the
   * system unusable for them.
   */
  @ApiProperty({ example: 2 })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({
    required: false,
    example: 19999,
    description:
      'Overrides the catalogue price, in minor units. Negotiated pricing is normal in distribution.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  unitPrice?: number;

  @ApiProperty({ required: false, example: 500 })
  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;

  @ApiProperty({ required: false, enum: DISCOUNT_TYPE })
  @IsOptional()
  @IsEnum(DISCOUNT_TYPE)
  discountType?: DISCOUNT_TYPE;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  batchNo?: string;
}

export class SalePaymentDto {
  @ApiProperty({ enum: PAYMENT_METHOD, example: PAYMENT_METHOD.CASH })
  @IsEnum(PAYMENT_METHOD)
  method: PAYMENT_METHOD;

  @ApiProperty({ example: 118000, description: 'Minor units' })
  @IsInt()
  @IsPositive()
  amount: number;

  @ApiProperty({ required: false, example: 'Cheque 004512' })
  @IsOptional()
  @IsString()
  reference?: string;
}

export class CreateSaleDto {
  @ApiProperty({
    required: false,
    description:
      'Omit for a walk-in cash sale. Required if anything is unpaid.',
  })
  @IsOptional()
  @IsMongoId()
  customer?: string;

  @ApiProperty({
    required: false,
    description: 'Defaults to the main location',
  })
  @IsOptional()
  @IsMongoId()
  location?: string;

  @ApiProperty({ type: [SaleLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  lines: SaleLineDto[];

  @ApiProperty({ required: false, type: [SalePaymentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalePaymentDto)
  payments?: SalePaymentDto[];

  @ApiProperty({
    required: false,
    example: 1000,
    description: 'Invoice-level discount, on top of any line discounts.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;

  @ApiProperty({ required: false, enum: DISCOUNT_TYPE })
  @IsOptional()
  @IsEnum(DISCOUNT_TYPE)
  discountType?: DISCOUNT_TYPE;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    required: false,
    description: 'The WhatsApp conversation this sale came from, when it did.',
  })
  @IsOptional()
  @IsMongoId()
  conversation?: string;
}

export class RecordSalePaymentDto {
  @ApiProperty({ enum: PAYMENT_METHOD })
  @IsEnum(PAYMENT_METHOD)
  method: PAYMENT_METHOD;

  @ApiProperty({ example: 50000, description: 'Minor units' })
  @IsInt()
  @IsPositive()
  amount: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reference?: string;
}

export class VoidSaleDto {
  @ApiProperty({ example: 'Customer cancelled before delivery' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 500)
  reason: string;
}

export class SaleQueryDto {
  @ApiProperty({ required: false, enum: SALE_STATUS })
  @IsOptional()
  @IsEnum(SALE_STATUS)
  status?: SALE_STATUS;

  @ApiProperty({ required: false, enum: SALE_SOURCE })
  @IsOptional()
  @IsEnum(SALE_SOURCE)
  source?: SALE_SOURCE;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  customer?: string;

  @ApiProperty({ required: false, description: 'Only sales with money owing' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unpaid?: boolean;

  @ApiProperty({
    required: false,
    description: 'Invoice number or customer name',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, example: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class SaleReturnLineDto {
  @ApiProperty({ description: 'Product id' })
  @IsMongoId()
  product: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsPositive()
  quantity: number;
}

export class CreateSaleReturnDto {
  @ApiProperty({ description: 'The sale being returned against' })
  @IsMongoId()
  sale: string;

  @ApiProperty({ type: [SaleReturnLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleReturnLineDto)
  lines: SaleReturnLineDto[];

  @ApiProperty({
    required: false,
    description: 'Refund now in cash, or credit the customer account.',
  })
  @IsOptional()
  @IsBoolean()
  refundNow?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
