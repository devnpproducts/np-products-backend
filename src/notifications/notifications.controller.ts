import { Controller, Get, Patch, Body, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, } from '@nestjs/passport';

import { NotificationsService } from './notifications.service';
import { UpdateNotificationDto } from './dto/update-notification.dto';

interface RequestWithUser extends Request {
  user: { userId: number };
}


@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@Req() req: RequestWithUser) {
    return this.notificationsService.getRecent(req.user.userId);
  }

  @Patch(':id/read')
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateDto: UpdateNotificationDto
  ) {
    return this.notificationsService.markAsRead(id, updateDto);
  }

  @Patch('read-all')
  readAll() {
    return this.notificationsService.markAllAsRead();
  }
}