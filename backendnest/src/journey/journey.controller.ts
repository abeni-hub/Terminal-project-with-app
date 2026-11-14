import { Controller, Get, Param, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JourneyService } from './journey.service';
import { JourneyState } from '@prisma/client';

@ApiTags('Journey')
@Controller('v1/journey')
export class JourneyController {
  constructor(private readonly journeyService: JourneyService) {}

  @Get('vehicles/:id')
  @ApiOperation({ summary: 'Get vehicle journey state' })
  async getVehicleJourneyState(@Param('id') id: string) {
    return this.journeyService.getVehicleJourneyState(id);
  }

  @Patch('vehicles/:id/state')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update vehicle journey state' })
  async updateJourneyState(@Param('id') id: string, @Body('state') state: JourneyState) {
    return this.journeyService.updateJourneyState(id, state);
  }
}
