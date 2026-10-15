import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ProblemError } from '../problems.js';
import { CreateUserDto } from './create-user.dto.js';
import { User } from './user.entity.js';
import { UsersService } from './users.service.js';

const dto = (u: User) => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
  status: u.status,
  createdAt: u.createdAt.toISOString(),
});

@Controller('v1/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async listUsers(
    @Query('limit') limit = '20',
    @Query('cursor') cursor?: string,
  ) {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > 100)
      throw new ProblemError(400, 'Invalid input', undefined, [
        { field: 'limit', message: 'must be between 1 and 100' },
      ]);
    const page = await this.users.list(n, cursor);
    return { items: page.items.map(dto), nextCursor: page.nextCursor };
  }

  @Post()
  @HttpCode(201)
  @Header('Content-Type', 'application/json')
  async createUser(
    @Body() body: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.users.create(body.email, body.displayName);
    res.location(`/v1/users/${user.id}`);
    return dto(user);
  }

  @Get(':userId')
  async getUser(@Param('userId') userId: string) {
    return dto(await this.users.get(userId));
  }
}
