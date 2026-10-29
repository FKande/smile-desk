import { NestFactory } from '@nestjs/core';
import { existsSync } from 'node:fs';
import { AppModule } from './app.module.js';

// Load .env from the repo root (npm workspaces run us from apps/api), then a local one.
for (const file of ['../../.env', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
