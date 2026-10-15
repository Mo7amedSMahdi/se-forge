import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './data-source.js';
import { ProblemFilter, validationPipe } from './problems.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: dataSourceOptions }),
    UsersModule,
  ],
  providers: [
    { provide: APP_PIPE, useValue: validationPipe },
    { provide: APP_FILTER, useClass: ProblemFilter },
  ],
})
export class AppModule {}
