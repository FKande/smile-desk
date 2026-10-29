import { Module } from '@nestjs/common';
import { PatientsModule } from '../patients/patients.module.js';
import { SchedulingService } from './scheduling.service.js';

@Module({
  imports: [PatientsModule],
  providers: [SchedulingService],
  exports: [SchedulingService],
})
export class SchedulingModule {}
