import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'abebe@aato.gov.et', description: 'The email of the user' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'password123', description: 'The password of the user' })
  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}
