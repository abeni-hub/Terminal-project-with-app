import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RbacModule } from './rbac/rbac.module';
import { UsersModule } from './users/users.module';
import { TerminalsModule } from './terminals/terminals.module';
import { RoutesModule } from './routes/routes.module';
import { VehicleGroupsModule } from './vehicle-groups/vehicle-groups.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { FeesModule } from './fees/fees.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { QueueModule } from './queue/queue.module';
import { ViolationsModule } from './violations/violations.module';
import { OverridesModule } from './overrides/overrides.module';
import { AuditModule } from './audit/audit.module';
import { DevicesModule } from './devices/devices.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EventsModule } from './events/events.module';
import { CameraModule } from './camera/camera.module';
import { RecognitionModule } from './recognition/recognition.module';
import { JourneyModule } from './journey/journey.module';
import { CameraHealthModule } from './camera-health/camera-health.module';
import { VehicleAccountsModule } from './vehicle-accounts/vehicle-accounts.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EventsModule,
    AuthModule,
    RbacModule,
    UsersModule,
    TerminalsModule,
    RoutesModule,
    VehicleGroupsModule,
    VehiclesModule,
    FeesModule,
    AssignmentsModule,
    QueueModule,
    ViolationsModule,
    OverridesModule,
    AuditModule,
    DevicesModule,
    DashboardModule,
    CameraModule,
    RecognitionModule,
    JourneyModule,
    CameraHealthModule,
    VehicleAccountsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}

