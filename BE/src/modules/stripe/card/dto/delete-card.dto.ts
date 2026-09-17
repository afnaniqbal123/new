import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty } from 'class-validator';

export class DeleteCardDto {
  @ApiProperty({
    description: 'Internal card ID to delete',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  cardId: number;
}
