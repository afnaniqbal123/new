import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateSubscriptionDto {
  @ApiProperty({
    description: 'New Stripe Price ID to upgrade or downgrade to',
    example: 'price_1234567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  newPriceId: string;
}
