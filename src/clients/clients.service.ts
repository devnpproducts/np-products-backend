import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) { }

async findByPhone(phone: string, userId: number) {
    const requester = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!requester) throw new NotFoundException('Usuario solicitante no válido');

    const client = await this.prisma.clients.findUnique({
      where: { phone: phone },
      include: {
        comments: {
          include: { creator: { select: { name: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado en la base maestra');
    }

    const prospectsWithHistory = await this.prisma.prospects.findMany({
      where: { phone: phone },
      include: {
        campaign: { select: { name: true } },
        seller: { select: { name: true } },
        history: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return {
      ...client,
      prospects: prospectsWithHistory
    };
  }
}