import { IsNotEmpty, IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TerminalStatus } from '@prisma/client';

export class CreateTerminalDto {
  @ApiProperty({ example: 'Megenagna Terminal' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'TRM-MGN' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'Megenagna, Addis Ababa' })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty({ example: 9.0084 })
  @IsNumber()
  @IsNotEmpty()
  latitude!: number;

  @ApiProperty({ example: 38.7575 })
  @IsNumber()
  @IsNotEmpty()
  longitude!: number;

  @ApiProperty({ example: 80 })
  @IsNumber()
  @IsNotEmpty()
  capacity!: number;

  @ApiProperty({ example: 'OPERATIONAL', enum: TerminalStatus })
  @IsEnum(TerminalStatus)
  @IsOptional()
  status?: TerminalStatus = TerminalStatus.OPERATIONAL;
}

export class UpdateTerminalDto {
  @ApiProperty({ example: 'Megenagna Terminal' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'TRM-MGN' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ example: 'Megenagna, Addis Ababa' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: 9.0084 })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiProperty({ example: 38.7575 })
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiProperty({ example: 80 })
  @IsNumber()
  @IsOptional()
  capacity?: number;

  @ApiProperty({ example: 'OPERATIONAL', enum: TerminalStatus })
  @IsEnum(TerminalStatus)
  @IsOptional()
  status?: TerminalStatus;
}
