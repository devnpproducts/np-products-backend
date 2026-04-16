import { Controller, Get, Patch, Body, Param, ParseIntPipe } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { UpdateNotificationDto } from './dto/update-notification.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll() {
    return this.notificationsService.getRecent();
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