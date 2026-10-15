import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from './users/user.entity.js';
import { CreateUsers1759795200000 } from './migrations/1759795200000-CreateUsers.js';

/** One connection definition for the app and the TypeORM CLI. DATABASE_URL: mysql://user:password@host:3306/db */
export const dataSourceOptions = (): DataSourceOptions => ({
  type: 'mysql',
  url: process.env.DATABASE_URL,
  timezone: 'Z',
  entities: [User],
  migrations: [CreateUsers1759795200000],
  synchronize: false,
});

export default new DataSource(dataSourceOptions());
