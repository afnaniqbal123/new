import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class AskClerkDto {
  @ApiProperty({ example: 'How much money do people owe me?' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 500)
  question: string;
}

export class ParseMessageDto {
  @ApiProperty({ example: 'Need 20 boxes of A4 paper and 10 blue pens' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 2000)
  message: string;

  @ApiProperty({ required: false, example: 'Ahmed Raza' })
  @IsOptional()
  @IsString()
  customerName?: string;
}

export class AskAssistantDto {
  @ApiProperty({ example: 'How does the WhatsApp ordering work?' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 300)
  question: string;
}
