import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateNotificationDto } from './dto/update-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) { }

  private async getSubordinateIds(managerId: number): Promise<number[]> {
    const subordinates = await this.prisma.user.findMany({
      where: { managerId: managerId },
      select: { id: true }
    });

    const ids = subordinates.map(s => s.id);
    return [managerId, ...ids];
  }

  private async getAccessConfig(userId: number) {
    const requester = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!requester) throw new Error('Usuario no encontrado');

    const role = requester.role?.toUpperCase() || '';

    // 1. ADMINT: Ve todo de manera global
    if (role === 'ADMINT') {
      return { global: true, excludeAffiliates: false, authorizedUserIds: [] };
    }

    // 2. ADMIN y DESPACHO: Global, pero sin notificaciones de afiliados
    if (role === 'ADMIN' || role === 'DESPACHO') {
      return { global: true, excludeAffiliates: true, authorizedUserIds: [] };
    }

    // 3. ÚNICAMENTE SEGUIMIENTO: Usa el ID de su jefe para ver el equipo al que asiste
    if (role === 'SEGUIMIENTO') {
      const targetManagerId = requester.managerId ? requester.managerId : requester.id;
      let authorizedUserIds = await this.getSubordinateIds(targetManagerId);

      // Filtro de seguridad: Si el jefe de Seguimiento es un ADMINT o ADMIN,
      // quitamos su ID del array para no filtrar las notificaciones globales hacia abajo
      const targetManager = await this.prisma.user.findUnique({
        where: { id: targetManagerId },
        select: { role: true }
      });

      if (targetManager && ['ADMINT', 'ADMIN'].includes(targetManager.role?.toUpperCase() || '')) {
        authorizedUserIds = authorizedUserIds.filter(id => id !== targetManagerId);
      }

      return { global: false, excludeAffiliates: false, authorizedUserIds };
    }

    // 4. SUPERVISORES Y DEMÁS ROLES (Vendedores, etc): 
    // Solo su propio usuario (requester.id) y sus subordinados directos.
    const authorizedUserIds = await this.getSubordinateIds(requester.id);
    return { global: false, excludeAffiliates: false, authorizedUserIds };
  }

  async getRecent(userId: number) {
    const access = await this.getAccessConfig(userId);
    const where: any = {};

    if (access.global) {
      if (access.excludeAffiliates) {
        // Excluye notificaciones donde el creador (user) tenga el rol AFILIADO
        // Permite notificaciones del sistema (userId null) o creadores no-afiliados
        where.OR = [
          { userId: null },
          { user: { role: { not: 'AFILIADO' } } }
        ];
      }
      // Si es ADMINT (global: true, excludeAffiliates: false), 'where' queda vacío y trae todo
    } else {
      // Supervisores / Vendedores: Solo eventos creados por usuarios de su equipo
      where.userId = { in: access.authorizedUserIds };
    }

    return this.prisma.notifications.findMany({
      where,
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      }
    });
  }

  async markAsRead(id: number, updateDto: UpdateNotificationDto) {
    return this.prisma.notifications.update({
      where: { id },
      data: { isRead: updateDto.isRead },
    });
  }

  async markAllAsRead() {
    return this.prisma.notifications.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
  }
}