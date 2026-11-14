import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { RecognitionService } from './recognition.service';
import { ProcessRecognitionDto, AssignUnknownPlateDto } from './dto/process-recognition.dto';
import { QueryParamsDto } from '../common/dto/query-params.dto';

@ApiTags('Recognition')
@Controller('v1/recognition')
export class RecognitionController {
  constructor(private readonly recognitionService: RecognitionService) {}

  @Post('process')
  @Public()
  @ApiOperation({ summary: 'Receive and process ALPR recognition event from Recognition Service' })
  async processRecognition(@Body() dto: ProcessRecognitionDto) {
    return this.recognitionService.processRecognition(dto);
  }

  @Get('events')
  @ApiOperation({ summary: 'List ALPR recognition events with filtering' })
  async listEvents(
    @Query() query: QueryParamsDto,
    @Query('terminalId') terminalId?: string,
    @Query('cameraId') cameraId?: string,
    @Query('processingResult') processingResult?: string,
  ) {
    return this.recognitionService.listEvents({ ...query, terminalId, cameraId, processingResult });
  }

  @Get('unknown')
  @ApiOperation({ summary: 'List unknown vehicle recognition events requiring dispatcher review' })
  async getUnknownEvents(@Query() query: QueryParamsDto) {
    return this.recognitionService.getUnknownEvents(query);
  }

  @Post('unknown/:id/assign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign an unknown plate event to a vehicle in system' })
  async assignUnknownPlate(@Param('id') id: string, @Body() dto: AssignUnknownPlateDto) {
    return this.recognitionService.assignUnknownPlate(id, dto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get ALPR system accuracy and recognition metrics' })
  async getStats(@Query('terminalId') terminalId?: string) {
    return this.recognitionService.getStats(terminalId);
  }
}
