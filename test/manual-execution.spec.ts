import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';

import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { DatabaseService } from '@app/database';

import { AppModule } from '../apps/api/src/app.module';

jest.setTimeout(30_000);

describe('Manual workflow execution', () => {
  let app: INestApplication | undefined;
  let database: DatabaseService;
  let jwtService: JwtService;

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
    jwtService = app.get(JwtService);
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

  it('should queue an active workflow execution', async () => {
    // Arrange

    const user = await database.user.create({
      data: {
        email: `e2e-${randomUUID()}@relayflow.test`,
        passwordHash: 'not-used-in-this-test',
      },
    });

    userId = user.id;

    const accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    const workflow = await database.workflow.create({
      data: {
        userId: user.id,
        name: 'E2E Manual Workflow',
        status: 'ACTIVE',
        version: 1,

        definition: {
          trigger: {
            type: 'MANUAL',
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

    // Act

    await request(httpServer)
      .post(`/workflows/${workflow.id}/run`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        input: {
          message: 'hello relayflow',
        },
      })
      .expect(202);

    // Assert

    const execution = await database.execution.findFirst({
      where: {
        workflowId: workflow.id,
        userId: user.id,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    expect(execution).not.toBeNull();

    expect(execution?.workflowId).toBe(workflow.id);

    expect(execution?.userId).toBe(user.id);

    expect(execution?.workflowVersion).toBe(1);

    expect(execution?.triggerType).toBe('MANUAL');

    expect(execution?.status).toBe('QUEUED');

    expect(execution?.triggerPayload).toEqual({
      message: 'hello relayflow',
    });
  });
});
