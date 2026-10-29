import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PatientsModule } from './patients/patients.module.js';
import { SchedulingModule } from './scheduling/scheduling.module.js';

@Module({
  imports: [DatabaseModule, PatientsModule, SchedulingModule, NotificationsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
