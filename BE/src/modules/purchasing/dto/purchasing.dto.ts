import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
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
import { PURCHASE_ORDER_STATUS } from 'src/modules/purchasing/constants/purchasing.constant';

export class CreateSupplierDto {
  @ApiProperty({ example: 'Shaheen Distributors' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 160)
  name: string;

  @ApiProperty({ required: false, example: 'Imran Sheikh' })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiProperty({ required: false, example: '+92 21 35678901' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  taxRegistrationNumber?: string;

  @ApiProperty({ required: false, example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  paymentTermDays?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateSupplierDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(2, 160)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  taxRegistrationNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  paymentTermDays?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class SupplierQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    required: false,
    description: 'Only suppliers we owe money to',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  withBalance?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

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

export class RecordSupplierPaymentDto {
  @ApiProperty({ example: 500000, description: 'Minor units' })
  @IsInt()
  @IsPositive()
  amount: number;

  @ApiProperty({ required: false, example: 'Bank transfer 99213' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class PurchaseOrderLineDto {
  @ApiProperty({ description: 'Product id' })
  @IsMongoId()
  product: string;

  @ApiProperty({ example: 120 })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({
    required: false,
    example: 15000,
    description:
      'Agreed cost per unit, minor units. Defaults to the last price paid.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  unitCost?: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ description: 'Supplier id' })
  @IsMongoId()
  supplier: string;

  @ApiProperty({
    required: false,
    description: 'Defaults to the main location',
  })
  @IsOptional()
  @IsMongoId()
  location?: string;

  @ApiProperty({ type: [PurchaseOrderLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lines: PurchaseOrderLineDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expectedAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class PurchaseOrderQueryDto {
  @ApiProperty({ required: false, enum: PURCHASE_ORDER_STATUS })
  @IsOptional()
  @IsEnum(PURCHASE_ORDER_STATUS)
  status?: PURCHASE_ORDER_STATUS;
}

export class GoodsReceiptLineDto {
  @ApiProperty({ description: 'Product id' })
  @IsMongoId()
  product: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({
    example: 15500,
    description:
      'What this delivery actually charged. This is the cost that enters the weighted average, not the ordered price.',
  })
  @IsInt()
  @Min(0)
  unitCost: number;

  @ApiProperty({ required: false, example: 'B-2026-04' })
  @IsOptional()
  @IsString()
  batchNo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expiry?: string;
}

export class CreateGoodsReceiptDto {
  @ApiProperty({
    required: false,
    description: 'Omit when goods arrive without a formal order behind them.',
  })
  @IsOptional()
  @IsMongoId()
  purchaseOrder?: string;

  @ApiProperty({
    required: false,
    description: 'Required if no purchase order',
  })
  @IsOptional()
  @IsMongoId()
  supplier?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  location?: string;

  @ApiProperty({ type: [GoodsReceiptLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptLineDto)
  lines: GoodsReceiptLineDto[];

  @ApiProperty({ required: false, example: 0, description: 'Minor units' })
  @IsOptional()
  @IsInt()
  @Min(0)
  taxTotal?: number;

  @ApiProperty({ required: false, example: 'SD-88213' })
  @IsOptional()
  @IsString()
  supplierInvoiceNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  supplierInvoiceDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class SupplierLedgerQueryDto {
  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
