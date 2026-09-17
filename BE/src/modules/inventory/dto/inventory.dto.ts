import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { STOCK_REASON } from 'src/modules/inventory/constants/inventory.constant';

export class StockAdjustmentLineDto {
  @ApiProperty({ description: 'Product id' })
  @IsMongoId()
  product: string;

  /**
   * Signed. Positive adds stock, negative removes it.
   *
   * `IsNumber` rather than `IsInt`: goods genuinely sold by weight (2.5 kg of
   * rice) move in fractions, and forcing integers here would make the system
   * unusable for half of a distributor's catalogue.
   */
  @ApiProperty({ example: -3, description: 'Signed quantity' })
  @IsNumber()
  quantity: number;

  @ApiProperty({ required: false, example: 12000, description: 'Minor units' })
  @IsOptional()
  @IsInt()
  @Min(0)
  unitCost?: number;

  @ApiProperty({ required: false, example: 'B-2024-11' })
  @IsOptional()
  @IsString()
  batchNo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expiry?: string;
}

export class CreateStockAdjustmentDto {
  @ApiProperty({
    required: false,
    description: 'Defaults to the main location',
  })
  @IsOptional()
  @IsMongoId()
  location?: string;

  @ApiProperty({
    enum: STOCK_REASON,
    example: STOCK_REASON.ADJUSTMENT,
    description: 'ADJUSTMENT, OPENING or WRITE_OFF',
  })
  @IsEnum(STOCK_REASON)
  reason: STOCK_REASON;

  @ApiProperty({ type: [StockAdjustmentLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockAdjustmentLineDto)
  lines: StockAdjustmentLineDto[];

  @ApiProperty({ required: false, example: 'Monthly count, aisle 3' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class StockLedgerQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  product?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  location?: string;

  @ApiProperty({ required: false, enum: STOCK_REASON })
  @IsOptional()
  @IsEnum(STOCK_REASON)
  reason?: STOCK_REASON;

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

  @ApiProperty({ required: false, example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class TransferLineDto {
  @ApiProperty({ description: 'Product id' })
  @IsMongoId()
  product: string;

  @ApiProperty({ example: 24 })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  batchNo?: string;
}

export class CreateStockTransferDto {
  @ApiProperty({ description: 'Source location id' })
  @IsMongoId()
  fromLocation: string;

  @ApiProperty({ description: 'Destination location id' })
  @IsMongoId()
  toLocation: string;

  @ApiProperty({ type: [TransferLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransferLineDto)
  lines: TransferLineDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class ReceiveTransferLineDto {
  @ApiProperty({ description: 'Product id' })
  @IsMongoId()
  product: string;

  @ApiProperty({ example: 24, description: 'Quantity that actually arrived' })
  @IsNumber()
  @Min(0)
  receivedQuantity: number;
}

export class ReceiveStockTransferDto {
  @ApiProperty({ type: [ReceiveTransferLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveTransferLineDto)
  lines: ReceiveTransferLineDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class ExpiringBatchesQueryDto {
  @ApiProperty({ required: false, example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  withinDays?: number;
}

export class StockByLocationQueryDto {
  @ApiProperty({ description: 'Product id' })
  @IsMongoId()
  @IsNotEmpty()
  product: string;
}
