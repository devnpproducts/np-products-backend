import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comments.dto';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) { }

  async create(prospectId: number, comment: string, userId: number) {
    const prospect = await this.prisma.prospects.findUnique({
      where: { id: prospectId },
      select: { phone: true }
    });

    if (!prospect || !prospect.phone) {
      throw new NotFoundException('Prospecto sin teléfono válido');
    }

    const client = await this.prisma.clients.findUnique({
      where: { phone: prospect.phone }
    });

    if (!client) {
      throw new NotFoundException('No se encontró el cliente maestro para vincular el comentario');
    }

    return this.prisma.commentsProspects.create({
      data: {
        comment: comment,
        userCreatorId: userId,
        prospectsId: prospectId,
        clientsId: client.id
      }
    });
  }

  async findAllByProspect(prospectId: number, userId: number) {
    const requester = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!requester) {
      throw new Error('Usuario no encontrado');
    }

    const where: any = {
      prospectsId: prospectId,
      status: true
    };

    const rolesConAccesoTotal = ['ADMINT', 'ADMIN', 'SUPERVISOR', 'DESPACHO', 'SEGUIMIENTO'];

    if (!requester.role || !rolesConAccesoTotal.includes(requester.role)) {
      where.userCreatorId = requester.id;
    }

    return await this.prisma.commentsProspects.findMany({
      where,
      include: {
        creator: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async update(id: number, data: UpdateCommentDto) {
    const exists = await this.prisma.commentsProspects.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Comentario no encontrado');

    return await this.prisma.commentsProspects.update({
      where: { id },
      data: { comment: data.comment }
    });
  }

  async remove(id: number) {
    const exists = await this.prisma.commentsProspects.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Comentario no encontrado');

    return await this.prisma.commentsProspects.update({
      where: { id },
      data: { status: false }
    });
  }
}