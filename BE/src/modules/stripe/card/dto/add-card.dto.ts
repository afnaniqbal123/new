import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class AddCardDto {
  @ApiProperty({
    description:
      'Stripe payment method ID created on the frontend using Stripe Elements',
    example: 'pm_1234567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  paymentMethodId: string;
}
