import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService
  extends Redis
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisService.name);

  constructor(configService: ConfigService) {
    const host = configService.getOrThrow<string>('REDIS_HOST');
    const port = configService.getOrThrow<number>('REDIS_PORT');

    super({
      host,
      port,
      lazyConnect: true,
    });
  }

  async onModuleInit() {
    await this.connect();

    const response = await this.ping();

    this.logger.log(`Redis connected: ${response}`);
  }

  async onModuleDestroy() {
    await this.quit();

    this.logger.log('Redis disconnected');
  }
}
