import { IsNotEmpty, IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RouteStatus } from '@prisma/client';

export class CreateRouteDto {
  @ApiProperty({ example: 'Megenagna - Mercato Express' })
  @IsString() @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'RTE-001' })
  @IsString() @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 't1' })
  @IsString() @IsNotEmpty()
  originTerminalId!: string;

  @ApiProperty({ example: 't2' })
  @IsString() @IsNotEmpty()
  destinationTerminalId!: string;

  @ApiProperty({ example: 6.5 })
  @IsNumber() @IsNotEmpty()
  distanceKm!: number;

  @ApiProperty({ example: 25 })
  @IsNumber() @IsNotEmpty()
  estimatedMinutes!: number;

  @ApiProperty({ example: 'ACTIVE', enum: RouteStatus })
  @IsEnum(RouteStatus) @IsOptional()
  status?: RouteStatus = RouteStatus.ACTIVE;
}

export class UpdateRouteDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() originTerminalId?: string;
  @IsString() @IsOptional() destinationTerminalId?: string;
  @IsNumber() @IsOptional() distanceKm?: number;
  @IsNumber() @IsOptional() estimatedMinutes?: number;
  @IsEnum(RouteStatus) @IsOptional() status?: RouteStatus;
}
