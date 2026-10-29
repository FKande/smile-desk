import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { CLOCK, type Clock, systemClock } from '../common/clock.js';
import { DB, type Db, openDatabase } from './database.js';
import { isSeeded, seed, topUp } from './seed.js';

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
        // Every boot: roll the demo calendar forward and add any new demo patients.
        // Insert-only by stable id, so real conversations and bookings are never touched.
        const added = topUp(db, clock.now());
        logger.log(
          `Demo data top-up: +${added.patients} patients, +${added.slots} slots ` +
            `(+${added.bookings} filler bookings), +${added.pastVisits} past visits`,
        );
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
