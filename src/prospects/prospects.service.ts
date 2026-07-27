import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';

import { PrismaService } from '../database/prisma.service';
import { CreateProspectDto, UpdateProspectDto } from './dto/prospect.dto';
import { EventsGateway } from '../common/gateways';

@Injectable()
export class ProspectsService {
  constructor(private prisma: PrismaService, private eventsGateway: EventsGateway) { }

  async getSubordinateIds(managerId: number): Promise<number[]> {
    const subordinates = await this.prisma.user.findMany({
      where: { managerId: managerId },
      select: { id: true }
    });

    let ids = subordinates.map(s => s.id);

    return [managerId, ...ids];
  }

  private async syncClient(phone: string, data: any) {
    if (!phone || phone === 'undefined' || phone === '') return;

    try {
      await this.prisma.clients.upsert({
        where: { phone: String(phone) },
        update: {
          names: data.names,
          lastNames: data.lastNames,
          email: data.email,
          address: data.address,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode
        },
        create: {
          phone: String(phone),
          names: data.names,
          lastNames: data.lastNames,
          email: data.email,
          address: data.address,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode
        },
      });
    } catch (error) {
      console.error('Error sincronizando cliente:', error);
    }
  }

  private cleanPhone(phone: any): string {
    if (!phone) return '';
    return String(phone).replace(/\s+/g, '').replace(/-/g, '').trim();
  }

  async create(data: CreateProspectDto, userId: number) {
    const formattedCreatedAt = data.createdAt
      ? new Date(data.createdAt).toISOString()
      : new Date().toISOString();

    const prospect = await this.prisma.prospects.create({
      data: {
        ...data,
        createdAt: formattedCreatedAt,
        userCreatorId: userId
      },
    });

    const phone = this.cleanPhone(data.phone);
    if (phone) {
      await this.prisma.clients.upsert({
        where: { phone },
        update: { names: data.names, lastNames: data.lastNames },
        create: { phone, names: data.names, lastNames: data.lastNames }
      });
    }

    return prospect;
  }
  async findAll(type: 'precontact' | 'contact' | 'sale', userId: number) {
    const requester = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!requester) {
      throw new Error('Usuario no encontrado');
    }

    const where: any = {
      status: true
    };

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

    if (type === 'sale') {
      where.isSale = true;
      where.status = true;
    } else if (type === 'contact') {
      where.originType = 'PROSPECT';
      where.isContacted = true;
      where.status = true;
    } else if (type === 'precontact') {
      where.originType = 'PROSPECT';
      where.status = true;
    }

