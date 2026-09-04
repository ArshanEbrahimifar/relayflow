import { Injectable } from '@nestjs/common';

import { RedisService } from '@app/redis';

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  async consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const script = `
      local current = redis.call('INCR', KEYS[1])

      if current == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end

      local ttl = redis.call('TTL', KEYS[1])

      return { current, ttl }
    `;

    const result = await this.redis.eval(script, 1, key, windowSeconds);

    if (!Array.isArray(result) || result.length !== 2) {
      throw new Error('Unexpected Redis rate limit response');
    }

    const count = Number(result[0]);
    const ttl = Number(result[1]);

    if (!Number.isFinite(count) || !Number.isFinite(ttl)) {
      throw new Error('Invalid Redis rate limit response');
    }

    return {
      allowed: count <= limit,

      remaining: Math.max(limit - count, 0),

      retryAfterSeconds: Math.max(ttl, 0),
    };
  }
}
