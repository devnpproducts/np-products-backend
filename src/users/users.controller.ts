import {
  Controller, Post, Get, Put, Body, Req, Param, UseGuards, ParseIntPipe, Patch
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: {
    userId: number;
    user: string;
  };
}

@Controller("users")
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private usersService: UsersService) { }

  @Post("create")
  createUser(
    @Body() body: CreateUserDto,
    @Req() req: RequestWithUser
  ) {
    return this.usersService.createUser({
      ...body,
      managerId: req.user.userId,
    });
  }

  @Get()
  getUsers(@Req() req: RequestWithUser) {
    return this.usersService.getUsers(req.user.userId);
  }

  @Put(':id')
  async updateUsers(
    @Param('id', ParseIntPipe) targetId: number,
    @Body() updateData: UpdateUserDto, // Adiós al 'any'
    @Req() req: RequestWithUser
  ) {
    const actorId = req.user.userId;
    return this.usersService.updateUserWithLog(targetId, updateData, actorId);
  }

  @Patch(':id/status')
  toggleStatus(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser
  ) {
    return this.usersService.toggleStatus(id, req.user.userId);
  }
}