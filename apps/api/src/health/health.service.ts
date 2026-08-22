import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '@app/database';
import { RedisService } from '@app/redis';

@Injectable()
export class HealthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  async check() {
    const [databaseResult, redisResult] = await Promise.allSettled([
      this.database.$queryRaw`SELECT 1`,
      this.redis.ping(),
    ]);

    const services = {
      database: databaseResult.status === 'fulfilled' ? 'up' : 'down',

      redis: redisResult.status === 'fulfilled' ? 'up' : 'down',
    };

    if (services.database === 'down' || services.redis === 'down') {
      throw new ServiceUnavailableException({
        status: 'error',
        services,
      });
    }

    return {
      status: 'ok',
      services,
    };
  }
}
