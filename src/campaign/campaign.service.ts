import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';
import { EventsGateway } from '../common/gateways';

@Injectable()
export class CampaignService {
  constructor(private prisma: PrismaService,
    private eventsGateway: EventsGateway
  ) { }

  async create(data: CreateCampaignDto, userId: number) {
    return this.prisma.campaigns.create({
      data: {
        name: data.name,
        userCreatorId: userId,
      },
    });
  }

  async findAll(userId: number) {
    const requester = await this.prisma.user.findUnique({ where: { id: userId } });

    const where: any = {};

    if (!requester) {
      throw new Error('Sin Bases');
    }

    if (requester.role !== 'ADMIN') {
      where.AND = [
        {
          OR: [
            { userCreatorId: userId }
          ]
        }
      ];
    }

    return this.prisma.campaigns.findMany({
      where,
      include: {
        creator: { select: { name: true } },
        assignedSeller: { select: { name: true, user: true } },
        _count: {
          select: { prospects: true },
        },
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: number) {
    const campaign = await this.prisma.campaigns.findUnique({
      where: { id },
      include: { prospects: true },
    });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');
    return campaign;
  }

  async update(id: number, data: UpdateCampaignDto) {
    return this.prisma.campaigns.update({
      where: { id },
      data,
    });
  }

  async toggleStatus(id: number) {
    const campaign = await this.findOne(id);

    if (!campaign) {
      throw new Error('Sin campaign');
    }

    const newStatus = !campaign.status;

    this.eventsGateway.server.emit('update_prospects', {
      campaignId: id
    });

    return this.prisma.$transaction([
      this.prisma.campaigns.update({
        where: { id },
        data: { status: newStatus },
      }),

      this.prisma.prospects.updateMany({
        where: { campaignId: id },
        data: { status: newStatus },
      }),
    ]);

  }

  async assignCampaignToSeller(campaignId: number, sellerId: number | null, adminId: number) {
    const campaign = await this.prisma.campaigns.findUnique({
      where: { id: campaignId }
    });

    if (!campaign) throw new Error('Campaña no encontrada');

    const accion = sellerId ? `Asignada a vendedor ID: ${sellerId}` : 'Desasignada (Puesta en espera)';
    const title = "Gestión de Base";
    const content = `La campaña "${campaign.name}" ha sido ${sellerId ? 'asignada' : 'liberada'}.`;

    const result = await this.prisma.$transaction([

      this.prisma.prospects.updateMany({
        where: { campaignId },
        data: { sellerId }
      }),

      this.prisma.campaigns.update({
        where: { id: campaignId },
        data: { sellerId }
      }),

      this.prisma.notifications.create({
        data: {
          title,
          content,
          type: 'GENERAL',
          userId: adminId,
          metadata: { campaignId, sellerId }
        }
      })
    ]);

    this.eventsGateway.server.emit('activity', {
      user: "Sistema",
      change: `Campaña ${campaign.name}: ${accion}`,
      date: new Date()
    });

    this.eventsGateway.server.emit('update_prospects', {
      targetSellerId: sellerId,
      campaignId: campaignId
    });

    return result;
  }
}