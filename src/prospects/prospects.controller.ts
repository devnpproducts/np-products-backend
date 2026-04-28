import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, Req, UseGuards, ParseIntPipe
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProspectsService } from './prospects.service';
import { CreateProspectDto, UpdateProspectDto } from './dto/prospect.dto';

interface RequestWithUser extends Request {
  user: { userId: number };
}

@Controller('prospects')
@UseGuards(AuthGuard('jwt'))
export class ProspectsController {
  constructor(private readonly prospectsService: ProspectsService) { }

  @Post()
  create(@Body() dto: CreateProspectDto, @Req() req: RequestWithUser) {
    return this.prospectsService.create(dto, req.user.userId);
  }

  @Get()
  findAll(
    @Query('type') type: 'precontact' | 'contact' | 'sale' = 'precontact',
    @Req() req: RequestWithUser
  ) {
    return this.prospectsService.findAll(type, req.user.userId);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProspectDto, @Req() req: RequestWithUser) {
    return this.prospectsService.update(id, dto, req.user.userId);
  }

  @Get(':id/history')
  getHistory(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.prospectsService.getHistory(id);
  }

  @Patch(':id/contacted')
  markContacted(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.prospectsService.markContacted(id, req.user.userId);
  }

  @Patch(':id/sale')
  markSale(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.prospectsService.markAsSale(id, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.prospectsService.remove(id);
  }
}