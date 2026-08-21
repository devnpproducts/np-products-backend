// sales.controller.ts
import { Controller, Post, Body, Get, UseGuards, Req, Patch, Query, Param, Put, BadRequestException, UploadedFile, UseInterceptors, Delete } from '@nestjs/common';
import { AuthGuard, } from '@nestjs/passport';
import { v2 as cloudinary } from 'cloudinary';

import { SalesService } from './sales.service';
import { CreateSaleDto, UpdateSaleDto, BulkCreateSaleDto } from './dto/sales.dto';
import { FileInterceptor } from '@nestjs/platform-express';

interface RequestWithUser extends Request {
  user: { userId: number };
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

@Controller('sales')
@UseGuards(AuthGuard('jwt'))
export class SalesController {
  constructor(private readonly salesService: SalesService) { }

  @Post('upload-receipt')
  @UseInterceptors(FileInterceptor('file'))
  async uploadReceipt(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo de comprobante.');
    }

    try {
      const base64Image = Buffer.from(file.buffer).toString('base64');
      const dataURI = `data:${file.mimetype};base64,${base64Image}`;

      const cloudResult = await cloudinary.uploader.upload(dataURI, {
        folder: 'ventas_comprobantes'
      });

      // Retorna la URL generada
      return { url: cloudResult.secure_url };
    } catch (error) {
      console.error("Error subiendo a Cloudinary:", error);
      throw new BadRequestException('Hubo un problema al subir el comprobante de pago.');
    }
  }

  @Post('register')
  async create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateSaleDto & { receiptUrl?: string }
  ) {
    return this.salesService.registerSale(dto, req.user.userId, dto.receiptUrl);
  }

  @Post('bulk-register')
  async bulkCreate(
    @Req() req: RequestWithUser,
    @Body() bulkDto: BulkCreateSaleDto
  ) {
    return this.salesService.registerBulkSales(bulkDto.sales, req.user.userId);
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

  @Delete(':id/receipt')
  async removeReceipt(
    @Param('id') saleId: string,
    @Query('receiptUrl') receiptUrl: string,
  ) {
    return this.salesService.removeReceipt(+saleId, receiptUrl);
  }
}