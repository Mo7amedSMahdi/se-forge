import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { DbModule } from './db.module.js';
import { HealthController } from './health.controller.js';
import { ProblemFilter, validationPipe } from './problems.js';

@Module({
  imports: [
    DbModule,
    // Feature modules go here, one per feature folder (skills stack-nestjs, db-mongodb).
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useValue: validationPipe },
    { provide: APP_FILTER, useClass: ProblemFilter },
  ],
})
export class AppModule {}
