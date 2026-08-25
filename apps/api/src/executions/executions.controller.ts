import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';

import { RunWorkflowDto } from './dto/run-workflow.dto';
import { ExecutionsService } from './executions.service';

type AuthenticatedRequest = Request & {
  user: JwtPayload;
};

@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class ExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}

  @Post(':id/run')
  @HttpCode(HttpStatus.ACCEPTED)
  run(
    @Req() request: AuthenticatedRequest,

    @Param('id', new ParseUUIDPipe())
    workflowId: string,

    @Body() dto: RunWorkflowDto,
  ) {
    return this.executionsService.runManual(request.user.sub, workflowId, dto);
  }
}
