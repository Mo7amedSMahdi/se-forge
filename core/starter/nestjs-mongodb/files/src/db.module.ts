import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { Db, MongoClient } from 'mongodb';

export const MONGO_CLIENT = Symbol('MONGO_CLIENT');
/** Inject the database with @Inject(DB) (decision 38: MongoDB's official driver). */
export const DB = Symbol('DB');

/** One client for the app. MONGODB_URL: mongodb://host:27017; MONGODB_DB: the database's name. */
@Global()
@Module({
  providers: [
    {
      provide: MONGO_CLIENT,
      useFactory: () =>
        MongoClient.connect(
          process.env.MONGODB_URL ?? 'mongodb://localhost:27017',
        ),
    },
    {
      provide: DB,
      inject: [MONGO_CLIENT],
      useFactory: (client: MongoClient): Db =>
        client.db(process.env.MONGODB_DB ?? 'app'),
    },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(MONGO_CLIENT) private readonly client: MongoClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}