    return this.prisma.prospects.findMany({
      where,
      include: {
        campaign: { select: { name: true } },
        seller: { select: { name: true, user: true, role: true } },
        creator: { select: { user: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async update(id: number, data: UpdateProspectDto, userId: number) {
    const updateData: any = { ...data };

    if (updateData.meetingDate) {
      updateData.meetingDate = new Date(updateData.meetingDate);
      if (isNaN(updateData.meetingDate.getTime())) {
        throw new BadRequestException('Formato de fecha inválido');
      }
    }

    if (updateData.isSale === true) {
      updateData.contactStatus = 'CONTACTO';
    }

    const fieldLabels: Record<string, string> = {
      names: 'Nombres',
      lastNames: 'Apellidos',
      phone: 'Teléfono',
      email: 'Correo',
      address: 'Dirección',
      city: 'Ciudad',
      state: 'Estado de residencia',
      zipCode: 'Código Postal',
      meetingDate: 'Fecha de Reunión',
      campaignId: 'Campaña',
      sellerId: 'Vendedor',
      contactStatus: 'Estado de contacto'
    };

    const fieldsUpdated = Object.keys(data);
    const translatedFields = fieldsUpdated
      .map(field => fieldLabels[field] || field)
      .join(', ');

    let actionType = 'ACTUALIZACION';
    let details = `Campos modificados: ${translatedFields}`;

    if (fieldsUpdated.length === 1 && fieldsUpdated[0] === 'meetingDate') {
      actionType = 'AGENDAMIENTO';

      if (updateData.meetingDate) {
        const dateFormatted = updateData.meetingDate.toLocaleString('es-ES', {
          timeZone: 'America/Lima',
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
        details = `Cita programada para el: ${dateFormatted}`;
      } else {
        details = `Cita cancelada o removida`;
      }
    }

    if (fieldsUpdated.length === 1 && fieldsUpdated[0] === 'campaignId') {
      actionType = 'ACTUALIZACION';
      const newCampaign = data.campaignId
        ? await this.prisma.campaigns.findUnique({ where: { id: Number(data.campaignId) } })
        : null;
      details = newCampaign
        ? `Prospecto movido a la campaña: ${newCampaign.name}`
        : 'Prospecto removido de la campaña';
    }

    if (fieldsUpdated.length === 1 && fieldsUpdated[0] === 'sellerId') {
      if (updateData.sellerId === null) {
        actionType = 'DESASIGNACION';
        details = 'El prospecto fue retirado y enviado a bandeja general';
      } else {
        actionType = 'ASIGNACION';
        details = 'El prospecto fue asignado a un asesor';
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      const prospectBefore = await tx.prospects.findUnique({ where: { id: Number(id) } });
      const editor = await tx.user.findUnique({ where: { id: userId }, select: { name: true } });

      const updated = await tx.prospects.update({
        where: { id: Number(id) },
        data: updateData,
      });

      if (updated.phone) {
        const oldPhone = prospectBefore?.phone;
        const phoneChanged = oldPhone && oldPhone !== updated.phone;

        if (phoneChanged) {
          await tx.clients.updateMany({
            where: { phone: oldPhone },
            data: {
              phone: updated.phone,
              names: updated.names,
              lastNames: updated.lastNames,
              email: updated.email,
              address: updated.address
            }
          });
        } else {
          await tx.clients.upsert({
            where: { phone: updated.phone },
            update: {
              names: updated.names,
              lastNames: updated.lastNames,
              email: updated.email,
              address: updated.address
            },
            create: {
              phone: updated.phone,
              names: updated.names,
              lastNames: updated.lastNames,
              email: updated.email
            }
          });
        }
      }

      await tx.prospectHistory.create({
        data: { prospectId: id, action: actionType, details, userId },
      });

      const oldSellerId = prospectBefore?.sellerId;
      const newSellerId = updated.sellerId;

      if ('sellerId' in data && oldSellerId !== newSellerId) {

        if (oldSellerId) {
          this.eventsGateway.emitProspectUpdate(oldSellerId, {
            id: updated.id,
            message: 'Un prospecto ha sido retirado de tu lista.',
            type: 'DESASIGNACION',
            user: editor?.name || "Sistema",
            updatedData: true
          });
        }

        if (newSellerId) {
          this.eventsGateway.emitProspectUpdate(newSellerId, {
            id: updated.id,
            message: 'Se te ha asignado un nuevo prospecto.',
            type: 'ASIGNACION',
            user: editor?.name || "Sistema",
            updatedData: true,
            targetUserId: newSellerId
          });
        }
      }

      else if (updated.sellerId) {
        this.eventsGateway.emitProspectUpdate(updated.sellerId, {
          id: updated.id, message: details, type: actionType, user: editor?.name || "Sistema", updatedData: true
        });
      }

      return updated;
    });
  }

  private async createLog(prospectId: number, action: string, details: string, userId?: number) {
    await this.prisma.prospectHistory.create({
      data: { prospectId, action, details, userId }
    });
  }

  async getHistory(prospectId: number) {
    return this.prisma.prospectHistory.findMany({
      where: { prospectId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async markContacted(id: number, userId: number) {
    const result = await this.prisma.prospects.update({
      where: { id },
      data: { isContacted: true, contactedAt: new Date() }
    });

    await this.createLog(id, 'CONTACTADO', 'El prospecto pasó a etapa de contacto', userId);
    return result;
  }

  async markAsSale(id: number, userId: number) {
    const result = this.prisma.prospects.update({
      where: { id },
      data: {
        isSale: true,
        isContacted: true,
        soldAt: new Date()
      },
    });

    await this.createLog(id, 'VENTA', 'Conversión exitosa: Venta cerrada', userId);
    return result;
  }

  async processExcel(campaignId: number | null, file: Express.Multer.File, userId: number, type: string) {
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

      const allPhonesFromExcel = data.map((item: any) =>
        this.cleanPhone(item.Telefono || item['Teléfono'] || item.phone || item.Phone)
      ).filter(Boolean);

      const existingProspects = await tx.prospects.findMany({
        where: { phone: { in: allPhonesFromExcel } },
        select: { phone: true }
      });

      const existingPhonesSet = new Set(existingProspects.map(p => p.phone));
      const seenInExcel = new Set();

      let duplicateCount = 0;
      let newCount = 0;

      const prospectsData = data.map((item: any) => {
        // 1. Limpieza rigurosa de los campos obligatorios/críticos
        const phone = this.cleanPhone(item.Telefono || item['Teléfono'] || item.phone || item.Phone);
        const names = String(item.Nombre || item.names || item.name || item.Nombres || 'Sin nombre').trim();
        const lastNames = String(item.Apellido || item.lastNames || item.lastName || item.Apellidos || '').trim();

        const originFromExcel = item.origin || item.Origin || item.Origen || item.ORIGEN || item.origen;
        const finalOrigin = originFromExcel ? String(originFromExcel).trim() : 'ORGÁNICO';

        const email = item.email || item.Email || item.correo || item.Correo;
        const address = item.address || item.Address || item.direccion || item.Direccion || item.Dirección;
        const city = item.city || item.City || item.ciudad || item.Ciudad;
        const state = item.state || item.State || item.estado || item.Estado || item.departamento || item.Departamento;
        const zipCode = item.zipCode || item.ZipCode || item.zipcode || item.codigoPostal || item['Código Postal'];

        let isDuplicate = false;
        if (existingPhonesSet.has(phone) || seenInExcel.has(phone)) {
          isDuplicate = true;
          duplicateCount++;
        } else {
          if (phone) seenInExcel.add(phone);
          newCount++;
        }

        return {
          userCreatorId: userId,
          names,
          lastNames,
          phone,

          email: email ? String(email).trim() : undefined,
          address: address ? String(address).trim() : undefined,
          city: city ? String(city).trim() : undefined,
          state: state ? String(state).trim() : undefined,
          zipCode: zipCode ? String(zipCode).trim() : undefined,
          origin: finalOrigin,

          importId: prospectImport.id,
          campaignId: campaignId || null,
          originType: type,
          status: true,
          isDuplicate: isDuplicate
        };
      });

      const createdProspects = await tx.prospects.createMany({
        data: prospectsData,
        skipDuplicates: true,
      });

      const uniquePhones = Array.from(new Set(prospectsData.map(p => p.phone)))
        .filter(p => p && p.length >= 5);

      for (const phone of uniquePhones) {
        const pData = prospectsData.find(p => p.phone === phone);
        if (!pData) continue;

        try {
          await tx.clients.upsert({
            where: { phone: String(phone) },
            update: {
              names: pData.names,
              lastNames: pData.lastNames
            },
            create: {
              phone: String(phone),
              names: pData.names,
              lastNames: pData.lastNames
            }
          });
        } catch (err: any) {
          console.error(`[DEBUG ERROR] Falló upsert para teléfono ${phone}:`, err.message);
        }
      }

      const summaryMessage = `Carga masiva: ${newCount} nuevos, ${duplicateCount} duplicados en campaña ID ${campaignId}`;

      await tx.registerChanceUser.create({
        data: {
          userId: userId,
          userCreatorId: userId,
          change: summaryMessage,
        },
      });

      this.eventsGateway.server.emit('activity', {
        user: "Sistema",
        change: summaryMessage,
        date: new Date()
      });

      await tx.notifications.create({
        data: {
          title: duplicateCount > 0 ? "Carga con duplicados" : "Carga Exitosa",
          content: summaryMessage,
          type: 'GENERAL',
          userId: userId,
          metadata: { sku: summaryMessage }
        }
      });

      return {
        message: 'Carga completada',
        totalProcessed: prospectsData.length,
        newCount: newCount,
        duplicateCount: duplicateCount
      };
    });
  }

  async remove(id: number) {
    return this.prisma.prospects.update({ where: { id }, data: { status: false } });
  }
}