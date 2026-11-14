import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JourneyState } from '@prisma/client';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class JourneyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async getVehicleJourneyState(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        queueEntries: { take: 5, orderBy: { checkedInAt: 'desc' } },
        recognitionEvents: { take: 5, orderBy: { capturedAt: 'desc' } },
      },
    });
    if (!vehicle) throw new HttpException('Vehicle not found.', HttpStatus.NOT_FOUND);

    return {
      vehicleId: vehicle.id,
      plateNumber: vehicle.plateNumber,
      journeyState: vehicle.journeyState,
      status: vehicle.status,
      lastQueueEntry: vehicle.queueEntries[0] || null,
      lastRecognitionEvent: vehicle.recognitionEvents[0] || null,
    };
  }

  async updateJourneyState(vehicleId: string, state: JourneyState) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new HttpException('Vehicle not found.', HttpStatus.NOT_FOUND);

    const updated = await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { journeyState: state },
    });

    const payload = { vehicleId: vehicle.id, plateNumber: vehicle.plateNumber, journeyState: state };
    this.eventsGateway.emitJourneyStateChanged(payload);
    return payload;
  }
}
