import { Module } from '@nestjs/common';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '@app/database';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
})
export class WorkflowsModule {}
