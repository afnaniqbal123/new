import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { USER_ROLES } from 'src/modules/user/constants/user.constant';
import { LOCATION_TYPE } from 'src/modules/organization/constants/organization.constant';

export class TaxSettingsDto {
  @ApiProperty({ required: false, example: '1234567-8' })
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiProperty({ required: false, example: '9876543-2' })
  @IsOptional()
  @IsString()
  nationalTaxNumber?: string;

  @ApiProperty({ required: false, example: 18, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  defaultRatePercent?: number;

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  pricesIncludeTax?: boolean;

  @ApiProperty({ required: false, example: 3, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  furtherTaxPercent?: number;

  @ApiProperty({ required: false, example: 0, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  withholdingPercent?: number;
}

export class InvoiceSettingsDto {
  @ApiProperty({ required: false, example: 'INV' })
  @IsOptional()
  @IsString()
  @Length(1, 10)
  prefix?: string;

  @ApiProperty({ required: false, example: 6, minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  padding?: number;

  @ApiProperty({ required: false, example: 'Thank you for your business.' })
  @IsOptional()
  @IsString()
  footerNote?: string;
}

export class OperationalSettingsDto {
  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  automationsEnabled?: boolean;

  @ApiProperty({ required: false, example: 9, minimum: 0, maximum: 23 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  morningDigestHour?: number;

  @ApiProperty({ required: false, example: 20, minimum: 0, maximum: 23 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  eveningDigestHour?: number;
}

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Kolachi Traders' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  name: string;

  @ApiProperty({ required: false, example: 'Kolachi Traders (Pvt) Ltd' })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiProperty({ example: 'PK', description: 'ISO 3166-1 alpha-2' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @ApiProperty({ example: 'PKR', description: 'ISO 4217' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiProperty({ required: false, example: 'Asia/Karachi' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({ required: false, example: '+92 300 1234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, example: 'hello@kolachitraders.pk' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, example: 'Shop 4, Jodia Bazaar, Karachi' })
  @IsOptional()
  @IsString()
  address?: string;
}

export class UpdateOrganizationDto {
  @ApiProperty({ required: false, example: 'Kolachi Traders' })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiProperty({ required: false, example: 'Kolachi Traders (Pvt) Ltd' })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiProperty({ required: false, example: 'Asia/Karachi' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({ required: false, example: '+92 300 1234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, example: 'hello@kolachitraders.pk' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, example: 'Shop 4, Jodia Bazaar, Karachi' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false, type: TaxSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TaxSettingsDto)
  tax?: TaxSettingsDto;

  @ApiProperty({ required: false, type: InvoiceSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InvoiceSettingsDto)
  invoice?: InvoiceSettingsDto;

  @ApiProperty({ required: false, type: OperationalSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperationalSettingsDto)
  settings?: OperationalSettingsDto;
}

export class CreateLocationDto {
  @ApiProperty({ example: 'Main Warehouse' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  name: string;

  @ApiProperty({ required: false, example: 'WH1' })
  @IsOptional()
  @IsString()
  @Length(1, 12)
  code?: string;

  @ApiProperty({ required: false, enum: LOCATION_TYPE })
  @IsOptional()
  @IsEnum(LOCATION_TYPE)
  type?: LOCATION_TYPE;

  @ApiProperty({ required: false, example: 'Plot 12, SITE Area, Karachi' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false, example: '+92 21 1234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateLocationDto {
  @ApiProperty({ required: false, example: 'Main Warehouse' })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiProperty({ required: false, example: 'WH1' })
  @IsOptional()
  @IsString()
  @Length(1, 12)
  code?: string;

  @ApiProperty({ required: false, enum: LOCATION_TYPE })
  @IsOptional()
  @IsEnum(LOCATION_TYPE)
  type?: LOCATION_TYPE;

  @ApiProperty({ required: false, example: 'Plot 12, SITE Area, Karachi' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false, example: '+92 21 1234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class InviteMemberDto {
  @ApiProperty({ example: 'accountant@kolachitraders.pk' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Bilal Ahmed' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  name: string;

  @ApiProperty({ example: '+92 300 1234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ enum: USER_ROLES, example: USER_ROLES.CASHIER })
  @IsEnum(USER_ROLES)
  role: USER_ROLES;
}

export class UpdateMemberDto {
  @ApiProperty({ required: false, enum: USER_ROLES })
  @IsOptional()
  @IsEnum(USER_ROLES)
  role?: USER_ROLES;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class OrganizationSlugQueryDto {
  @ApiProperty({ example: 'kolachi-traders' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'A workspace address may contain only lowercase letters, digits and hyphens',
  })
  slug: string;
}
