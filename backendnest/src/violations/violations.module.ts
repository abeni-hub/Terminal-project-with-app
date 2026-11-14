import { Module } from '@nestjs/common';
import { ViolationsService } from './violations.service';
import { ViolationsController } from './violations.controller';

@Module({ providers: [ViolationsService], controllers: [ViolationsController], exports: [ViolationsService] })
export class ViolationsModule {}
