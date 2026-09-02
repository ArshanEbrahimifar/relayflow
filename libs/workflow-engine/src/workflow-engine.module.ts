import { Module } from '@nestjs/common';
import { WorkflowEngineService } from './workflow-engine.service';
import { DatabaseModule } from '@app/database';
import { EncryptionModule } from '@app/encryption';

@Module({
  imports: [DatabaseModule, EncryptionModule],
  providers: [WorkflowEngineService],
  exports: [WorkflowEngineService],
})
export class WorkflowEngineModule {}
