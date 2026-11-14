import { Module } from '@nestjs/common';
import { OverridesService } from './overrides.service';
import { OverridesController } from './overrides.controller';

@Module({ providers: [OverridesService], controllers: [OverridesController], exports: [OverridesService] })
export class OverridesModule {}
