import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';

import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { WorkflowsService } from './workflows.service';

type AuthenticatedRequest = Request & {
  user: JwtPayload;
};

@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateWorkflowDto) {
    return this.workflowsService.create(request.user.sub, dto);
  }

  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.workflowsService.findAll(request.user.sub);
  }

  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) workflowId: string,
  ) {
    return this.workflowsService.findOne(request.user.sub, workflowId);
  }
}
