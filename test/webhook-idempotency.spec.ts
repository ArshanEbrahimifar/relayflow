import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import type { Server } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';

import request from 'supertest';

import { DatabaseService } from '@app/database';

import { AppModule } from '../apps/api/src/app.module';

jest.setTimeout(30_000);

describe('Webhook idempotency', () => {
  let app: INestApplication | undefined;
  let database: DatabaseService;

  let userId: string | undefined;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    database = app.get(DatabaseService);
  });

  afterAll(async () => {
    if (userId) {
      await database.user.delete({
        where: {
          id: userId,
        },
      });
    }

    if (app) {
      await app.close();
    }
  });

  it('should not create a duplicate execution for the same idempotency key', async () => {
    // Arrange

    const user = await database.user.create({
      data: {
        email: `e2e-${randomUUID()}@relayflow.test`,
        passwordHash: 'not-used-in-this-test',
      },
    });

    userId = user.id;

    const webhookToken = randomBytes(32).toString('hex');

    const workflow = await database.workflow.create({
      data: {
        userId: user.id,
        name: 'E2E Webhook Workflow',
        status: 'ACTIVE',
        version: 1,
        webhookToken,

        definition: {
          trigger: {
            type: 'WEBHOOK',
          },

          steps: [
            {
              id: 'transform-1',
              type: 'TRANSFORM',

              config: {
                template: {
                  message: '{{input.message}}',
                },
              },
            },
          ],
        },
      },
    });

    if (!app) {
      throw new Error('Test application was not initialized');
    }

    const httpServer = app.getHttpServer() as Server;

    const idempotencyKey = `e2e-${randomUUID()}`;

    const payload = {
      message: 'hello webhook',
    };

    // Act

    await request(httpServer)
      .post(`/webhooks/${webhookToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(202);

    await request(httpServer)
      .post(`/webhooks/${webhookToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(202);

    // Assert

    const executions = await database.execution.findMany({
      where: {
        workflowId: workflow.id,
        idempotencyKey,
      },
    });

    expect(executions).toHaveLength(1);

    expect(executions[0]?.triggerType).toBe('WEBHOOK');

    expect(executions[0]?.triggerPayload).toEqual(payload);

    expect(executions[0]?.idempotencyKey).toBe(idempotencyKey);
  });
});
