import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProspectDto, UpdateProspectDto } from './dto/prospect.dto';

@Injectable()
export class ProspectsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateProspectDto, userId: number) {
    return this.prisma.prospects.create({
      data: {
        ...data,
        userCreatorId: userId,
      },
    });
  }

  // Filtro inteligente para las 3 vistas
  async findAll(type: 'precontact' | 'contact' | 'sale', userId: number, role: string) {
    const where: any = {};
    
    // 1. Filtro por Rol (Si no es admin, solo ve lo asignado o creado)
    if (role !== 'ADMIN') {
      where.OR = [
        { userCreatorId: userId },
        { sellerId: userId }
      ];
    }

    // 2. Filtro por Etapa del Embudo
    if (type === 'contact') where.isContacted = true;
    if (type === 'sale') where.isSale = true;
    // 'precontact' no lleva filtro extra porque queremos verlos todos

    return this.prisma.prospects.findMany({
      where,
      include: {
        campaign: { select: { name: true } },
        seller: { select: { name: true, user: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async update(id: number, data: UpdateProspectDto) {
    return this.prisma.prospects.update({
      where: { id },
      data,
    });
  }

  // Acciones rápidas para el flujo del CRM
  async markAsContacted(id: number) {
    return this.prisma.prospects.update({
      where: { id },
      data: { 
        isContacted: true, 
        contactedAt: new Date() 
      },
    });
  }

  async markAsSale(id: number) {
    return this.prisma.prospects.update({
      where: { id },
      data: { 
        isSale: true, 
        isContacted: true, // Una venta siempre fue contactada
        soldAt: new Date() 
      },
    });
  }

  async remove(id: number) {
    return this.prisma.prospects.delete({ where: { id } });
  }
}