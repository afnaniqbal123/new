import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class CancelSubscriptionDto {
  @ApiProperty({
    description:
      'Whether to cancel at period end (true) or immediately (false)',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean = true;
}
