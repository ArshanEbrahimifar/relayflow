import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '@app/database';

import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { workflowDefinitionSchema } from './schemas/workflow-definition.schema';

@Injectable()
export class WorkflowsService {
  constructor(private readonly database: DatabaseService) {}

  async create(userId: string, dto: CreateWorkflowDto) {
    const parsedDefinition = workflowDefinitionSchema.safeParse(dto.definition);

    if (!parsedDefinition.success) {
      throw new BadRequestException('Invalid workflow definition');
    }

    return await this.database.workflow.create({
      data: {
        userId,
        name: dto.name.trim(),
        definition: parsedDefinition.data,
      },
      select: {
        id: true,
        name: true,
        status: true,
        definition: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
