import { AppConfigModule } from '@app/config';
import { Module } from '@nestjs/common';

@Module({
  imports: [AppConfigModule],
})
export class WorkerModule {}
