import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { InvoiceGeneratorService } from './invoice-generator.service';
import { SalesService } from '../sales/sales.service'; 

@Controller('api/v1/pdf')
export class PdfController {
    constructor(
        private readonly invoiceGeneratorService: InvoiceGeneratorService,
        private readonly salesService: SalesService
    ) {}
    
    @Get('invoice/:id')
    async generateInvoice(@Param('id') saleId: string, @Res() res: Response) {
        const saleData = await this.salesService.findOne(Number(saleId));
        
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