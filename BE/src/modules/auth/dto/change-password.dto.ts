import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password of the user',
    example: 'currentPassword123',
  })
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @ApiProperty({
    description: 'New password for the user',
    example: 'newPassword123',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}
