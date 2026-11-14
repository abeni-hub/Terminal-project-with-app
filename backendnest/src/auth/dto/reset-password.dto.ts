import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'token_here', description: 'Reset verification token' })
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'newPassword123', description: 'The new password' })
  @IsNotEmpty()
  @MinLength(6)
  newPassword!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'abebe@aato.gov.et', description: 'The email of the user' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
