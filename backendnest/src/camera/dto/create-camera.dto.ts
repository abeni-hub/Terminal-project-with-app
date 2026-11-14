import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';
import { CameraType, CameraSourceType, CameraStatus } from '@prisma/client';

export class CreateCameraDto {
  @ApiProperty({ example: 'Main Entrance Camera' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'CAM-ENT-01' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'terminal-uuid-here' })
  @IsString()
  @IsNotEmpty()
  terminalId: string;

  @ApiProperty({ example: 'Gate A Entry' })
  @IsString()
  @IsNotEmpty()
  gateName: string;

  @ApiProperty({ enum: CameraType, example: 'ENTRY' })
  @IsEnum(CameraType)
  cameraType: CameraType;

  @ApiProperty({ enum: CameraSourceType, example: 'RTSP' })
  @IsEnum(CameraSourceType)
  sourceType: CameraSourceType;

  @ApiProperty({ example: 'rtsp://admin:pass@192.168.1.100:554/stream1' })
  @IsString()
  @IsNotEmpty()
  sourceAddress: string;

  @ApiPropertyOptional({ enum: CameraStatus, example: 'ACTIVE' })
  @IsEnum(CameraStatus)
  @IsOptional()
  status?: CameraStatus;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  recognitionEnabled?: boolean;
}

export class UpdateCameraDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  terminalId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  gateName?: string;

  @ApiPropertyOptional({ enum: CameraType })
  @IsEnum(CameraType)
  @IsOptional()
  cameraType?: CameraType;

  @ApiPropertyOptional({ enum: CameraSourceType })
  @IsEnum(CameraSourceType)
  @IsOptional()
  sourceType?: CameraSourceType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sourceAddress?: string;

  @ApiPropertyOptional({ enum: CameraStatus })
  @IsEnum(CameraStatus)
  @IsOptional()
  status?: CameraStatus;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  recognitionEnabled?: boolean;
}

export class CameraHeartbeatDto {
  @ApiProperty({ enum: CameraStatus, example: 'ACTIVE' })
  @IsEnum(CameraStatus)
  status: CameraStatus;

  @ApiPropertyOptional({ example: 'Camera operating normally at 25 FPS' })
  @IsString()
  @IsOptional()
  details?: string;
}
