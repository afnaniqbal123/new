import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { BILLING_PLAN } from 'src/modules/organization/constants/organization.constant';

export class CreateCheckoutDto {
  @ApiProperty({ enum: BILLING_PLAN, example: BILLING_PLAN.BUSINESS })
  @IsEnum(BILLING_PLAN)
  plan: BILLING_PLAN;
}
