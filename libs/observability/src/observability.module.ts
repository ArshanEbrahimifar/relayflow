import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LoggerModule } from 'nestjs-pino';

import { AppConfigModule } from '@app/config';

import { getTraceLogContext } from './trace-log-context';
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],

      inject: [ConfigService],

      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.getOrThrow<string>('NODE_ENV');

        const isProduction = nodeEnv === 'production';

        return {
          pinoHttp: {
            mixin() {
              return getTraceLogContext();
            },
            transport: isProduction
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    translateTime: 'SYS:standard',
                  },
                },
          },
        };
      },
    }),
  ],

  exports: [LoggerModule],
})
export class ObservabilityModule {}
