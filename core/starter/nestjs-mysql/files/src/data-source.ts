import { DataSource, DataSourceOptions } from 'typeorm';

/**
 * Migrations, oldest first (skill db-migration): import each class here and add it to the list. The app,
 * the TypeORM CLI and the tests all read this one list.
 */
export const migrations: DataSourceOptions['migrations'] = [];

/** Entities, one per table (skill stack-nestjs). */
export const entities: DataSourceOptions['entities'] = [];

/** One connection definition for the app and the TypeORM CLI. DATABASE_URL: mysql://user:password@host:3306/db */
export const dataSourceOptions = (): DataSourceOptions => ({
  type: 'mysql',
  url: process.env.DATABASE_URL,
  timezone: 'Z',
  entities,
  migrations,
  synchronize: false,
});

export default new DataSource(dataSourceOptions());
