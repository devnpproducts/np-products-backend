// sales.controller.ts
import { Controller, Post, Body, Get, UseGuards, Req, Patch, Query, Param, Put } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto, UpdateSaleDto } from './dto/sales.dto';
import { AuthGuard } from '@nestjs/passport';

interface RequestWithUser extends Request {
  user: { userId: number };
}


@Controller('sales')
@UseGuards(AuthGuard('jwt'))
export class SalesController {
  constructor(private readonly salesService: SalesService) { }

  @Post('register')
  async create(
    @Body() dto: CreateSaleDto,
    @Req() req: RequestWithUser
  ) {
    return this.salesService.registerSale(dto, req.user.userId);
  }

  @Get()
  async findAll(
    @Req() req: RequestWithUser
  ) {
    return this.salesService.findAll(req.user.userId);
  }

  @Get('prospect/:id')
  async findByProspect(@Param('id') id: string) {
    return this.salesService.findByProspectId(+id);
  }

  @Get('search')
  async search(@Query('term') term: string, @Req() req: RequestWithUser) {
    return this.salesService.searchSales(term, req.user.userId);
  }

  @Get('searchDasrboar')
  async searchDasrboar(@Query('term') term: string, @Req() req: RequestWithUser) {
    return this.salesService.globalSearch(term, req.user.userId);
  }

  @Get('metrics')
  async metrics(@Query('range') range: string, @Req() req: RequestWithUser) {
    return this.salesService.getDashboardMetrics(range || '7d', req.user.userId);
  }

  @Patch(':id/tracking')
  async updateTracking(
    @Param('id') id: string,
    @Body() trackingData: { trackingLink: string; packageStatus: string },
    @Req() req: RequestWithUser
  ) {
    return this.salesService.updateTracking(+id, trackingData, req.user.userId);
  }

  @Put(':id')
  async updateSale(
    @Param('id') id: string,
    @Body() trackingData: UpdateSaleDto,
    @Req() req: RequestWithUser
  ) {
    return this.salesService.updateSale(+id, trackingData, req.user.userId);
  }

  @Get(':id/history')
  async getSaleHistory(@Param('id') id: string, @Req() req: RequestWithUser) {
    const history = await this.salesService.getSaleHistory(Number(id), req.user.userId)

    return {
      ok: true,
      data: history
    };
  }
}