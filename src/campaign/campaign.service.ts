import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';

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

  async processExcel(campaignId: number, file: Express.Multer.File, userId: number, type: 'BASE' | 'CAMPAIGN') {
    if (!file) throw new BadRequestException('Archivo no proporcionado');

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) throw new BadRequestException('El archivo está vacío');

    return this.prisma.$transaction(async (tx) => {

      const prospectImport = await tx.prospectImport.create({
        data: {
          filename: file.originalname,
          description: `Carga masiva realizada por ${userId}`,
          userCreatorId: userId,
        }
      });

      const prospectsData = data.map((item: any) => ({
        userCreatorId: userId,
        names: String(item.Nombre || item.names || item.name || 'Sin nombre'),
        lastNames: String(item.Apellido || item.lastNames || ''),
        phone: String(item.Telefono || item.phone || ''),
        importId: prospectImport.id,
        campaignId: campaignId || 0,
        originType: type,
        status: true,
        isContacted: false,
        isSale: false
      }));

      const createdProspects = await tx.prospects.createMany({
        data: prospectsData,
        skipDuplicates: true,
      });

      await tx.registerChanceUser.create({
        data: {
          userId: userId,
          userCreatorId: userId,
          change: `Carga masiva: ${createdProspects.count} prospectos añadidos a la campaña ID ${campaignId}`,
        },
      });

      this.eventsGateway.server.emit('activity', {
        user: "Sistema",
        change: `Carga masiva: ${createdProspects.count} prospectos añadidos a la campaña ID ${campaignId}`,
        date: new Date()
      });

      await tx.notifications.create({
        data: {
          title: "Alerta de Carga",
          content: `Carga masiva: ${createdProspects.count} prospectos añadidos a la campaña ID ${campaignId}`,
          type: 'GENERAL',
          userId: userId,
          metadata: { sku: `Carga masiva: ${createdProspects.count} prospectos añadidos a la campaña ID ${campaignId}` }
        }
      });

      return {
        message: 'Carga completada con éxito',
        count: createdProspects.count,
      };
    });
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