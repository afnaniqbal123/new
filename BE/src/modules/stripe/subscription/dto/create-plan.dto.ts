import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { PlanIntervalEnum } from '../enums/plan-interval.enum';
import {
  DEFAULT_PLAN_CURRENCY,
  MINIMUM_PLAN_AMOUNT,
} from '../constants/subscription-plan.constant';

export class CreatePlanDto {
  @ApiProperty({
    description: 'Display name of the plan, unique across the catalogue',
    example: 'Pro',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description:
      "Recurring charge in the currency's smallest unit — 2900 is $29.00, not $2900",
    example: 2900,
    minimum: MINIMUM_PLAN_AMOUNT,
  })
  @IsInt()
  @Min(MINIMUM_PLAN_AMOUNT)
  amount: number;

  @ApiProperty({
    description: 'How often the subscriber is charged',
    enum: PlanIntervalEnum,
    example: PlanIntervalEnum.MONTH,
  })
  @IsEnum(PlanIntervalEnum)
  interval: PlanIntervalEnum;

  @ApiProperty({
    description: 'Shown to subscribers on the plan and on the Stripe product',
    example: 'For growing teams.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @ApiProperty({
    description: 'Three-letter ISO currency code',
    example: DEFAULT_PLAN_CURRENCY,
    default: DEFAULT_PLAN_CURRENCY,
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiProperty({
    description: 'Selling points listed against the plan',
    example: ['Unlimited projects', 'Priority support'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];
}
