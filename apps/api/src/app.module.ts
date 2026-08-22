import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from '@app/config';
import { DatabaseModule } from '@app/database';
import { RedisModule } from '@app/redis';

@Module({
  imports: [AppConfigModule, DatabaseModule, RedisModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
