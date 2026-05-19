import { Controller, Get, Post, Put, Patch, Body, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { BasesService } from './bases.service';

interface RequestWithUser extends Request {
    user: {
        userId: number;
        user: string;
    };
}

@Controller('bases')
@UseGuards(AuthGuard('jwt'))
export class BasesController {
    constructor(private readonly basesService: BasesService) { }

    @Get()
    findAll(@Req() req: RequestWithUser) {
        return this.basesService.findAll(req.user.userId);
    }

}




