import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { CUSTOMER_LEDGER_TYPE } from 'src/modules/customer/constants/customer.constant';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Ahmed Raza' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 160)
  name: string;

  @ApiProperty({ required: false, example: 'Raza General Store' })
  @IsOptional()
  @IsString()
  @Length(2, 160)
  businessName?: string;

  @ApiProperty({ required: false, example: '+92 300 1234567' })
  @IsOptional()
  @IsString()
  @Length(5, 32)
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false, example: 'Karachi' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({
    required: false,
    example: '1234567-8',
    description:
      'Presence makes the buyer tax-registered, which suppresses further tax in PK.',
  })
  @IsOptional()
  @IsString()
  taxRegistrationNumber?: string;

  @ApiProperty({
    required: false,
    example: 5000000,
    description: 'Credit limit in minor units. 0 means cash-only.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  creditLimit?: number;

  @ApiProperty({ required: false, example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  paymentTermDays?: number;

  @ApiProperty({ required: false, example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateCustomerDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(2, 160)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(2, 160)
  businessName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(5, 32)
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
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  taxRegistrationNumber?: string;

  @ApiProperty({ required: false, description: 'Minor units' })
  @IsOptional()
  @IsInt()
  @Min(0)
  creditLimit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  paymentTermDays?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CustomerQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, description: 'Only customers who owe money' })
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

/**
 * A manual movement on a customer's balance.
 *
 * Deliberately restricted to the reasons a human legitimately records by
 * hand: an opening balance, a correction, or a write-off. Sales, payments and
 * returns arrive through their own documents and are never entered here —
 * that is what keeps the ledger reconcilable against the sales it came from.
 */
export class CreateCustomerLedgerEntryDto {
  @ApiProperty({
    enum: [
      CUSTOMER_LEDGER_TYPE.OPENING,
      CUSTOMER_LEDGER_TYPE.ADJUSTMENT,
      CUSTOMER_LEDGER_TYPE.WRITE_OFF,
    ],
    example: CUSTOMER_LEDGER_TYPE.OPENING,
  })
  @IsEnum(CUSTOMER_LEDGER_TYPE)
  type: CUSTOMER_LEDGER_TYPE;

  @ApiProperty({
    example: 250000,
    description: 'Signed, minor units. Positive increases what is owed.',
  })
  @IsInt()
  amount: number;

  @ApiProperty({ required: false, example: 'Opening balance carried over' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CustomerLedgerQueryDto {
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
