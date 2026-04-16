import { 
  Controller, Get, Post, Put, Patch, Delete, 
  Body, Param, Query, Req, UseGuards, ParseIntPipe 
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProspectsService } from './prospects.service';
import { CreateProspectDto, UpdateProspectDto } from './dto/prospect.dto';

interface RequestWithUser extends Request {
    user: { userId: number; role: string; };
}

@Controller('prospects')
@UseGuards(AuthGuard('jwt'))
export class ProspectsController {
  constructor(private readonly prospectsService: ProspectsService) {}

  @Post()
  create(@Body() dto: CreateProspectDto, @Req() req: RequestWithUser) {
    return this.prospectsService.create(dto, req.user.userId);
  }

  @Get()
  findAll(
    @Query('type') type: 'precontact' | 'contact' | 'sale' = 'precontact',
    @Req() req: RequestWithUser
  ) {
    return this.prospectsService.findAll(type, req.user.userId, req.user.role);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProspectDto) {
    return this.prospectsService.update(id, dto);
  }

  @Patch(':id/contacted')
  markContacted(@Param('id', ParseIntPipe) id: number) {
    return this.prospectsService.markAsContacted(id);
  }

  @Patch(':id/sale')
  markSale(@Param('id', ParseIntPipe) id: number) {
    return this.prospectsService.markAsSale(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.prospectsService.remove(id);
  }
}