import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class VerifySessionDto {
  @ApiProperty({
    description: 'Stripe Checkout Session ID',
    example: 'cs_test_a1234567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}
