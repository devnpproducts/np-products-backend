import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateNotificationDto } from './dto/update-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getRecent() {
    return this.prisma.notifications.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { user: true }
        }
      }
    });
  }

  // Marcar como leída
  async markAsRead(id: number, updateDto: UpdateNotificationDto) {
    return this.prisma.notifications.update({
      where: { id },
      data: { isRead: updateDto.isRead },
    });
  }

  // Opcional: Marcar todas como leídas de golpe (Muy útil para el usuario)
  async markAllAsRead() {
    return this.prisma.notifications.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
  }
}