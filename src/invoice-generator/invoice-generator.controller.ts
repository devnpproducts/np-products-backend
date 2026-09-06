import { Controller, Get, Param, Res, NotFoundException, Query } from '@nestjs/common';
import { Response } from 'express';
import { InvoiceGeneratorService } from './invoice-generator.service';
import { SalesService } from '../sales/sales.service';

@Controller('api/v1/pdf')
export class PdfController {
    constructor(
        private readonly invoiceGeneratorService: InvoiceGeneratorService,
        private readonly salesService: SalesService
    ) { }

    @Get('bulk')
    async generateBulkInvoice(
        @Query('sellerId') sellerId: string,
        @Query('supervisorId') supervisorId: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Res() res: Response
    ) {
        if (!startDate || !endDate) {
            throw new NotFoundException('El rango de fechas es obligatorio');
        }

        const zipBuffer = await this.invoiceGeneratorService.generateBulkZipPDF({
            sellerId,
            supervisorId,
            startDate,
            endDate,
        });

        const prefix = sellerId ? 'vendedor' : 'supervisor';

        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename=boletas_lote_${prefix}_${startDate}_al_${endDate}.zip`,
            'Content-Length': zipBuffer.length,
        });

        res.end(zipBuffer);
    }

    @Get('invoice/:id')
    async generateInvoice(@Param('id') saleId: string, @Res() res: Response) {
        const numericId = Number(saleId);

        if (isNaN(numericId)) {
            throw new NotFoundException('El ID de la orden no es válido');
        }

        const saleData = await this.salesService.findOne(numericId);

        if (!saleData) {
            throw new NotFoundException('La orden especificada no existe');
        }

        const pdfBuffer = await this.invoiceGeneratorService.generatePDF(saleData);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename=orden_${saleData.id}.pdf`,
            'Content-Length': pdfBuffer.length,
        });

        res.end(pdfBuffer);
    }

}