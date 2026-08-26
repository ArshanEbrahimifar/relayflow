import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '@app/database';

import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { workflowDefinitionSchema } from '@app/workflow-engine';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { isDeepStrictEqual } from 'node:util';

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

  async findAll(userId: string) {
    return await this.database.workflow.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        name: true,
        status: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(userId: string, workflowId: string) {
    const workflow = await this.database.workflow.findFirst({
      where: {
        id: workflowId,
        userId,
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

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    return workflow;
  }

  async update(userId: string, workflowId: string, dto: UpdateWorkflowDto) {
    if (dto.name === undefined && dto.definition === undefined) {
      throw new BadRequestException('At least one field must be provided');
    }

    const normalizedName = dto.name !== undefined ? dto.name.trim() : undefined;

    const workflow = await this.database.workflow.findFirst({
      where: {
        id: workflowId,
        userId,
      },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    let parsedDefinition:
      ReturnType<typeof workflowDefinitionSchema.parse> | undefined;

    let definitionChanged = false;

    if (dto.definition !== undefined) {
      const result = workflowDefinitionSchema.safeParse(dto.definition);

      if (!result.success) {
        throw new BadRequestException('Invalid workflow definition');
      }

      parsedDefinition = result.data;

      definitionChanged = !isDeepStrictEqual(
        workflow.definition,
        parsedDefinition,
      );
    }

    const nameChanged =
      normalizedName !== undefined && normalizedName !== workflow.name;

    if (!nameChanged && !definitionChanged) {
      return workflow;
    }

    return this.database.workflow.update({
      where: {
        id: workflow.id,
      },
      data: {
        ...(nameChanged && {
          name: normalizedName,
        }),

        ...(definitionChanged && {
          definition: parsedDefinition,
          version: {
            increment: 1,
          },
        }),
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

  async activate(userId: string, workflowId: string) {
    const workflow = await this.database.workflow.findFirst({
      where: {
        id: workflowId,
        userId,
      },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    if (workflow.status === 'ACTIVE') {
      throw new BadRequestException('Workflow is already active');
    }

    const parsedDefinition = workflowDefinitionSchema.safeParse(
      workflow.definition,
    );

    if (!parsedDefinition.success) {
      throw new BadRequestException('Workflow definition is invalid');
    }

    if (parsedDefinition.data.steps.length === 0) {
      throw new BadRequestException(
        'Workflow must have at least one step before activation',
      );
    }

    return this.database.workflow.update({
      where: {
        id: workflow.id,
      },
      data: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        status: true,
        version: true,
        updatedAt: true,
      },
    });
  }

  async pause(userId: string, workflowId: string) {
    const workflow = await this.database.workflow.findFirst({
      where: {
        id: workflowId,
        userId,
      },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    if (workflow.status !== 'ACTIVE') {
      throw new BadRequestException('Only active workflows can be paused');
    }

    return this.database.workflow.update({
      where: {
        id: workflow.id,
      },
      data: {
        status: 'PAUSED',
      },
      select: {
        id: true,
        name: true,
        status: true,
        version: true,
        updatedAt: true,
      },
    });
  }
}
