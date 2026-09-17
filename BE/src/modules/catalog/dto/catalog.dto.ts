import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import {
  PRODUCT_STATUS,
  TAX_TREATMENT,
} from 'src/modules/catalog/constants/catalog.constant';

/**
 * Money arrives as an integer in minor units, never as a decimal.
 *
 * Deliberate, and worth the small friction at the client: a JSON number has
 * already been through a double by the time it reaches a DTO, so accepting
 * `199.99` would reintroduce exactly the imprecision CONTEXT.md D4 removes.
 * The frontend multiplies once, at the input field, where the user's typed
 * string is still intact.
 */
export class CreateProductDto {
  @ApiProperty({ example: 'Coca-Cola 1.5L' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  name: string;

  @ApiProperty({ example: 'COKE-1500' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  sku: string;

  @ApiProperty({ required: false, example: '5449000000996' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  barcode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, description: 'Category id' })
  @IsOptional()
  @IsMongoId()
  category?: string;

  @ApiProperty({ required: false, example: 'pcs' })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  unit?: string;

  @ApiProperty({
    required: false,
    example: 24,
    description: 'Base units per pack',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  packSize?: number;

  @ApiProperty({ example: 19999, description: 'Selling price in minor units' })
  @IsInt()
  @Min(0)
  sellingPrice: number;

  @ApiProperty({ required: false, example: 15000, description: 'Minor units' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minimumPrice?: number;

  @ApiProperty({ required: false, enum: TAX_TREATMENT })
  @IsOptional()
  @IsEnum(TAX_TREATMENT)
  taxTreatment?: TAX_TREATMENT;

  @ApiProperty({
    required: false,
    example: 18,
    description: 'Overrides the organization default. Omit to inherit it.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  taxRatePercent?: number;

  @ApiProperty({ required: false, example: 24 })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @ApiProperty({ required: false, example: 120 })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderQuantity?: number;

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  trackBatches?: boolean;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;

  @ApiProperty({ required: false, description: 'Supplier id' })
  @IsOptional()
  @IsMongoId()
  preferredSupplier?: string;
}

export class UpdateProductDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  sku?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  barcode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  unit?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  packSize?: number;

  @ApiProperty({ required: false, description: 'Minor units' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sellingPrice?: number;

  @ApiProperty({ required: false, description: 'Minor units' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minimumPrice?: number;

  @ApiProperty({ required: false, enum: TAX_TREATMENT })
  @IsOptional()
  @IsEnum(TAX_TREATMENT)
  taxTreatment?: TAX_TREATMENT;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  taxRatePercent?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderQuantity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  trackBatches?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;

  @ApiProperty({ required: false, enum: PRODUCT_STATUS })
  @IsOptional()
  @IsEnum(PRODUCT_STATUS)
  status?: PRODUCT_STATUS;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  preferredSupplier?: string;
}

export class ProductQueryDto {
  @ApiProperty({ required: false, example: 'coke' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, description: 'Category id' })
  @IsOptional()
  @IsMongoId()
  category?: string;

  @ApiProperty({ required: false, enum: PRODUCT_STATUS })
  @IsOptional()
  @IsEnum(PRODUCT_STATUS)
  status?: PRODUCT_STATUS;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  // A query string carries "true", not true. Transformed here rather than in
  // the service so the service only ever sees a real boolean.
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  lowStock?: boolean;

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

export class CreateCategoryDto {
  @ApiProperty({ example: 'Beverages' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 80)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, example: '#2563eb' })
  @IsOptional()
  @IsString()
  @Length(4, 9)
  color?: string;
}

export class UpdateCategoryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(4, 9)
  color?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
