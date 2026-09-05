import { NestFactory } from '@nestjs/core';

import { Logger } from 'nestjs-pino';

import { WorkerModule } from './worker.module';

export async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  app.enableShutdownHooks();
  app.useLogger(app.get(Logger));
}
