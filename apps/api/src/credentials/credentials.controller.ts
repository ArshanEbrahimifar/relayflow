import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateCredentialDto } from './dto/create-credential.dto';
import { CredentialsService } from './credentials.service';

type AuthenticatedRequest = Request & {
  user: {
    sub: string;
    email: string;
  };
};

@Controller('credentials')
@UseGuards(JwtAuthGuard)
export class CredentialsController {
  constructor(private readonly credentialsService: CredentialsService) {}

  @Post()
  create(
    @Body() dto: CreateCredentialDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.credentialsService.create(request.user.sub, dto);
  }

  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.credentialsService.findAll(request.user.sub);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.credentialsService.remove(request.user.sub, id);
  }
}
