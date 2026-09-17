import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AppleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
