import { Module } from '@nestjs/common';
import { ExecutionsController } from './executions.controller';
import { ExecutionsService } from './executions.service';
import { DatabaseModule } from '@app/database';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ExecutionsController],
  providers: [ExecutionsService],
})
export class ExecutionsModule {}
