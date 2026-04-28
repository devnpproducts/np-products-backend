import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProspectDto, UpdateProspectDto } from './dto/prospect.dto';
import { EventsGateway } from '../common/gateways';

@Injectable()
export class ProspectsService {
  constructor(private prisma: PrismaService, private eventsGateway: EventsGateway) { }

  async create(data: CreateProspectDto, userId: number) {
    return this.prisma.prospects.create({
      data: {
        ...data,
        userCreatorId: userId,
      },
    });
  }

  async findAll(type: 'precontact' | 'contact' | 'sale', userId: number) {
    const requester = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!requester) {
      throw new Error('Sin Usuarios');
    }

    const where: any = {
      status: true
    };

    if (requester.role !== 'ADMIN') {
      where.AND = [
        {
          OR: [
            { userCreatorId: userId },
            { sellerId: userId }
          ]
        }
      ];
    }

    if (type === 'sale') {
      where.isSale = true;
    } else if (type === 'contact') {
      where.isContacted = true;
      where.isSale = false;
    } else if (type === 'precontact') {

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

  // 1. Transformación de fecha (Fixing Timezones)
  if (updateData.meetingDate) {
    updateData.meetingDate = new Date(updateData.meetingDate);
    if (isNaN(updateData.meetingDate.getTime())) {
      throw new BadRequestException('Formato de fecha inválido');
    }
  }

  // 2. Mapeo de campos para el Log
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
    sellerId: 'Vendedor'
  };

  const fieldsUpdated = Object.keys(data);
  const translatedFields = fieldsUpdated
    .map(field => fieldLabels[field] || field)
    .join(', ');

  let actionType = 'ACTUALIZACION';
  let details = `Campos modificados: ${translatedFields}`;

  // Especial para Agendamientos
  if (fieldsUpdated.length === 1 && fieldsUpdated[0] === 'meetingDate') {
    actionType = 'AGENDAMIENTO';
    const dateFormatted = updateData.meetingDate.toLocaleDateString('es-ES', {
      timeZone: 'UTC',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    details = `Cita programada para el: ${dateFormatted}`;
  }

  // 3. Transacción y Emisión
  return await this.prisma.$transaction(async (tx) => {
    // Obtenemos el nombre del usuario que está editando para el socket
    const editor = await tx.user.findUnique({ where: { id: userId }, select: { name: true } });

    const updated = await tx.prospects.update({
      where: { id: Number(id) },
      data: updateData,
    });

    await tx.prospectHistory.create({
      data: {
        prospectId: id,
        action: actionType,
        details: details,
        userId: userId,
      },
    });

    // 🚀 EMISIÓN DEL SOCKET (CON LOS CAMPOS QUE EL FRONT ESPERA)
    this.eventsGateway.emitProspectUpdate(updated.sellerId, {
      id: updated.id,
      message: details,
      type: actionType,
      user: editor?.name || "Sistema", // Para la campana
      updatedData: true // 👈 ¡ESTE ES EL FIX! Para que el IF del front dispare
    });

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

  async remove(id: number) {
    return this.prisma.prospects.update({ where: { id }, data: { status: false } });
  }
}