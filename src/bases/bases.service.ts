import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { EventsGateway } from '../common/gateways';

@Injectable()
export class BasesService {
  constructor(private prisma: PrismaService,
    private eventsGateway: EventsGateway
  ) { }

  async getSubordinateIds(managerId: number): Promise<number[]> {
    const subordinates = await this.prisma.user.findMany({
      where: { managerId: managerId },
      select: { id: true }
    });

    let ids = subordinates.map(s => s.id);

    return [managerId, ...ids];
  }

  async findAll(userId: number) {
    const requester = await this.prisma.user.findUnique({ where: { id: userId } });

    const where: any = { originType: 'BASE' };

    if (!requester) {
      throw new Error('Sin Bases');
    }

    if (requester.role !== 'ADMIN') {
      const authorizedUserIds = await this.getSubordinateIds(userId);

      where.AND = [
        {
          OR: [
            { userCreatorId: { in: authorizedUserIds } },
            { sellerId: { in: authorizedUserIds } }
          ]
        }
      ];
    }

    return this.prisma.prospects.findMany({
      where,
      include: {
        creator: { select: { name: true } },
        seller: { select: { name: true } },
        campaign: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

}