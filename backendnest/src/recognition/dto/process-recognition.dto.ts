import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { CameraType } from '@prisma/client';

export class ProcessRecognitionDto {
  @ApiProperty({ example: 'CAM-ENT-01' })
  @IsString()
  @IsNotEmpty()
  cameraId: string;

  @ApiProperty({ example: 'terminal-uuid-here' })
  @IsString()
  @IsNotEmpty()
  terminalId: string;

  @ApiProperty({ enum: CameraType, example: 'ENTRY' })
  @IsEnum(CameraType)
  cameraType: CameraType;

  @ApiProperty({ example: 'AA12345' })
  @IsString()
  @IsNotEmpty()
  plateNumber: string;

  @ApiPropertyOptional({ example: 'AA-12345' })
  @IsString()
  @IsOptional()
  rawPlateNumber?: string;

  @ApiProperty({ example: 0.98 })
  @IsNumber()
  confidence: number;

  @ApiPropertyOptional({ example: '2026-08-06T08:30:15Z' })
  @IsString()
  @IsOptional()
  capturedAt?: string;

  @ApiPropertyOptional({ example: '/uploads/plates/20260806_083015_AA12345.jpg' })
  @IsString()
  @IsOptional()
  imagePath?: string;

  @ApiPropertyOptional({ example: 'QR_CAMERA' })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional({ example: 'PASS-SUB-101' })
  @IsString()
  @IsOptional()
  passId?: string;

  @ApiPropertyOptional({ example: 'SUBSCRIBER' })
  @IsString()
  @IsOptional()
  passType?: string;

  @ApiPropertyOptional({ example: 'MATCHED' })
  @IsString()
  @IsOptional()
  matchStatus?: string;
}

export class AssignUnknownPlateDto {
  @ApiProperty({ example: 'vehicle-uuid-here' })
  @IsString()
  @IsNotEmpty()
  vehicleId: string;

  @ApiPropertyOptional({ example: 'Assigned manually by dispatcher after ALPR recognition' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
