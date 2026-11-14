import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(EventsGateway.name);

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized for ALPR & Queue updates');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitRecognitionCaptured(data: any) {
    this.server.emit('recognition:captured', data);
  }

  emitQueueUpdated(data: any) {
    this.server.emit('queue:updated', data);
  }

  emitUnknownVehicleAlert(data: any) {
    this.server.emit('alert:unknown_vehicle', data);
  }

  emitCameraStatusChanged(data: any) {
    this.server.emit('camera:status_changed', data);
  }

  emitJourneyStateChanged(data: any) {
    this.server.emit('journey:state_changed', data);
  }

  emitAccountUpdated(data: any) {
    this.server.emit('account:updated', data);
  }

  emitCardUpdated(data: any) {
    this.server.emit('card:updated', data);
  }

  emitViolationCreated(data: any) {
    this.server.emit('violation:created', data);
  }
}
