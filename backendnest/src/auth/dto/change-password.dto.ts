import { IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'password123', description: 'The old password' })
  @IsNotEmpty()
  oldPassword!: string;

  @ApiProperty({ example: 'newPassword123', description: 'The new password' })
  @IsNotEmpty()
  @MinLength(6)
  newPassword!: string;
}
