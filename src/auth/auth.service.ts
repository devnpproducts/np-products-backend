import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private prisma: PrismaService
  ) { }

  async login(user: string, password: string, ip: string, device: string) {
    const userResponse = await this.usersService.findByUser(user);
    if (!userResponse) throw new UnauthorizedException('Usuario no encontrado');

    const isMatch = await bcrypt.compare(password, userResponse.password);
    if (!isMatch) throw new UnauthorizedException('Contraseña incorrecta');

    if (userResponse.status === false) {
      throw new UnauthorizedException('Tu cuenta está desactivada. Contacta al administrador.');
    }

    await this.prisma.logSesion.create({
      data: {
        userId: userResponse.id,
        ip: ip,
        device: device,
      }
    });

    const payload = { sub: userResponse.id, user: userResponse.user };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: userResponse.id,
        user: userResponse.user,
        name: userResponse.name,
        role: userResponse.role,
      },
    };
  }
}