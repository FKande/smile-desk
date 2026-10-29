import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { CLOCK, type Clock, systemClock } from '../common/clock.js';
import { DB, type Db, openDatabase } from './database.js';
import { isSeeded, seed } from './seed.js';

@Global()
@Module({
  providers: [
    { provide: CLOCK, useValue: systemClock },
    {
      provide: DB,
      inject: [CLOCK],
      useFactory: (clock: Clock): Db => {
        const logger = new Logger('Database');
        const path = process.env.DB_PATH ?? 'data/smile-desk.db';
        const db = openDatabase(path);
        if (!isSeeded(db)) {
          seed(db, clock.now());
          logger.log(`Seeded demo practice data into ${path}`);
        }
        return db;
      },
    },
  ],
  exports: [DB, CLOCK],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DB) private readonly db: Db) {}

  onApplicationShutdown(): void {
    this.db.close();
  }
}
