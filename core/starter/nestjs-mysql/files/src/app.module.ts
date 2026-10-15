import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './data-source.js';
import { HealthController } from './health.controller.js';
import { ProblemFilter, validationPipe } from './problems.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: dataSourceOptions }),
    // Feature modules go here, one per feature folder (skill stack-nestjs).
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useValue: validationPipe },
    { provide: APP_FILTER, useClass: ProblemFilter },
  ],
})
export class AppModule {}
