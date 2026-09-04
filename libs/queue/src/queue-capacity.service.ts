import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';

import type { Queue } from 'bullmq';

import { WORKFLOW_EXECUTION_QUEUE } from './queue.constants';

import type { ExecuteWorkflowJobData } from './execution-job.type';

@Injectable()
export class QueueCapacityService {
  private static readonly MAX_QUEUE_DEPTH = 1000;

  constructor(
    @InjectQueue(WORKFLOW_EXECUTION_QUEUE)
    private readonly executionQueue: Queue<ExecuteWorkflowJobData>,
  ) {}

  async hasCapacity(): Promise<boolean> {
    const counts = await this.executionQueue.getJobCounts(
      'waiting',
      'active',
      'delayed',
    );

    const queueDepth = counts.waiting + counts.active + counts.delayed;

    return queueDepth < QueueCapacityService.MAX_QUEUE_DEPTH;
  }
}
