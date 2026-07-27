import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateCommentContactsDto, UpdateCommentContactsDto } from './dto/commentsContacts.dto';

@Injectable()
export class CommentsContactsService {
  constructor(private prisma: PrismaService) { }

  async create(ContactId: number, comment: string, userId: number) {
    const contact = await this.prisma.contacts.findUnique({
      where: { id: ContactId },
      select: { phone: true }
    });

    if (!contact || !contact.phone) {
      throw new NotFoundException('Contacto sin teléfono válido');
    }

    const client = await this.prisma.clients.findUnique({
      where: { phone: contact.phone }
    });

    if (!client) {
      throw new NotFoundException('No se encontró el cliente maestro para vincular el comentario');
    }

    return this.prisma.commentsContacts.create({
      data: {
        comment: comment,
        userCreatorId: userId,
        ContactId: ContactId,
        clientsId: client.id
      }
    });
  }

  async findAllByContact(contactId: number, userId: number) {
    const requester = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!requester) {
      throw new Error('Usuario no encontrado');
    }

    const where: any = {
      ContactId: contactId,
      status: true
    };

    const rolesConAccesoTotal = ['ADMIN', 'SUPERVISOR', 'DESPACHO'];

    if (!requester.role || !rolesConAccesoTotal.includes(requester.role)) {
      where.userCreatorId = requester.id;
    }

    return await this.prisma.commentsContacts.findMany({
      where,
      include: {
        creator: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async update(id: number, data: UpdateCommentContactsDto) {
    const exists = await this.prisma.commentsContacts.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Comentario no encontrado');

    return await this.prisma.commentsContacts.update({
      where: { id },
      data: { comment: data.comment }
    });
  }

  async remove(id: number) {
    const exists = await this.prisma.commentsContacts.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Comentario no encontrado');

    return await this.prisma.commentsContacts.update({
      where: { id },
      data: { status: false }
    });
  }
}