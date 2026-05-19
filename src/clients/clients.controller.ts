import { Controller, Get, Param, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ClientsService } from './clients.service';

interface RequestWithUser extends Request {
  user: { userId: number };
}

@Controller('clients')
@UseGuards(AuthGuard('jwt'))
export class ClientsController {
    constructor(private readonly clientsService: ClientsService) { }

    @Get('by-phone/:phone')
    async findByPhone(
        @Param('phone') phone: string,
        @Req() req: RequestWithUser
    ) {
        const client = await this.clientsService.findByPhone(phone, req.user.userId);
        if (!client) {
            throw new NotFoundException('Cliente no encontrado en la base maestra');
        }
        return client;
    }
}

