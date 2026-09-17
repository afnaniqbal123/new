import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty } from 'class-validator';

export class SetDefaultCardDto {
  @ApiProperty({
    description: 'Internal card ID to set as default',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  cardId: number;
}
