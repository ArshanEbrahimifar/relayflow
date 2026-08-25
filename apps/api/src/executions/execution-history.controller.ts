import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';

import { ExecutionsService } from './executions.service';

type AuthenticatedRequest = Request & {
  user: JwtPayload;
};

@Controller('executions')
@UseGuards(JwtAuthGuard)
export class ExecutionHistoryController {
  constructor(private readonly executionsService: ExecutionsService) {}

  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.executionsService.findAll(request.user.sub);
  }

  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,

    @Param('id', new ParseUUIDPipe())
    executionId: string,
  ) {
    return this.executionsService.findOne(request.user.sub, executionId);
  }
}
