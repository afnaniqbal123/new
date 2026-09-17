import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class UserEmailDto {
  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  readonly email: string;
}

/**
 * Note the absence of `email`. The account being reset is read from the
 * consumed token's record; accepting it here as well would reintroduce a
 * second, caller-controlled source for the identity the token already names.
 */
export class VerifyResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;
}
