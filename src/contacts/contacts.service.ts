// contacts.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

import { EventsGateway } from '../common/gateways';

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService, private eventsGateway: EventsGateway) { }

  async getSubordinateIds(managerId: number): Promise<number[]> {
    const subordinates = await this.prisma.user.findMany({
      where: { managerId: managerId },
      select: { id: true }
    });

    let ids = subordinates.map(s => s.id);

    return [managerId, ...ids];
  }

  // ==========================================
  // HELPER: CLEAN PHONE
  // ==========================================
  private cleanPhone(phone: any): string {
    if (!phone) return '';
    return String(phone).replace(/\s+/g, '').replace(/-/g, '').trim();
  }

  async create(data: CreateContactDto, userId: number) {
    if (data.phone) {
      data.phone = this.cleanPhone(data.phone);
    }

    const { createdAt, amount, ...restData } = data;

    let parsedDate = new Date();
    if (createdAt) {
      parsedDate = new Date(`${createdAt}T00:00:00.000Z`);
    }

    // 3. Enviamos a Prisma
    const contact = await this.prisma.contacts.create({
      data: {
        ...restData,
        createdAt: parsedDate,
        I1: amount ? Number(amount) : null,
        userCreatorId: userId,
        soldAt: restData.isSale ? new Date() : null,
      }
    });

    return contact;
  }

  async findAll(type: 'all' | 'sale', userId: number) {
    const requester = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!requester) {
      throw new Error('Usuario no encontrado');
    }

    const where: any = {
      status: true,
      autoCreated: false
    };

    if (requester.role !== 'ADMIN' && requester.role !== 'SEGUIMIENTO') {
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
    }

    return this.prisma.contacts.findMany({
      where,
      include: {
        seller: { select: { name: true, user: true, role: true } },
        creator: { select: { user: true, name: true } },
        sale: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: number, userId: number) {
    const requester = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!requester) throw new Error('Usuario no encontrado');

    const authorizedUserIds = await this.getSubordinateIds(userId);

    const contact = await this.prisma.contacts.findUnique({
      where: { id },
      include: {
        seller: { select: { name: true, user: true, role: true } },
        creator: { select: { user: true, name: true } },
        sale: true
      }
    });

    if (!contact) throw new NotFoundException('Contacto no encontrado');

    if (requester.role !== 'ADMIN' && requester.role !== 'SEGUIMIENTO') {
      const canAccess = authorizedUserIds.includes(contact.userCreatorId) || (contact.sellerId && authorizedUserIds.includes(contact.sellerId));
      if (!canAccess) throw new BadRequestException('No tienes permisos para ver este contacto');
    }

    return contact;
  }

  async update(id: number, data: UpdateContactDto, userId: number) {
    const updateData: any = { ...data };

    const fieldLabels: Record<string, string> = {
      names: 'Nombres',
      lastNames: 'Apellidos',
      phone: 'Teléfono',
      email: 'Correo',
      address: 'Dirección',
      city: 'Ciudad',
      state: 'Estado de residencia',
      zipCode: 'Código Postal',
      origin: 'Origen',
      campaignId: 'Campaña',
      sellerId: 'Vendedor',
      status: 'Estado (Activo/Inactivo)',
      originType: 'Tipo de Origen',
      contactStatus: 'Estado de contacto',
      paymentInstallments: 'Número de Cuotas',
      I1: 'Monto Cuota 1',
      I2: 'Monto Cuota 2',
      I3: 'Monto Cuota 3',
      I4: 'Monto Cuota 4',
      I5: 'Monto Cuota 5',
      isSale: 'Estado de Venta',
      soldAt: 'Fecha de Venta'
    };

    const fieldsUpdated = Object.keys(data);
    const translatedFields = fieldsUpdated
      .map(field => fieldLabels[field] || field)
      .join(', ');

    let actionType = 'ACTUALIZACION';
    let details = `Campos modificados: ${translatedFields}`;

    if (fieldsUpdated.length === 1 && fieldsUpdated[0] === 'campaignId') {
      actionType = 'ACTUALIZACION';
      const newCampaign = data.campaignId
        ? await this.prisma.campaigns.findUnique({ where: { id: Number(data.campaignId) } })
        : null;
      details = newCampaign
        ? `Contacto movido a la campaña: ${newCampaign.name}`
        : 'Contacto removido de la campaña';
    }

    if (fieldsUpdated.length === 1 && fieldsUpdated[0] === 'sellerId') {
      if (updateData.sellerId === null) {
        actionType = 'DESASIGNACION';
        details = 'El contacto fue retirado y enviado a bandeja general';
      } else {
        actionType = 'ASIGNACION';
        details = 'El contacto fue asignado a un asesor';
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      const contactBefore = await tx.contacts.findUnique({ where: { id: Number(id) } });
      const editor = await tx.user.findUnique({ where: { id: userId }, select: { name: true } });

      const updated = await tx.contacts.update({
        where: { id: Number(id) },
        data: updateData,
      });

      if (updated.phone) {
        const oldPhone = contactBefore?.phone;
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

      await tx.contactsHistory.create({
        data: { contactId: id, action: actionType, details, userId },
      });

      const oldSellerId = contactBefore?.sellerId;
      const newSellerId = updated.sellerId;

      if ('sellerId' in data && oldSellerId !== newSellerId) {

        if (oldSellerId) {
          this.eventsGateway.emitContactUpdate(oldSellerId, {
            id: updated.id,
            message: 'Un contacto ha sido retirado de tu lista.',
            type: 'DESASIGNACION',
            user: editor?.name || "Sistema",
            updatedData: true
          });
        }

        if (newSellerId) {
          this.eventsGateway.emitContactUpdate(newSellerId, {
            id: updated.id,
            message: 'Se te ha asignado un nuevo contacto.',
            type: 'ASIGNACION',
            user: editor?.name || "Sistema",
            updatedData: true,
            targetUserId: newSellerId
          });
        }
      }

      else if (updated.sellerId) {
        this.eventsGateway.emitContactUpdate(updated.sellerId, {
          id: updated.id, message: details, type: actionType, user: editor?.name || "Sistema", updatedData: true
        });
      }

      return updated;
    });
  }

  private async createLog(contactId: number, action: string, details: string, userId?: number) {
    await this.prisma.contactsHistory.create({
      data: { contactId, action, details, userId }
    });
  }

  async getHistory(contactId: number) {
    return this.prisma.contactsHistory.findMany({
      where: { contactId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async markAsSale(id: number, userId: number) {
    const result = this.prisma.contacts.update({
      where: { id },
      data: {
        isSale: true,
        soldAt: new Date()
      },
    });

    await this.createLog(id, 'VENTA', 'Conversión exitosa: Venta cerrada', userId);
    return result;
  }
}