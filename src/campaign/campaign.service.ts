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
    return this.prisma.campaigns.findMany({
      where: {
        userCreatorId: userId,
      },
      include: {
        _count: {
          select: { prospects: true },
        },
      },
      orderBy: { createdAt: 'desc' },
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
    return this.prisma.campaigns.update({
      where: { id },
      data: { status: !campaign.status },
    });
  }

  async processExcel(campaignId: number, file: Express.Multer.File, userId: number) {
    if (!file) throw new BadRequestException('Archivo no proporcionado');

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) throw new BadRequestException('El archivo está vacío');

    return this.prisma.$transaction(async (tx) => {

      const prospectsData = data.map((item: any) => ({
        userCreatorId: userId,
        names: String(item.Nombre || item.names || item.name || 'Sin nombre'),
        lastNames: String(item.Apellido || item.lastNames || ''),
        phone: String(item.Telefono || item.phone || ''),
        campaignId: campaignId,
        status: true
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

  async assignCampaignToSeller(campaignId: number, sellerId: number) {
    return this.prisma.prospects.updateMany({
      where: { campaignId: campaignId },
      data: { sellerId: sellerId }
    });
  }
}