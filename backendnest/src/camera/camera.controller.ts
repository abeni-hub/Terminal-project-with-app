import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CameraService } from './camera.service';
import { CreateCameraDto, UpdateCameraDto, CameraHeartbeatDto } from './dto/create-camera.dto';
import { QueryParamsDto } from '../common/dto/query-params.dto';

@ApiTags('Cameras')
@Controller('v1/cameras')
export class CameraController {
  constructor(private readonly cameraService: CameraService) {}

  @Get()
  @ApiOperation({ summary: 'List camera devices' })
  async list(
    @Query() query: QueryParamsDto,
    @Query('terminalId') terminalId?: string,
    @Query('status') status?: string,
    @Query('cameraType') cameraType?: string,
  ) {
    return this.cameraService.list({ ...query, terminalId, status, cameraType });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get camera details by ID' })
  async findOne(@Param('id') id: string) {
    return this.cameraService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a new camera device' })
  async create(@Body() dto: CreateCameraDto) {
    return this.cameraService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a camera device' })
  async update(@Param('id') id: string, @Body() dto: UpdateCameraDto) {
    return this.cameraService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a camera device' })
  async delete(@Param('id') id: string) {
    return this.cameraService.delete(id);
  }

  @Patch(':id/toggle-recognition')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable or disable ALPR recognition for camera' })
  async toggleRecognition(@Param('id') id: string, @Body('enabled') enabled: boolean) {
    return this.cameraService.toggleRecognition(id, enabled);
  }

  @Post(':id/test')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test connection to camera device' })
  async testConnection(@Param('id') id: string) {
    return this.cameraService.testConnection(id);
  }

  @Post(':id/heartbeat')
  @ApiOperation({ summary: 'Receive camera heartbeat ping' })
  async heartbeat(@Param('id') id: string, @Body() dto: CameraHeartbeatDto) {
    return this.cameraService.processHeartbeat(id, dto);
  }
}
