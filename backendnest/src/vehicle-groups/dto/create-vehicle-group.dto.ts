import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVehicleGroupDto {
  @ApiProperty({ example: 'Group A' })
  @IsString() @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Northern district fleet' })
  @IsString() @IsOptional()
  description?: string;
}

export class UpdateVehicleGroupDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() description?: string;
}
