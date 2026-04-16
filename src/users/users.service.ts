import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../database/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { encrypt, decrypt } from '../utils/crypto.util';
import { EventsGateway } from '../common/gateways';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService,
    private eventsGateway: EventsGateway
  ) { }

  async findByUser(user: string) {
    return this.prisma.user.findUnique({ where: { user } });
  }

  async createUser(data: CreateUserDto & { managerId: number }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { user: data.user }
    });

    if (existingUser) {
      throw new Error('El usuario ya existe');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const encryptedView = encrypt(data.password);

    return this.prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
        passwordView: encryptedView,
      },
    });
  }

  async getUsers(userId: number) {
    const requester = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!requester) {
      throw new Error('Sin Usuarios');
    }

    let users = [];

    if (requester.role === 'ADMIN') {
      users = await this.prisma.user.findMany();

    } else {

      users = await this.prisma.user.findMany({
        where: {
          OR: [
            { id: userId },
            { managerId: userId }
          ]
        }
      });
    }

    return users.map(user => ({
      ...user,
      passwordView: user.passwordView ? decrypt(user.passwordView) : null
    }));
  }

  async updateUserWithLog(targetId: number, data: UpdateUserDto, actorId: number) {
    const currentData = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!currentData) throw new Error('Usuario no encontrado');

    const updatePayload: any = {};
    const changedFields: string[] = [];

    const keys = Object.keys(data) as Array<keyof UpdateUserDto>;

    for (const key of keys) {
      if ((key as string) === 'id') continue;

      if ((key as string) === 'passwordView') {
        const newVal = data.passwordView;
        const decryptedCurrent = currentData.passwordView ? decrypt(currentData.passwordView) : null;

        if (newVal && newVal !== decryptedCurrent) {
          updatePayload.password = await bcrypt.hash(newVal, 10);
          updatePayload.passwordView = encrypt(newVal);
          changedFields.push('password');
        }
        continue;
      }

      if (data[key] !== undefined && data[key] !== (currentData as any)[key]) {
        updatePayload[key] = data[key];
        changedFields.push(key as string);
      }
    }

    if (changedFields.length === 0) {
      return {
        ...currentData,
        passwordView: currentData.passwordView ? decrypt(currentData.passwordView) : null
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: targetId },
        data: updatePayload,
      });

      const fieldsList = changedFields.join(', ');
      const auditDetail = `Update ID: ${targetId} | Campos: ${fieldsList}`;
      const cleanNotification = `Se actualizaron los datos del usuario (${updatedUser.name}). Campos modificados: ${fieldsList}`;

      await tx.registerChanceUser.create({
        data: {
          userId: targetId,
          userCreatorId: actorId,
          change: auditDetail,
        },
      });

      await tx.notifications.create({
        data: {
          title: "Alerta de Cambio",
          content: cleanNotification,
          type: 'GENERAL',
          userId: actorId,
          metadata: { targetId }
        }
      });

      return updatedUser;
    });

    const finalMsg = `Se actualizaron los datos del usuario (ID: ${targetId}). Campos: ${changedFields.join(', ')}`;

    this.eventsGateway.server.emit('activity', {
      user: "Sistema",
      change: finalMsg,
      date: new Date()
    });

    return {
      ...result,
      passwordView: result.passwordView ? decrypt(result.passwordView) : null
    };
  }

  async toggleStatus(id: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const userResponse = await tx.user.findUnique({ where: { id } });
      if (!userResponse) throw new NotFoundException('User no encontrado');

      const updatedUser = await tx.user.update({
        where: { id },
        data: { status: !userResponse.status },
      });

      await tx.registerChanceUser.create({
        data: {
          userId: id,
          userCreatorId: userId,
          change: `Status: ${updatedUser.status ? 'Activo' : 'Inactivo'} -> ${updatedUser.status ? 'Activo' : 'Inactivo'}`,
        },
      });

      this.eventsGateway.server.emit('activity', {
        user: "Sistema",
        change: `Cambió estado de ${userResponse.name} a ${updatedUser.status ? 'Activo' : 'Inactivo'}`,
        date: new Date()
      });

      const title = "Alerta de Cambio";
      const content = `Cambió estado de ${userResponse.name} a ${updatedUser.status ? 'Activo' : 'Inactivo'}`;

      await tx.notifications.create({
        data: {
          title,
          content,
          type: 'GENERAL',
          userId,
          metadata: { sku: userResponse.name, status: updatedUser.status }
        }
      });
      return updatedUser;
    });
  }

};
